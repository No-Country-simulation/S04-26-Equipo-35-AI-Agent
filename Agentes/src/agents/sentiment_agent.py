"""
Sentiment Agent — Clasificación emocional del corpus.

Lee processed_corpus.jsonl (todos los mensajes son de usuarios),
clasifica el tono emocional (frustrado/neutro/satisfecho), y detecta
escalada y riesgo de abandono.

Aprovecha nivel_frustracion (0-2) del CSV como señal adicional
para calibrar la clasificación del LLM.

Cuando use_db=True, persiste resultados a Supabase.
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Any, Literal

import pandas as pd
import structlog
from pydantic import BaseModel, Field, ValidationError

from src.core.llm.client import get_llm

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
Clasifica el sentimiento de cada mensaje de soporte al cliente (ES-LATAM o PT-BR).
Label: frustrado | neutro | satisfecho. Score: 0.0-1.0. Nivel_frust: señal extra (0=bajo,2=alto).

Mensajes (JSON array):
{batch_json}

Responde ONLY con un JSON array del mismo tamaño, sin texto extra:
[{{"label":"...","score":0.0}}, ...]
"""


# ── Clasificación con LLM ───────────────────────────────────────────────────


MINI_BATCH = int(os.getenv("SENTIMENT_MINI_BATCH", "10"))


async def _classify_sentiment_batch(
    texts: list[str],
    niveles: list[int],
) -> list[SentimentResult]:
    """
    Clasifica sentimiento para un batch de textos usando el LLM.
    Envía MINI_BATCH mensajes por llamada para reducir uso de tokens.
    """
    llm = get_llm(role="smart")
    results: list[SentimentResult] = []

    for chunk_start in range(0, len(texts), MINI_BATCH):
        chunk_texts = texts[chunk_start:chunk_start + MINI_BATCH]
        chunk_niveles = niveles[chunk_start:chunk_start + MINI_BATCH]
        batch_items = [
            {"id": i, "text": t[:400], "nivel_frust": n}
            for i, (t, n) in enumerate(zip(chunk_texts, chunk_niveles))
        ]
        prompt = SENTIMENT_PROMPT.format(batch_json=json.dumps(batch_items, ensure_ascii=False))
        try:
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            raw = json.loads(content)
            if not isinstance(raw, list):
                raise ValueError("expected list")
            for item in raw:
                try:
                    label = item.get("label", "neutro")
                    score = float(item.get("score", 0.5))
                    results.append(SentimentResult(
                        sentiment_label=label if label in ("frustrado", "neutro", "satisfecho") else "neutro",
                        sentiment_score=max(0.0, min(1.0, score)),
                    ))
                except Exception:
                    results.append(SentimentResult(sentiment_label="neutro", sentiment_score=0.5))
            if len(results) < chunk_start + len(chunk_texts):
                for _ in range(chunk_start + len(chunk_texts) - len(results)):
                    results.append(SentimentResult(sentiment_label="neutro", sentiment_score=0.5))
        except Exception as e:
            log.warning("sentiment_chunk_failed", error=str(e), chunk_start=chunk_start)
            for n in chunk_niveles:
                results.append(_fallback_from_nivel(n))
        continue

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
    if "nivel_frustracion" in session_turns.columns:
        niveles = session_turns["nivel_frustracion"].fillna(0).astype(int)
        if len(niveles) >= 2:
            nivel_diffs = niveles.diff()
            nivel_escalation = (nivel_diffs > 0) & (niveles >= 2)
            escalation = escalation | nivel_escalation

    # También escalada si misma frase repetida > 2 veces
    if "text_clean" in session_turns.columns:
        from collections import Counter
        texts = session_turns["text_clean"].dropna().tolist()
        text_counts = Counter(texts)
        repeated_texts = {t for t, c in text_counts.items() if c > 2 and len(t.strip()) > 0}
        if repeated_texts:
            for idx, row in session_turns.iterrows():
                if row.get("text_clean") in repeated_texts:
                    escalation.at[idx] = True

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
    df = pd.read_json(path, lines=True)

    # Inicializar columnas si no existen
    if "sentiment_label" not in df.columns:
        df["sentiment_label"] = None
    if "sentiment_score" not in df.columns:
        df["sentiment_score"] = None
    if "escalation" not in df.columns:
        df["escalation"] = False
    if "abandonment_risk" not in df.columns:
        df["abandonment_risk"] = False

    if use_db:
        from src.db.supabase_client import get_supabase
        sb = get_supabase()
        
        session_ids = df["session_id"].unique().tolist()
        db_rows = []
        chunk_size = 100
        for i in range(0, len(session_ids), chunk_size):
            chunk = session_ids[i : i + chunk_size]
            res = sb.table("messages").select(
                "session_id,turn_id,sentiment_label,sentiment_score,escalation,abandonment_risk"
            ).in_("session_id", chunk).execute()
            if res.data:
                db_rows.extend(res.data)
                
        if db_rows:
            db_df = pd.DataFrame(db_rows)
            df = df.merge(db_df, on=["session_id", "turn_id"], how="left", suffixes=("_local", ""))
            for col in ["sentiment_label", "sentiment_score", "escalation", "abandonment_risk"]:
                local_col = f"{col}_local"
                if local_col in df.columns:
                    df[col] = df[col].fillna(df[local_col])
                    df.drop(columns=[local_col], inplace=True)

    log.info("sentiment_starting", processed_path=str(path), rows=len(df))

    # Solo procesar filas sin label (resume desde donde se cortó)
    pending_mask = df["sentiment_label"].isna()
    pending_indices = df.index[pending_mask].tolist()
    already_done = len(df) - len(pending_indices)
    if already_done > 0:
        log.info("sentiment_resuming", already_labeled=already_done, pending=len(pending_indices))

    if pending_indices:
        texts = df.loc[pending_indices, "text_clean"].tolist()
        niveles = df.loc[pending_indices, "nivel_frustracion"].fillna(0).astype(int).tolist()

        all_results: list[SentimentResult] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch_texts = texts[i : i + BATCH_SIZE]
            batch_niveles = niveles[i : i + BATCH_SIZE]
            batch_results = await _classify_sentiment_batch(batch_texts, batch_niveles)
            all_results.extend(batch_results)

            # Actualizar df con resultados del batch
            batch_df_indices = pending_indices[i : i + BATCH_SIZE]
            for list_i, df_idx in enumerate(batch_df_indices[:len(batch_results)]):
                df.at[df_idx, "sentiment_label"] = batch_results[list_i].sentiment_label
                df.at[df_idx, "sentiment_score"] = batch_results[list_i].sentiment_score

            # Persistir batch a Supabase inmediatamente (checkpoint por batch)
            if use_db:
                await _persist_batch_sentiment_to_db(df.loc[batch_df_indices])

            log.info(
                "sentiment_batch_done",
                batch_num=i // BATCH_SIZE + 1,
                processed=already_done + len(all_results),
                total=len(df),
            )
            delay = float(os.getenv("LLM_BATCH_DELAY_SEC", "2"))
            if delay > 0 and i + BATCH_SIZE < len(texts):
                await asyncio.sleep(delay)

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


