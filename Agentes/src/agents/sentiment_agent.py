"""
Sentiment Agent — Clasificación emocional del corpus.

Lee processed_corpus.jsonl (todos los mensajes son de usuarios),
clasifica el tono emocional (frustrado/neutro/satisfecho), y detecta
escalada y riesgo de abandono.

Aprovecha nivel_frustracion (0-2) del CSV como señal adicional
para calibrar la clasificación del LLM.

Cuando use_db=True, persiste resultados a Supabase.
"""
import json
import os
from pathlib import Path
from typing import Any, Literal

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

Clasifica el sentimiento del siguiente mensaje de un usuario.

Mensaje: {text}
Nivel de frustración preexistente (0=bajo, 1=medio, 2=alto): {nivel_frustracion}

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
- 0.9-1.0: Ira explosiva → "PÉSIMO", "ES UN ROBO", insultos

### neutro
- 0.4-0.6: Sin carga emocional → "cuánto debo", "quiero saber mi saldo"

### satisfecho
- 0.6-0.7: Aceptación → "ok, gracias"
- 0.8-1.0: Gratitud → "perfecto, funcionó", "excelente servicio"

## Señales Clave (ES LATAM)
- "no sirve", "pésimo", "qué mal" → frustrado
- "ya chole" (MX), "qué vaina" (CO) → frustrado 0.7+
- MAYÚSCULAS SOSTENIDAS → subir score +0.2
- Signos repetidos "???" "!!!" → subir score +0.1

## Señales Clave (PT-BR)
- "não funciona", "horrível", "que absurdo" → frustrado
- "péssimo atendimento" → frustrado 0.8+
- "obrigado", "funcionou", "resolvido" → satisfecho

## IMPORTANTE
- El nivel de frustración preexistente es una señal adicional:
  nivel 0 = probablemente neutro, nivel 2 = probablemente frustrado alto
