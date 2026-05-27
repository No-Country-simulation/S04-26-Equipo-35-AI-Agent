"""
Capa unificada de persistencia — Supabase + Qdrant.

Usa los singletons `get_supabase()` y `get_qdrant()` y embeddings de Cohere.
"""
from __future__ import annotations

import uuid
from typing import Any

import structlog
from qdrant_client.models import PointStruct

from src.db.embeddings import embed_texts
from src.db.qdrant_store import COLLECTION_NAME, ensure_collection_exists, get_qdrant
from src.db.supabase_client import get_supabase

log = structlog.get_logger()

SESSION_KEYS = frozenset({
    "id", "usuario", "region", "total_turns", "avg_frustration_score",
    "max_frustration_score", "has_escalation", "has_abandonment",
    "dominant_intent", "resolution_rate", "is_churn_risk", "created_at",
})

MESSAGE_KEYS = frozenset({
    "session_id", "turn_id", "fecha", "region", "texto_espanol", "texto_portugues",
    "text_clean", "intencion_original", "nivel_frustracion", "es_churn_risk",
    "sentiment_label", "sentiment_score", "escalation", "abandonment_risk",
    "intent_label", "intent_confidence", "resolved", "qdrant_point_id",
})


def _normalize_region(region: str) -> str:
    region = (region or "").upper()
    if region in ("LATAM", "BRAZIL", "EUROPE"):
        return region
    if region in ("PORTUGAL", "SPAIN"):
        return "EUROPE"
    return "LATAM"


def save_session(session_data: dict[str, Any]) -> None:
    """Upsert de una sesión en Supabase."""
    clean = {k: v for k, v in session_data.items() if k in SESSION_KEYS}
    if "region" in clean:
        clean["region"] = _normalize_region(str(clean["region"]))
    try:
        get_supabase().table("sessions").upsert(clean, on_conflict="id").execute()
    except Exception as e:
        log.error("save_session_failed", session_id=clean.get("id"), error=str(e))


def save_message(message_data: dict[str, Any], *, embed: bool = True) -> None:
    """Upsert de mensaje en Supabase y opcionalmente vector en Qdrant."""
    clean = {k: v for k, v in message_data.items() if k in MESSAGE_KEYS}
    text = clean.get("text_clean") or ""
    point_id = clean.get("qdrant_point_id") or str(uuid.uuid4())
    clean["qdrant_point_id"] = point_id

    if embed and text:
        _upsert_qdrant_point(point_id, clean, text)

    try:
        get_supabase().table("messages").upsert(
            clean,
            on_conflict="session_id,turn_id",
        ).execute()
    except Exception as e:
        log.error(
            "save_message_failed",
            session_id=clean.get("session_id"),
            turn_id=clean.get("turn_id"),
            error=str(e),
        )


def upsert_messages_batch(rows: list[dict[str, Any]], *, embed: bool = True) -> None:
    """Inserta mensajes en batch (Supabase + Qdrant)."""
    if not rows:
        return

    if embed:
        texts = [r.get("text_clean", "") or "" for r in rows]
        try:
            qdrant = get_qdrant()
            ensure_collection_exists(qdrant)
            vectors = embed_texts([t or " " for t in texts])
            points = []
            for row, vec in zip(rows, vectors):
                pid = row.get("qdrant_point_id") or str(uuid.uuid4())
                row["qdrant_point_id"] = pid
                points.append(
                    PointStruct(
                        id=pid,
                        vector=vec,
                        payload={
                            "session_id": row.get("session_id"),
                            "turn_id": row.get("turn_id"),
                            "region": row.get("region"),
                            "lang": row.get("lang"),
                            "text_preview": (row.get("text_clean") or "")[:200],
                            "intencion_original": row.get("intencion_original"),
                            "nivel_frustracion": row.get("nivel_frustracion"),
                        },
                    )
                )
            qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
        except Exception as e:
            log.warning("qdrant_batch_upsert_failed", error=str(e))

    clean_rows = []
    for row in rows:
        clean = {k: v for k, v in row.items() if k in MESSAGE_KEYS}
        if "qdrant_point_id" not in clean:
            clean["qdrant_point_id"] = str(uuid.uuid4())
        clean_rows.append(clean)

    batch_size = 500
    sb = get_supabase()
    for i in range(0, len(clean_rows), batch_size):
        try:
            sb.table("messages").upsert(
                clean_rows[i : i + batch_size],
                on_conflict="session_id,turn_id",
            ).execute()
        except Exception as e:
            log.error("messages_batch_upsert_failed", offset=i, error=str(e))


def _upsert_qdrant_point(point_id: str, row: dict[str, Any], text: str) -> None:
    try:
        qdrant = get_qdrant()
        ensure_collection_exists(qdrant)
        vector = embed_texts([text])[0]
        qdrant.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "session_id": row.get("session_id"),
                        "turn_id": row.get("turn_id"),
                        "region": row.get("region"),
                        "text_preview": text[:200],
                        "intencion_original": row.get("intencion_original"),
                        "sentiment_label": row.get("sentiment_label"),
                        "intent_label": row.get("intent_label"),
                    },
                )
            ],
        )
    except Exception as e:
        log.warning("qdrant_point_upsert_failed", error=str(e))


def log_pipeline_run(
    corpus_file: str,
    status: str,
    *,
    total_messages: int = 0,
    error_message: str | None = None,
) -> None:
    """Registra ejecución en pipeline_runs."""
    row: dict[str, Any] = {
        "corpus_file": corpus_file,
        "status": status,
        "total_messages": total_messages,
    }
    if error_message:
        row["error_message"] = error_message[:500]
    if status == "completed":
        from datetime import datetime, timezone

        row["completed_at"] = datetime.now(timezone.utc).isoformat()
    try:
        get_supabase().table("pipeline_runs").insert(row).execute()
    except Exception as e:
        log.warning("pipeline_run_log_failed", error=str(e))
