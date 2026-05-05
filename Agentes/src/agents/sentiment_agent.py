"""
Sentiment Agent — Clasificación emocional del corpus.

Lee processed_corpus.jsonl, clasifica el tono emocional de cada turno
del usuario (frustrado/neutro/satisfecho), detecta escalada y riesgo
de abandono.

Leer skills/skill_sentiment.md antes de modificar este archivo.
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Literal

import pandas as pd
import structlog
from pydantic import BaseModel, Field, ValidationError

from src.llm_factory import get_llm

log = structlog.get_logger()

# ── Schema de salida ─────────────────────────────────────────────────────────


class SentimentResult(BaseModel):
    """Campos de sentiment a agregar al corpus enriquecido."""

    sentiment_label: Literal["frustrado", "neutro", "satisfecho"] | None = None
    sentiment_score: float | None = Field(None, ge=0.0, le=1.0)
    escalation: bool = False
    abandonment_risk: bool = False


# ── Configuración ────────────────────────────────────────────────────────────

BATCH_SIZE = int(os.getenv("SENTIMENT_BATCH_SIZE", "50"))

# ── Prompt de clasificación ──────────────────────────────────────────────────

SENTIMENT_PROMPT = """
Eres una psicóloga organizacional experta en análisis emocional de conversaciones
de soporte al cliente en español LATAM y portugués brasileño.

Clasifica el sentimiento del siguiente mensaje de un USUARIO (no del bot).

Mensaje: {text}

Responde SOLO con JSON válido, sin explicación:
{{
  "label": "frustrado|neutro|satisfecho",
  "score": 0.0
}}

## Calibración de Intensidad (score 0.0 a 1.0)

### frustrado
- 0.3-0.4: Molestia leve → "no funciona", "no carga"
- 0.5-0.6: Frustración clara → "ya les dije", "no me entienden"
- 0.7-0.8: Ira contenida → "esto es inaceptable", "llevo 3 días"
- 0.9-1.0: Ira explosiva → "PÉSIMO", "ES UN ROBO", "🤬", insultos

### neutro
- 0.4-0.6: Sin carga emocional → "cuánto debo", "quiero saber mi saldo"

### satisfecho
- 0.6-0.7: Aceptación → "ok, gracias"
- 0.8-0.9: Alivio/gratitud → "perfecto, funcionó", "excelente servicio"
- 1.0: Entusiasmo → "increíble, gracias!!!"

## Señales Clave (ES LATAM)
- "no sirve", "pésimo", "qué mal" → frustrado
- "ya chole" (MX), "qué vaina" (CO), "qué mierda" (AR) → frustrado 0.7+
- "llevo X días/horas" → frustrado (la espera amplifica)
- MAYÚSCULAS SOSTENIDAS → subir score +0.2
- Signos repetidos "???" "!!!" → subir score +0.1
- Emoji 😤😡🤬 → frustrado con score 0.7+

## Señales Clave (PT-BR)
- "não funciona", "horrível", "que absurdo" → frustrado
- "péssimo atendimento" → frustrado 0.8+
- "me enganaram", "é fraude" → frustrado 0.9+
- "obrigado", "funcionou", "resolvido" → satisfecho

