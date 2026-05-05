"""
Aggregator — Utilidades de agregación de métricas.

Funciones para agregar y combinar métricas del corpus enriquecido,
usadas por el Analyst Agent y el Dashboard.
"""
import json
from pathlib import Path
from typing import Any

import pandas as pd
import structlog

log = structlog.get_logger()


def aggregate_by_session(df: pd.DataFrame) -> pd.DataFrame:
    """
    Agrega métricas a nivel de sesión.

    Args:
        df: DataFrame con corpus enriquecido.

    Returns:
        DataFrame con una fila por sesión y métricas agregadas.
    """
    user_df = df[df["speaker"] == "user"]

    if user_df.empty:
        return pd.DataFrame()

    agg = user_df.groupby("session_id").agg(
        total_turns=("turn_id", "count"),
        lang=("lang", "first"),
        avg_sentiment_score=("sentiment_score", "mean"),
        max_sentiment_score=("sentiment_score", "max"),
        has_escalation=("escalation", "any"),
        has_abandonment=("abandonment_risk", "any"),
        dominant_intent=("intent_label", lambda x: x.mode().iloc[0] if not x.mode().empty else None),
        resolution_rate=("resolved", lambda x: x.mean() if x.notna().any() else None),
    ).reset_index()

    return agg


def aggregate_by_intent(df: pd.DataFrame) -> pd.DataFrame:
    """
    Agrega métricas a nivel de intención.

    Args:
        df: DataFrame con corpus enriquecido.

    Returns:
        DataFrame con una fila por intent y métricas agregadas.
    """
    user_df = df[
        (df["speaker"] == "user") & (df["intent_label"].notna())
    ]

    if user_df.empty:
        return pd.DataFrame()

    agg = user_df.groupby("intent_label").agg(
        total_occurrences=("session_id", "count"),
        avg_confidence=("intent_confidence", "mean"),
        resolution_rate=("resolved", "mean"),
        avg_frustration=("sentiment_score", lambda x: x[user_df.loc[x.index, "sentiment_label"] == "frustrado"].mean()),
        sessions_count=("session_id", "nunique"),
    ).reset_index()

    return agg


def aggregate_by_language(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """
    Compara métricas entre ES y PT.

    Args:
        df: DataFrame con corpus enriquecido.

    Returns:
        Dict con métricas por idioma: {es: {...}, pt: {...}}.
    """
    result: dict[str, dict[str, Any]] = {}

    for lang in ["es", "pt"]:
        lang_df = df[df["lang"] == lang]
        user_lang = lang_df[lang_df["speaker"] == "user"]

        if user_lang.empty:
            result[lang] = {
                "sessions": 0,
                "avg_frustration": 0.0,
                "resolution_rate": 0.0,
                "escalation_rate": 0.0,
                "abandonment_rate": 0.0,
            }
            continue

        total_sessions = lang_df["session_id"].nunique()
        frustrated = user_lang[user_lang["sentiment_label"] == "frustrado"]

        with_resolved = user_lang[user_lang["resolved"].notna()]
        res_rate = (
            float(with_resolved["resolved"].mean())
            if len(with_resolved) > 0
            else 0.0
        )

        sessions_escalated = lang_df[lang_df["escalation"] == True]["session_id"].nunique()  # noqa: E712
        sessions_abandoned = lang_df[lang_df["abandonment_risk"] == True]["session_id"].nunique()  # noqa: E712

        result[lang] = {
            "sessions": int(total_sessions),
            "avg_frustration": round(
                float(frustrated["sentiment_score"].mean()), 2
            ) if not frustrated.empty else 0.0,
            "resolution_rate": round(res_rate, 3),
            "escalation_rate": round(
                sessions_escalated / total_sessions, 3
            ) if total_sessions > 0 else 0.0,
            "abandonment_rate": round(
                sessions_abandoned / total_sessions, 3
            ) if total_sessions > 0 else 0.0,
        }

    return result


def save_metrics_json(
    metrics: dict[str, Any], output_path: str | Path
) -> None:
    """
    Guarda métricas en formato JSON.

    Args:
        metrics: Dict con las métricas a guardar.
        output_path: Path de salida del archivo JSON.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False, default=str)

    log.info("metrics_saved", path=str(path))
