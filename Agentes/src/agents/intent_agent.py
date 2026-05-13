"""
Intent Agent — Detección de intención y resolución.

Lee el corpus enriquecido con sentiment, reclasifica la intención
usando el catálogo ampliado, y determina resolución.

El CSV ya trae una `intencion_original` (logistica_envio, problema_pago),
pero este agente la reclasifica con mayor granularidad.

Cuando use_db=True, persiste resultados a Supabase.
"""
import json
import os
import re
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path

import pandas as pd
import structlog
from pydantic import BaseModel, Field, ValidationError

from src.llm_factory import get_llm

log = structlog.get_logger()

# ── Catálogo de intenciones (ampliado para datos reales) ─────────────────────


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
    LOGISTICA_ENVIO = "logistica_envio"
    PROBLEMA_PAGO = "problema_pago"
    OTRA = "otra"


# ── Schema de salida ─────────────────────────────────────────────────────────


class IntentResult(BaseModel):
    """Campos de intent a agregar al corpus enriquecido."""

    intent_label: IntentLabel | None = None
    intent_confidence: float | None = Field(None, ge=0.0, le=1.0)
    resolved: bool | None = None


# ── Configuración ────────────────────────────────────────────────────────────

BATCH_SIZE = int(os.getenv("INTENT_BATCH_SIZE", "50"))

# ── Prompt de clasificación ──────────────────────────────────────────────────

INTENT_PROMPT = """
Eres un UX Researcher experto en diseño conversacional para soporte al cliente
en español LATAM y portugués brasileño.

Mensaje: {text}
Intención previa del sistema: {intencion_original}

Responde SOLO con JSON válido:
{{
  "intent": "nombre_de_categoria",
  "confidence": 0.0
}}

## Catálogo de Intenciones

- consulta_saldo: Preguntar saldo, crédito, deuda, monto a pagar.
- reporte_problema: Reportar error, falla, algo roto.
- solicitud_reembolso: Pedir devolución de dinero, cargo incorrecto.
- cambio_datos: Actualizar info personal.
- consulta_estado: Preguntar por estado de pedido, reclamo, ticket, entrega.
- queja_servicio: Insatisfacción general, pedir agente humano.
- solicitud_info: Información sobre productos/servicios.
- cancelacion: Cancelar servicio, suscripción, pedido.
- logistica_envio: Problemas de envío, paquetes retrasados, repartidor.
- problema_pago: Cobros incorrectos, cobros duplicados, problemas con pagos.
- otra: No encaja en ninguna categoría (confidence < 0.6).

## Reglas
1. Si confidence < 0.6 → forzar intent="otra"
2. Si el mensaje tiene múltiples intenciones → clasificar la MÁS URGENTE
3. Usa la intención previa como contexto, pero reclasifica según el TEXTO
4. "quiero cancelar mi compra" = cancelacion, no logistica_envio
5. "exijo mi dinero de vuelta" = solicitud_reembolso, no problema_pago
"""


# ── Clasificación con LLM ───────────────────────────────────────────────────


async def _classify_intent_batch(
    texts: list[str],
    intenciones_originales: list[str],
) -> list[IntentResult]:
    """Clasifica intent para un batch de textos usando el LLM."""
    llm = get_llm(role="smart")
    results: list[IntentResult] = []

    for text, intencion in zip(texts, intenciones_originales):
        try:
            prompt = INTENT_PROMPT.format(
                text=text, intencion_original=intencion,
            )
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)

            parsed = json.loads(content)
            intent_str = parsed.get("intent", "otra")
            confidence = parsed.get("confidence", 0.0)

            if confidence < 0.6:
                intent_str = "otra"

            try:
                intent_label = IntentLabel(intent_str)
            except ValueError:
                intent_label = IntentLabel.OTRA
                log.warning("intent_label_invalido", label=intent_str)

            result = IntentResult(
                intent_label=intent_label,
                intent_confidence=confidence,
            )
        except (json.JSONDecodeError, ValidationError, Exception) as e:
            log.warning("intent_parse_error", text=text[:50], error=str(e))
            # Fallback: usar la intención original del CSV
            result = _fallback_from_original(intencion)
        results.append(result)

    return results


def _fallback_from_original(intencion: str) -> IntentResult:
    """Genera un IntentResult de fallback basado en la intención del CSV."""
    try:
        label = IntentLabel(intencion)
    except ValueError:
        label = IntentLabel.OTRA
    return IntentResult(intent_label=label, intent_confidence=0.7)


# ── Detección de resolución ─────────────────────────────────────────────────

# Patrón de ticket/caso
_TICKET_PATTERN = re.compile(r"(#\d+|TICKET-\d+|CASO-\d+)", re.IGNORECASE)