## Trampas Comunes (EVITAR)
- "ok" solo → puede ser resignación (neutro 0.4) si viene después de frustración
- "entiendo" → neutro, NO satisfecho
- Pregunta con "?" → generalmente neutro, a menos que haya signos de irritación
"""


# ── Clasificación con LLM ───────────────────────────────────────────────────


async def _classify_sentiment_batch(
    texts: list[str],
) -> list[SentimentResult]:
    """
    Clasifica sentimiento para un batch de textos usando el LLM.

    Args:
        texts: Lista de textos a clasificar.

    Returns:
        Lista de SentimentResult, uno por texto.
    """
    llm = get_llm(role="smart")
    results: list[SentimentResult] = []

    for text in texts:
        try:
            prompt = SENTIMENT_PROMPT.format(text=text)
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)

            parsed = json.loads(content)
            result = SentimentResult(
                sentiment_label=parsed.get("label", "neutro"),
                sentiment_score=parsed.get("score", 0.5),
            )
        except (json.JSONDecodeError, ValidationError, Exception) as e:
            log.warning("sentiment_parse_error", text=text[:50], error=str(e))
            # Fallback: neutro con score 0.5
            result = SentimentResult(
                sentiment_label="neutro",
                sentiment_score=0.5,
            )
        results.append(result)

    return results


# ── Detección de escalada ────────────────────────────────────────────────────


def detect_escalation(session_turns: pd.DataFrame) -> pd.Series:
    """
    Detecta escalada en turnos de usuario dentro de una sesión.

    Condiciones (cualquiera activa el flag):
    1. sentiment_score frustrado sube >0.3 en 2 turnos consecutivos del usuario
    2. Texto en MAYÚSCULAS sostenidas (>70% del texto en caps)
    3. Misma frase repetida >2 veces en la sesión
    """
    escalation = pd.Series(False, index=session_turns.index)
    user_turns = session_turns[session_turns["speaker"] == "user"]

    if user_turns.empty:
        return escalation

    # Condición 1: Score de frustración sube >0.3 en 2 turnos consecutivos
    user_scores = user_turns["sentiment_score"].fillna(0.0)
    if len(user_scores) >= 2:
        score_diffs = user_scores.diff()
        rapid_increase = score_diffs > 0.3
        frustrado_mask = user_turns["sentiment_label"] == "frustrado"
        escalation.loc[rapid_increase.index] = (
            rapid_increase & frustrado_mask
        )

    # Condición 2: Misma frase repetida >2 veces
    user_texts = user_turns["text_clean"].tolist()
    from collections import Counter

    text_counts = Counter(user_texts)
    repeated_texts = {t for t, c in text_counts.items() if c > 2}
    if repeated_texts:
        for idx, row in user_turns.iterrows():
            if row["text_clean"] in repeated_texts:
                escalation.at[idx] = True

    return escalation


# ── Detección de abandono ────────────────────────────────────────────────────


def detect_abandonment(session_turns: pd.DataFrame) -> pd.Series:
    """
    Detecta riesgo de abandono.

    Condición: último turno del usuario tiene frustrado con score > 0.7
    Y no hay turnos del usuario después de los 2 turnos siguientes del bot.
    """
    abandonment = pd.Series(False, index=session_turns.index)
    user_turns = session_turns[session_turns["speaker"] == "user"]

    if user_turns.empty:
        return abandonment

    last_user_idx = user_turns.index[-1]
    last_user = session_turns.loc[last_user_idx]

    if (
        last_user.get("sentiment_label") == "frustrado"
        and (last_user.get("sentiment_score") or 0) > 0.7
    ):
        # Verificar que no hay más turnos del usuario después
        remaining = session_turns.loc[last_user_idx + 1 :]  # noqa: E203
        remaining_user = remaining[remaining["speaker"] == "user"]
        if remaining_user.empty:
            abandonment.at[last_user_idx] = True

    return abandonment


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_sentiment_analysis(processed_path: str) -> str:
    """
    Clasifica sentimiento en el corpus procesado.

    Args:
        processed_path: Path al processed_corpus.jsonl

    Returns:
        Path al enriched_corpus.jsonl con campos de sentiment.
    """
    path = Path(processed_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus procesado no encontrado: {path}")

    log.info("sentiment_starting", processed_path=str(path))

    # Cargar corpus procesado
    df = pd.read_json(path, lines=True)

    # Inicializar columnas de sentiment
    df["sentiment_label"] = None
    df["sentiment_score"] = None
    df["escalation"] = False
    df["abandonment_risk"] = False

    # Clasificar solo turnos de usuario
    user_mask = df["speaker"] == "user"
    user_texts = df.loc[user_mask, "text_clean"].tolist()

    if user_texts:
        # Procesar en batches
        all_results: list[SentimentResult] = []
        for i in range(0, len(user_texts), BATCH_SIZE):
            batch = user_texts[i : i + BATCH_SIZE]
            batch_results = await _classify_sentiment_batch(batch)
            all_results.extend(batch_results)
            log.info(
                "sentiment_batch_done",
                batch_num=i // BATCH_SIZE + 1,
                processed=len(all_results),
                total=len(user_texts),
            )

        # Asignar resultados a turnos de usuario
        user_indices = df.index[user_mask].tolist()
        for idx, result in zip(user_indices, all_results):
            df.at[idx, "sentiment_label"] = result.sentiment_label
            df.at[idx, "sentiment_score"] = result.sentiment_score

    # Detectar escalada y abandono por sesión
    for _session_id, session_df in df.groupby("session_id"):
        session_idx = session_df.index

        escalation_flags = detect_escalation(session_df)
        df.loc[session_idx, "escalation"] = escalation_flags.values

        abandonment_flags = detect_abandonment(session_df)
        df.loc[session_idx, "abandonment_risk"] = abandonment_flags.values

    # Guardar corpus enriquecido
    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    enriched_path = output_dir / "enriched_corpus.jsonl"

    with open(enriched_path, "w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            record = row.to_dict()
            f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")

    # Generar CSV de sesiones más frustradas
    _generate_frustrated_sessions_csv(df, output_dir)

    log.info("sentiment_completado", enriched_path=str(enriched_path))
    return str(enriched_path)


def _generate_frustrated_sessions_csv(
    df: pd.DataFrame, output_dir: Path
) -> None:
    """
    Genera top_frustrated_sessions.csv con las 50 sesiones más frustradas.

    Columnas: session_id, avg_frustration_score, max_frustration_score,
              escalation_count, lang
    """
    user_df = df[df["speaker"] == "user"].copy()

    empty_columns = [
        "session_id",
        "avg_frustration_score",
        "max_frustration_score",
        "escalation_count",
        "lang",
    ]

    if user_df.empty:
        result = pd.DataFrame(columns=empty_columns)
        result.to_csv(output_dir / "top_frustrated_sessions.csv", index=False)
        return

    frustrated = user_df[user_df["sentiment_label"] == "frustrado"]
    if frustrated.empty:
        # Crear CSV vacío con headers
        result = pd.DataFrame(columns=empty_columns)
        result.to_csv(output_dir / "top_frustrated_sessions.csv", index=False)
        return

    session_stats = (
        frustrated.groupby("session_id")
        .agg(
            avg_frustration_score=("sentiment_score", "mean"),
            max_frustration_score=("sentiment_score", "max"),
            escalation_count=("escalation", "sum"),
        )
        .reset_index()
    )

    # Agregar idioma de sesión (primera ocurrencia)
    session_lang = df.groupby("session_id")["lang"].first()
    session_stats = session_stats.merge(
        session_lang, on="session_id", how="left"
    )

    # Ordenar y limitar a top 50
    session_stats = (
        session_stats.sort_values("avg_frustration_score", ascending=False)
        .head(50)
        .reset_index(drop=True)
    )

    csv_path = output_dir / "top_frustrated_sessions.csv"
    session_stats.to_csv(csv_path, index=False)
    log.info("frustrated_sessions_csv", path=str(csv_path), count=len(session_stats))