- Tu clasificación debe basarse PRINCIPALMENTE en el texto
"""


# ── Clasificación con LLM ───────────────────────────────────────────────────


async def _classify_sentiment_batch(
    texts: list[str],
    niveles: list[int],
) -> list[SentimentResult]:
    """
    Clasifica sentimiento para un batch de textos usando el LLM.

    Args:
        texts: Lista de textos a clasificar.
        niveles: Lista de niveles de frustración (0-2) del CSV.

    Returns:
        Lista de SentimentResult.
    """
    llm = get_llm(role="smart")
    results: list[SentimentResult] = []

    for text, nivel in zip(texts, niveles):
        try:
            prompt = SENTIMENT_PROMPT.format(
                text=text, nivel_frustracion=nivel,
            )
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)

            parsed = json.loads(content)
            result = SentimentResult(
                sentiment_label=parsed.get("label", "neutro"),
                sentiment_score=parsed.get("score", 0.5),
            )
        except (json.JSONDecodeError, ValidationError, Exception) as e:
            log.warning("sentiment_parse_error", text=text[:50], error=str(e))
            # Fallback basado en nivel_frustracion
            result = _fallback_from_nivel(nivel)
        results.append(result)

    return results


def _fallback_from_nivel(nivel: int) -> SentimentResult:
    """Genera un SentimentResult de fallback basado en nivel_frustracion."""
    mapping = {
        0: SentimentResult(sentiment_label="neutro", sentiment_score=0.5),
        1: SentimentResult(sentiment_label="frustrado", sentiment_score=0.55),
        2: SentimentResult(sentiment_label="frustrado", sentiment_score=0.8),
    }
    return mapping.get(nivel, SentimentResult(sentiment_label="neutro", sentiment_score=0.5))


# ── Detección de escalada ────────────────────────────────────────────────────


def detect_escalation(session_turns: pd.DataFrame) -> pd.Series:
    """
    Detecta escalada emocional en una sesión.

    Condiciones:
    1. sentiment_score sube >0.3 entre turnos consecutivos
    2. nivel_frustracion sube de 1 a 2
    """
    escalation = pd.Series(False, index=session_turns.index)

    if len(session_turns) < 2:
        return escalation

    scores = session_turns["sentiment_score"].fillna(0.0)
    if len(scores) >= 2:
        score_diffs = scores.diff()
        rapid_increase = score_diffs > 0.3
        frustrado_mask = session_turns["sentiment_label"] == "frustrado"
        escalation = rapid_increase & frustrado_mask

    # También escalada si nivel_frustracion pasa de 1 a 2
    niveles = session_turns["nivel_frustracion"].fillna(0).astype(int)
    if len(niveles) >= 2:
        nivel_diffs = niveles.diff()
        nivel_escalation = (nivel_diffs > 0) & (niveles >= 2)
        escalation = escalation | nivel_escalation

    return escalation.fillna(False)


# ── Detección de abandono ────────────────────────────────────────────────────


def detect_abandonment(session_turns: pd.DataFrame) -> pd.Series:
    """
    Detecta riesgo de abandono.

    Condición: último turno tiene frustración alta (score > 0.7)
    o es_churn_risk=True.
    """
    abandonment = pd.Series(False, index=session_turns.index)

    if session_turns.empty:
        return abandonment

    last_idx = session_turns.index[-1]
    last_turn = session_turns.loc[last_idx]

    is_frustrated = (
        last_turn.get("sentiment_label") == "frustrado"
        and (last_turn.get("sentiment_score") or 0) > 0.7
    )
    is_churn = bool(last_turn.get("es_churn_risk", False))

    if is_frustrated or is_churn:
        abandonment.at[last_idx] = True

    return abandonment


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_sentiment_analysis(
    processed_path: str,
    use_db: bool = False,
) -> str:
    """
    Clasifica sentimiento en el corpus procesado.

    Args:
        processed_path: Path al processed_corpus.jsonl.
        use_db: Si True, persiste a Supabase.

    Returns:
        Path al enriched_corpus.jsonl.
    """
    path = Path(processed_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus procesado no encontrado: {path}")

    log.info("sentiment_starting", processed_path=str(path))

    df = pd.read_json(path, lines=True)

    # Inicializar columnas de sentiment
    df["sentiment_label"] = None
    df["sentiment_score"] = None
    df["escalation"] = False
    df["abandonment_risk"] = False

    # Clasificar todos los turnos (todos son de usuario en este dataset)
    texts = df["text_clean"].tolist()
    niveles = df["nivel_frustracion"].fillna(0).astype(int).tolist()

    if texts:
        all_results: list[SentimentResult] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch_texts = texts[i : i + BATCH_SIZE]
            batch_niveles = niveles[i : i + BATCH_SIZE]
            batch_results = await _classify_sentiment_batch(batch_texts, batch_niveles)
            all_results.extend(batch_results)
            log.info(
                "sentiment_batch_done",
                batch_num=i // BATCH_SIZE + 1,
                processed=len(all_results),
                total=len(texts),
            )

        for idx, result in enumerate(all_results):
            df.at[idx, "sentiment_label"] = result.sentiment_label
            df.at[idx, "sentiment_score"] = result.sentiment_score

    # Detectar escalada y abandono por sesión
    for _, session_df in df.groupby("session_id"):
        session_idx = session_df.index
        df.loc[session_idx, "escalation"] = detect_escalation(session_df).values
        df.loc[session_idx, "abandonment_risk"] = detect_abandonment(session_df).values

    # Guardar corpus enriquecido
    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    enriched_path = output_dir / "enriched_corpus.jsonl"

    with open(enriched_path, "w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            f.write(json.dumps(row.to_dict(), ensure_ascii=False, default=str) + "\n")

    # Generar CSV de sesiones más frustradas
    _generate_frustrated_sessions_csv(df, output_dir)

    if use_db:
        await _persist_sentiment_to_db(df)

    log.info("sentiment_completado", enriched_path=str(enriched_path))
    return str(enriched_path)


# ── Persistencia a Supabase ──────────────────────────────────────────────────


async def _persist_sentiment_to_db(df: pd.DataFrame) -> None:
    """Actualiza las columnas de sentiment en Supabase."""
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    log.info("db_sentiment_updating", count=len(df))

    for _, row in df.iterrows():
        score = row.get("sentiment_score")
        update_data = {
            "sentiment_label": row.get("sentiment_label"),
            "sentiment_score": (
                float(score)
                if score is not None and str(score) != "nan"
                else None
            ),
            "escalation": bool(row.get("escalation", False)),
            "abandonment_risk": bool(row.get("abandonment_risk", False)),
        }
        sb.table("messages").update(update_data).eq(
            "session_id", row["session_id"]
        ).eq("turn_id", int(row["turn_id"])).execute()

    # Actualizar métricas agregadas en sessions
    for session_id, session_df in df.groupby("session_id"):
        frustrated = session_df[session_df["sentiment_label"] == "frustrado"]
        session_update: dict[str, Any] = {
            "has_escalation": bool(session_df["escalation"].any()),
            "has_abandonment": bool(session_df["abandonment_risk"].any()),
        }
        if not frustrated.empty:
            scores = frustrated["sentiment_score"].dropna()
            if len(scores) > 0:
                session_update["avg_frustration_score"] = round(float(scores.mean()), 3)
                session_update["max_frustration_score"] = round(float(scores.max()), 3)
        sb.table("sessions").update(session_update).eq("id", session_id).execute()

    log.info("db_sentiment_updated")


# ── Top sesiones frustradas ──────────────────────────────────────────────────


def _generate_frustrated_sessions_csv(
    df: pd.DataFrame, output_dir: Path,
) -> None:
    """Genera top_frustrated_sessions.csv con las 50 sesiones más frustradas."""
    columns = [
        "session_id", "avg_frustration_score", "max_frustration_score",
        "escalation_count", "region",
    ]

    frustrated = df[df["sentiment_label"] == "frustrado"]
    if frustrated.empty:
        pd.DataFrame(columns=columns).to_csv(
            output_dir / "top_frustrated_sessions.csv", index=False,
        )
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

    # Agregar región de la sesión
    session_region = df.groupby("session_id")["region"].first()
    session_stats = session_stats.merge(session_region, on="session_id", how="left")

    session_stats = (
        session_stats.sort_values("avg_frustration_score", ascending=False)
        .head(50)
        .reset_index(drop=True)
    )

    csv_path = output_dir / "top_frustrated_sessions.csv"
    session_stats.to_csv(csv_path, index=False)
    log.info("frustrated_sessions_csv", path=str(csv_path), count=len(session_stats))