def detect_resolved(session_turns: pd.DataFrame) -> pd.Series:
    """
    Determina si cada intención fue resuelta.

    En este dataset (solo mensajes de usuario), resolved=False cuando:
    1. nivel_frustracion llega a 2 (máximo) en la sesión
    2. es_churn_risk=True en algún turno
    3. La sesión termina con sentimiento frustrado alto
    """
    resolved = pd.Series(True, index=session_turns.index)

    for idx, row in session_turns.iterrows():
        # Si el nivel de frustración es máximo → no resuelto
        if row.get("nivel_frustracion", 0) >= 2:
            resolved.at[idx] = False
            continue

        # Si es churn risk → no resuelto
        if row.get("es_churn_risk", False):
            resolved.at[idx] = False
            continue

        # Si el sentiment_score es alto frustrado → no resuelto
        if (
            row.get("sentiment_label") == "frustrado"
            and (row.get("sentiment_score") or 0) > 0.7
        ):
            resolved.at[idx] = False

    return resolved


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_intent_analysis(
    processed_path: str,
    use_db: bool = False,
) -> str:
    """
    Clasifica intención en el corpus procesado.

    Args:
        processed_path: Path al enriched_corpus.jsonl (con sentiment).
        use_db: Si True, persiste a Supabase.

    Returns:
        Path al enriched_corpus.jsonl actualizado.
    """
    path = Path(processed_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus no encontrado: {path}")

    log.info("intent_starting", processed_path=str(path))

    df = pd.read_json(path, lines=True)

    # Inicializar columnas
    df["intent_label"] = None
    df["intent_confidence"] = None
    df["resolved"] = None

    # Clasificar todos los turnos
    texts = df["text_clean"].tolist()
    intenciones = df.get("intencion_original", pd.Series("otra", index=df.index)).fillna("otra").tolist()

    if texts:
        all_results: list[IntentResult] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch_texts = texts[i : i + BATCH_SIZE]
            batch_intenciones = intenciones[i : i + BATCH_SIZE]
            batch_results = await _classify_intent_batch(batch_texts, batch_intenciones)
            all_results.extend(batch_results)
            log.info(
                "intent_batch_done",
                batch_num=i // BATCH_SIZE + 1,
                processed=len(all_results),
                total=len(texts),
            )

        for idx, result in enumerate(all_results):
            df.at[idx, "intent_label"] = (
                result.intent_label.value if result.intent_label else None
            )
            df.at[idx, "intent_confidence"] = result.intent_confidence

    # Detectar resolución por sesión
    for _, session_df in df.groupby("session_id"):
        session_idx = session_df.index
        df.loc[session_idx, "resolved"] = detect_resolved(session_df).values

    # Guardar corpus enriquecido
    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    enriched_path = output_dir / "enriched_corpus.jsonl"

    with open(enriched_path, "w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            f.write(json.dumps(row.to_dict(), ensure_ascii=False, default=str) + "\n")

    _generate_unresolved_ranking(df, output_dir)

    if use_db:
        await _persist_intent_to_db(df)

    log.info("intent_completado", enriched_path=str(enriched_path))
    return str(enriched_path)


# ── Persistencia a Supabase ──────────────────────────────────────────────────


async def _persist_intent_to_db(df: pd.DataFrame) -> None:
    """Actualiza las columnas de intent en Supabase."""
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    user_df = df[df["intent_label"].notna()].copy()

    if user_df.empty:
        return

    log.info("db_intent_updating", count=len(user_df))

    for _, row in user_df.iterrows():
        confidence = row.get("intent_confidence")
        resolved_val = row.get("resolved")
        update_data = {
            "intent_label": str(row["intent_label"]) if row.get("intent_label") else None,
            "intent_confidence": (
                float(confidence)
                if confidence is not None and str(confidence) != "nan"
                else None
            ),
            "resolved": (
                bool(resolved_val)
                if resolved_val is not None and str(resolved_val) != "nan"
                else None
            ),
        }
        sb.table("messages").update(update_data).eq(
            "session_id", row["session_id"]
        ).eq("turn_id", int(row["turn_id"])).execute()

    # Actualizar sessions
    for session_id, session_df in df.groupby("session_id"):
        with_intent = session_df[session_df["intent_label"].notna()]
        if with_intent.empty:
            continue

        intent_counts = with_intent["intent_label"].value_counts()
        dominant = str(intent_counts.index[0]) if not intent_counts.empty else None

        with_resolved = with_intent[with_intent["resolved"].notna()]
        res_rate = (
            round(float(with_resolved["resolved"].mean()), 3)
            if len(with_resolved) > 0
            else None
        )

        sb.table("sessions").update({
            "dominant_intent": dominant,
            "resolution_rate": res_rate,
        }).eq("id", session_id).execute()

    log.info("db_intent_updated")


# ── Ranking de intenciones no resueltas ──────────────────────────────────────


def _generate_unresolved_ranking(df: pd.DataFrame, output_dir: Path) -> None:
    """Genera unresolved_intents_ranking.json."""
    user_df = df[df["intent_label"].notna()].copy()

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
        unresolved = group[group["resolved"] == False]  # noqa: E712
        unresolved_count = len(unresolved)
        unresolved_pct = round(unresolved_count / total * 100, 1) if total > 0 else 0

        avg_frustration = 0.0
        frustrated_unresolved = unresolved[unresolved.get("sentiment_label") == "frustrado"]
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
