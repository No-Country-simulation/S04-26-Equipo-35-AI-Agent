"""
Intent Agent — Detección de intención y resolución.

Lee processed_corpus.jsonl, detecta la intención del usuario en cada turno,
determina si el bot la resolvió y genera el ranking de intenciones no resueltas.

Leer skills/skill_intent.md antes de modificar este archivo.
"""
import asyncio
import json
import os
from collections import Counter
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path

import pandas as pd
import structlog
from pydantic import BaseModel, Field, ValidationError

from src.llm_factory import get_llm

log = structlog.get_logger()

# ── Catálogo de intenciones ──────────────────────────────────────────────────


class IntentLabel(StrEnum):
    """Catálogo de intenciones del usuario."""

    CONSULTA_SALDO = "consulta_saldo"
    REPORTE_PROBLEMA = "reporte_problema"
    SOLICITUD_REEMBOLSO = "solicitud_reembolso"
    CAMBIO_DATOS = "cambio_datos"
    CONSULTA_ESTADO = "consulta_estado"
    QUEJA_SERVICIO = "queja_servicio"
    SOLICITUD_INFO = "solicitud_info"
    CANCELACION = "cancelacion"
    OTRA = "otra"


# ── Schema de salida ─────────────────────────────────────────────────────────


class IntentResult(BaseModel):
    """Campos de intent a agregar al corpus enriquecido."""

    intent_label: IntentLabel | None = None
    intent_confidence: float | None = Field(None, ge=0.0, le=1.0)
    resolved: bool | None = None  # None para turnos de bot


# ── Palabras de confirmación ─────────────────────────────────────────────────

CONFIRMATION_WORDS_ES = {
    "listo", "resuelto", "procesado", "completado", "confirmado",
    "generado", "asignado", "solucionado", "ya está", "quedó",
}

CONFIRMATION_WORDS_PT = {
    "pronto", "resolvido", "processado", "concluído", "confirmado",
    "gerado", "atribuído", "solucionado", "feito", "já está",
}

# Patrón de ticket/caso
import re

_TICKET_PATTERN = re.compile(r"(#\d+|TICKET-\d+|CASO-\d+)", re.IGNORECASE)

# ── Configuración ────────────────────────────────────────────────────────────

BATCH_SIZE = int(os.getenv("INTENT_BATCH_SIZE", "50"))

# ── Prompt de clasificación ──────────────────────────────────────────────────

INTENT_PROMPT = """
Eres un UX Researcher experto en diseño conversacional para soporte al cliente
en español LATAM y portugués brasileño. Tu trabajo es detectar la intención REAL
del usuario, no la superficial.

Mensaje: {text}

Responde SOLO con JSON válido:
{{
  "intent": "nombre_de_categoria",
  "confidence": 0.0
}}

## Catálogo de Intenciones

### consulta_saldo
Preguntar saldo, crédito, deuda, monto a pagar.
- ES: "cuánto debo", "mi saldo", "cuánto tengo", "mi balance"
- PT: "meu saldo", "quanto devo", "meu balanço"

### reporte_problema
Reportar error, falla, algo roto. El usuario NO puede hacer algo que antes podía.
- ES: "no funciona", "no carga", "da error", "no puedo entrar", "se queda en blanco"
- PT: "não funciona", "dá erro", "não consigo entrar", "não carrega"

### solicitud_reembolso
Pedir devolución de dinero, cargo incorrecto, cobro duplicado.
- ES: "me cobraron de más", "quiero reembolso", "cargo que no reconozco"
- PT: "cobraram errado", "quero reembolso", "cobrança indevida"

### cambio_datos
Actualizar info personal: teléfono, correo, dirección, nombre.
- ES: "cambiar mi teléfono", "actualizar correo", "cambiar dirección"
- PT: "mudar telefone", "atualizar email", "trocar endereço"

### consulta_estado
Preguntar por estado de pedido, reclamo, ticket, entrega.
- ES: "dónde está mi pedido", "mi ticket", "cuándo llega"
- PT: "cadê meu pedido", "meu chamado", "quando chega"

### queja_servicio
Insatisfacción general, pedir agente humano, queja del bot.
- ES: "el servicio es pésimo", "quiero hablar con un humano", "estoy harto"
- PT: "péssimo serviço", "quero falar com humano", "que absurdo"
⚠️ "quiero hablar con un humano" SIEMPRE es queja_servicio

### solicitud_info
Información sobre productos, servicios, planes, horarios.
- ES: "cómo funciona", "qué incluye el plan", "horarios de atención"
- PT: "como funciona", "o que inclui", "horário de atendimento"

### cancelacion
Cancelar servicio, suscripción, pedido, dar de baja.
- ES: "quiero cancelar", "dar de baja", "no quiero seguir"
- PT: "quero cancelar", "cancelar assinatura"

### otra
No encaja en ninguna categoría. Usar cuando confidence < 0.6.

## Reglas Críticas
1. Si confidence < 0.6 → forzar intent="otra"
2. Si el mensaje tiene múltiples intenciones → clasificar la MÁS URGENTE
3. "llevo X días esperando" = consulta_estado (urgencia implícita)
4. Insultos o quejas genéricas sin pedido concreto = queja_servicio
5. Datos sueltos (números, correos) sin contexto = otra
"""