async def _persist_batch_sentiment_to_db(batch_df: pd.DataFrame) -> None:
    """Persiste un batch de filas con sentiment a Supabase (checkpoint por batch)."""
    from src.db.supabase_client import get_supabase
    sb = get_supabase()
    rows_to_upsert = []
    for _, row in batch_df.iterrows():
        score = row.get("sentiment_score")
        if row.get("sentiment_label") is None:
            continue
        rows_to_upsert.append({
            "session_id": row["session_id"],
            "turn_id": int(row["turn_id"]),
            "sentiment_label": row.get("sentiment_label"),
            "sentiment_score": float(score) if score is not None and str(score) != "nan" else None,
        })
    if rows_to_upsert:
        sb.table("messages").upsert(rows_to_upsert, on_conflict="session_id,turn_id").execute()
        log.debug("db_sentiment_batch_saved", count=len(rows_to_upsert))


async def _persist_sentiment_to_db(df: pd.DataFrame) -> None:
    """Actualiza las columnas de sentiment en Supabase usando batch upsert."""
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    log.info("db_sentiment_updating", count=len(df))

    # 1. Agrupar y subir mensajes en batches
    message_rows = []
    for _, row in df.iterrows():
        score = row.get("sentiment_score")
        message_rows.append({
            "session_id": row["session_id"],
            "turn_id": int(row["turn_id"]),
            "sentiment_label": row.get("sentiment_label"),
            "sentiment_score": float(score) if score is not None and str(score) != "nan" else None,
            "escalation": bool(row.get("escalation", False)),
            "abandonment_risk": bool(row.get("abandonment_risk", False)),
        })

    batch_size = 500
    for i in range(0, len(message_rows), batch_size):
        sb.table("messages").upsert(
            message_rows[i : i + batch_size],
            on_conflict="session_id,turn_id"
        ).execute()

    # 2. Agrupar y subir sesiones en batches
    session_rows = []
    for session_id, session_df in df.groupby("session_id"):
        frustrated = session_df[session_df["sentiment_label"] == "frustrado"]
        session_update: dict[str, Any] = {
            "id": session_id,
            "has_escalation": bool(session_df["escalation"].any()),
            "has_abandonment": bool(session_df["abandonment_risk"].any()),
        }
        if not frustrated.empty:
            scores = frustrated["sentiment_score"].dropna()
            if len(scores) > 0:
                session_update["avg_frustration_score"] = round(float(scores.mean()), 3)
                session_update["max_frustration_score"] = round(float(scores.max()), 3)
        session_rows.append(session_update)

    session_batch_size = 200
    for i in range(0, len(session_rows), session_batch_size):
        sb.table("sessions").upsert(
            session_rows[i : i + session_batch_size],
            on_conflict="id"
        ).execute()

    log.info("db_sentiment_updated", messages=len(message_rows), sessions=len(session_rows))


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
    if "region" in df.columns:
        session_region = df.groupby("session_id")["region"].first()
        session_stats = session_stats.merge(session_region, on="session_id", how="left")
    else:
        session_stats["region"] = None

    session_stats = (
        session_stats.sort_values("avg_frustration_score", ascending=False)
        .head(50)
        .reset_index(drop=True)
    )

    csv_path = output_dir / "top_frustrated_sessions.csv"
    session_stats.to_csv(csv_path, index=False)
    log.info("frustrated_sessions_csv", path=str(csv_path), count=len(session_stats))