# ── Clasificación con LLM ───────────────────────────────────────────────────


async def _classify_intent_batch(texts: list[str]) -> list[IntentResult]:
    """
    Clasifica intent para un batch de textos usando el LLM.

    Args:
        texts: Lista de textos a clasificar.

    Returns:
        Lista de IntentResult, uno por texto.
    """
    llm = get_llm(role="smart")
    results: list[IntentResult] = []

    for text in texts:
        try:
            prompt = INTENT_PROMPT.format(text=text)
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)

            parsed = json.loads(content)
            intent_str = parsed.get("intent", "otra")
            confidence = parsed.get("confidence", 0.0)

            # Si confidence < 0.6, forzar a "otra"
            if confidence < 0.6:
                intent_str = "otra"

            # Validar que es un IntentLabel válido
            try:
                intent_label = IntentLabel(intent_str)
            except ValueError:
                intent_label = IntentLabel.OTRA
                log.warning("intent_label_invalido", label=intent_str)

            result = IntentResult(
                intent_label=intent_label,
                intent_confidence=confidence,
                resolved=None,  # Se determina después
            )
        except (json.JSONDecodeError, ValidationError, Exception) as e:
            log.warning("intent_parse_error", text=text[:50], error=str(e))
            result = IntentResult(
                intent_label=IntentLabel.OTRA,
                intent_confidence=0.0,
                resolved=None,
            )
        results.append(result)

    return results


# ── Lógica de resolución ────────────────────────────────────────────────────


def detect_resolved(session_turns: pd.DataFrame) -> pd.Series:
    """
    Determina si cada intención del usuario fue resuelta.

    resolved = False cuando:
    1. En los 3 turnos del bot posteriores al turno del usuario no hay
       confirmación explícita ni número de ticket/caso.
    2. El usuario repite la misma intent en la misma sesión.
    3. La sesión termina sin confirmación (último turno = user sin respuesta bot).

    Args:
        session_turns: DataFrame con turnos de una sesión.

    Returns:
        Series booleana indexada como session_turns.
    """
    resolved = pd.Series(dtype="object", index=session_turns.index)

    # Obtener idioma de la sesión para palabras de confirmación
    session_lang = session_turns["lang"].iloc[0] if "lang" in session_turns.columns else "es"
    confirmation_words = (
        CONFIRMATION_WORDS_PT if session_lang == "pt" else CONFIRMATION_WORDS_ES
    )

    # Tracking de intents vistos para detectar repeticiones
    seen_intents: Counter[str] = Counter()

    for idx, row in session_turns.iterrows():
        if row["speaker"] != "user":
            resolved.at[idx] = None  # Bot turns
            continue

        intent = row.get("intent_label")
        if intent is None:
            resolved.at[idx] = None
            continue

        # Contar intent
        seen_intents[intent] += 1

        # Condición 2: Intent repetido
        if seen_intents[intent] > 1:
            resolved.at[idx] = False
            continue

        # Condición 1: Buscar confirmación en los siguientes 3 turnos del bot
        pos = session_turns.index.get_loc(idx)
        remaining = session_turns.iloc[pos + 1 :]  # noqa: E203
        bot_responses = remaining[remaining["speaker"] == "bot"].head(3)

        found_confirmation = False
        for _, bot_row in bot_responses.iterrows():
            bot_text = str(bot_row.get("text_clean", "")).lower()

            # Buscar palabras de confirmación
            for word in confirmation_words:
                if word in bot_text:
                    found_confirmation = True
                    break

            # Buscar número de ticket/caso
            if _TICKET_PATTERN.search(bot_text):
                found_confirmation = True

            if found_confirmation:
                break

        # Condición 3: Último turno del usuario sin bot después
        if bot_responses.empty:
            resolved.at[idx] = False
            continue

        resolved.at[idx] = found_confirmation

    return resolved


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_intent_analysis(processed_path: str) -> str:
    """
    Clasifica intención en el corpus procesado.

    Args:
        processed_path: Path al processed_corpus.jsonl

    Returns:
        Path al enriched_corpus.jsonl con campos de intent.
    """
    path = Path(processed_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus procesado no encontrado: {path}")

    log.info("intent_starting", processed_path=str(path))

    # Cargar corpus (puede ser el ya enriquecido con sentiment)
    df = pd.read_json(path, lines=True)

    # Inicializar columnas de intent
    df["intent_label"] = None
    df["intent_confidence"] = None
    df["resolved"] = None

    # Clasificar solo turnos de usuario
    user_mask = df["speaker"] == "user"
    user_texts = df.loc[user_mask, "text_clean"].tolist()

    if user_texts:
        # Procesar en batches
        all_results: list[IntentResult] = []
        for i in range(0, len(user_texts), BATCH_SIZE):
            batch = user_texts[i : i + BATCH_SIZE]
            batch_results = await _classify_intent_batch(batch)
            all_results.extend(batch_results)
            log.info(
                "intent_batch_done",
                batch_num=i // BATCH_SIZE + 1,
                processed=len(all_results),
                total=len(user_texts),
            )

        # Asignar resultados a turnos de usuario
        user_indices = df.index[user_mask].tolist()
        for idx, result in zip(user_indices, all_results):
            df.at[idx, "intent_label"] = (
                result.intent_label.value if result.intent_label else None
            )
            df.at[idx, "intent_confidence"] = result.intent_confidence

    # Detectar resolución por sesión
    for _session_id, session_df in df.groupby("session_id"):
        session_idx = session_df.index
        resolved_flags = detect_resolved(session_df)
        df.loc[session_idx, "resolved"] = resolved_flags.values

    # Guardar corpus enriquecido
    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    enriched_path = output_dir / "enriched_corpus.jsonl"

    with open(enriched_path, "w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            record = row.to_dict()
            f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")

    # Generar ranking de intenciones no resueltas
    _generate_unresolved_ranking(df, output_dir)

    log.info("intent_completado", enriched_path=str(enriched_path))
    return str(enriched_path)


def _generate_unresolved_ranking(
    df: pd.DataFrame, output_dir: Path
) -> None:
    """
    Genera unresolved_intents_ranking.json con top 10 intenciones no resueltas.

    Estructura por intent:
    - intent_label, total_occurrences, unresolved_count,
      unresolved_pct, avg_frustration_when_unresolved
    """
    user_df = df[(df["speaker"] == "user") & (df["intent_label"].notna())].copy()

    if user_df.empty:
        ranking_data = {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "ranking": [],
        }
        with open(output_dir / "unresolved_intents_ranking.json", "w") as f:
            json.dump(ranking_data, f, indent=2, ensure_ascii=False)
        return

    ranking_items = []
    for intent_label, group in user_df.groupby("intent_label"):
        total = len(group)
        unresolved = group[group["resolved"] == False].copy()  # noqa: E712
        unresolved_count = len(unresolved)
        unresolved_pct = round(unresolved_count / total * 100, 1) if total > 0 else 0

        # Frustración promedio cuando no resuelto
        avg_frustration = 0.0
        if not unresolved.empty and "sentiment_score" in unresolved.columns:
            frustrated_unresolved = unresolved[
                unresolved.get("sentiment_label") == "frustrado"
            ]
            if not frustrated_unresolved.empty:
                scores = frustrated_unresolved["sentiment_score"].dropna()
                avg_frustration = round(float(scores.mean()), 2) if len(scores) > 0 else 0.0

        ranking_items.append({
            "intent_label": str(intent_label),
            "total_occurrences": int(total),
            "unresolved_count": int(unresolved_count),
            "unresolved_pct": float(unresolved_pct),
            "avg_frustration_when_unresolved": float(avg_frustration),
        })

    # Ordenar por unresolved_count DESC, top 10
    ranking_items.sort(key=lambda x: x["unresolved_count"], reverse=True)
    ranking_items = ranking_items[:10]

    ranking_data = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "ranking": ranking_items,
    }

    json_path = output_dir / "unresolved_intents_ranking.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(ranking_data, f, indent=2, ensure_ascii=False)

    log.info("unresolved_ranking", path=str(json_path), count=len(ranking_items))
