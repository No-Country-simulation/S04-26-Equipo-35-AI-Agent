"""
ETL Agent — Limpieza y normalización del corpus de soporte.

Lee el CSV real (data_conversa_ai.csv) con columnas:
  session_id, usuario, fecha, region, intencion, nivel_frustracion,
  texto_espanol, texto_portugues, es_churn_risk

Limpia y normaliza los textos bilingües, selecciona el texto principal
según la región (ES para LATAM/EUROPE, PT para BRAZIL), y escribe
el corpus procesado en JSONL.

Cuando use_db=True, persiste a Supabase y Qdrant.
"""
import json
import re
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Literal

import pandas as pd
import structlog
from pydantic import BaseModel, Field, ValidationError, field_validator

log = structlog.get_logger()

# ── Schema de salida ─────────────────────────────────────────────────────────


class ProcessedTurn(BaseModel):
    """Schema estricto para cada turno procesado del corpus."""

    session_id: str
    turn_id: int
    usuario: str
    fecha: str
    region: Literal["LATAM", "BRAZIL", "EUROPE"]
    lang: Literal["es", "pt"]
    text_clean: str
    texto_espanol: str = ""
    texto_portugues: str = ""
    intencion_original: str = ""
    nivel_frustracion: int = Field(ge=0, le=2)
    es_churn_risk: bool = False

    @field_validator("text_clean")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text_clean no puede estar vacío")
        return v


# ── Columnas requeridas del CSV real ─────────────────────────────────────────

REQUIRED_COLUMNS = {
    "session_id", "usuario", "fecha", "region", "intencion",
    "nivel_frustracion", "texto_espanol", "texto_portugues", "es_churn_risk",
}

# ── Mapeo region → idioma ────────────────────────────────────────────────────

REGION_LANG_MAP: dict[str, Literal["es", "pt"]] = {
    "LATAM": "es",
    "BRAZIL": "pt",
    "EUROPE": "es",  # Default a español para Europa
}

# ── Regex de limpieza (orden importa) ────────────────────────────────────────

# Emojis de frustración → token semántico
_FRUSTRATION_EMOJIS = re.compile(r"[😤😡🤬]")

# Emojis restantes → eliminar
_ALL_EMOJIS = re.compile(
    r"[\U0001F600-\U0001F64F"
    r"\U0001F300-\U0001F5FF"
    r"\U0001F680-\U0001F6FF"
    r"\U0001F1E0-\U0001F1FF"
    r"\U00002702-\U000027B0"
    r"\U000024C2-\U0001F251"
    r"\U0001F900-\U0001F9FF"
    r"\U0001FA00-\U0001FA6F"
    r"\U0001FA70-\U0001FAFF]+",
    flags=re.UNICODE,
)

_CLEANING_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Timestamps inline: [12:34] o [12:34:56]
    (re.compile(r"\[\d{1,2}:\d{2}(:\d{2})?\]"), ""),
    # IDs embebidos: #SES-12345, TICKET-123
    (re.compile(r"#[A-Z]+-\d+"), ""),
    # HTML tags y entidades
    (re.compile(r"<[^>]+>"), ""),
    (re.compile(r"&\w+;"), ""),
    # URLs → [URL]
    (re.compile(r"https?://\S+"), "[URL]"),
]

# Caracteres repetidos: noooo → no
_REPEATED_CHARS = re.compile(r"(.)\1{3,}")

# Espacios múltiples
_MULTIPLE_SPACES = re.compile(r"\s+")


# ── Funciones de limpieza ────────────────────────────────────────────────────


def _clean_text(text: str) -> str:
    """Aplica pipeline de limpieza al texto."""
    if not text or not isinstance(text, str):
        return ""

    # Patrones secuenciales
    for pattern, replacement in _CLEANING_PATTERNS:
        text = pattern.sub(replacement, text)

    # Emojis de frustración → token semántico
    text = _FRUSTRATION_EMOJIS.sub("[EMOJI_FRUSTRADO]", text)

    # Resto de emojis → eliminar
    text = _ALL_EMOJIS.sub("", text)

    # Caracteres repetidos: nooooo → no
    text = _REPEATED_CHARS.sub(r"\1", text)

    # Lowercase
    text = text.lower()

    # Espacios múltiples
    text = _MULTIPLE_SPACES.sub(" ", text)

    return text.strip()


def _select_text_by_region(row: pd.Series) -> str:
    """
    Selecciona el texto principal según la región.

    LATAM/EUROPE → texto_espanol
    BRAZIL → texto_portugues
    """
    region = str(row.get("region", "LATAM")).upper()
    if region == "BRAZIL":
        text = row.get("texto_portugues", "")
    else:
        text = row.get("texto_espanol", "")

    # Fallback: si el texto seleccionado está vacío, usar el otro
    if not text or (isinstance(text, float) and pd.isna(text)):
        text = row.get("texto_espanol", "") or row.get("texto_portugues", "")

    return str(text) if text and not (isinstance(text, float) and pd.isna(text)) else ""


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_etl_pipeline(
    corpus_path: str,
    use_db: bool = False,
    on_progress: "Callable[[int, int, str], None] | None" = None,
) -> dict[str, int | float]:
    """
    Ejecuta el pipeline ETL sobre el corpus real.

    Args:
        corpus_path: Path al CSV (data_conversa_ai.csv).
        use_db: Si True, persiste a Supabase y Qdrant.

    Returns:
        Estadísticas del procesamiento.
    """
    path = Path(corpus_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus no encontrado: {path}")

    log.info("etl_starting", corpus_path=str(path), use_db=use_db)

    # 1. Cargar CSV y validar columnas
    df = pd.read_csv(path, encoding="utf-8-sig")  # utf-8-sig maneja BOM
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise RuntimeError(f"Columnas faltantes en corpus: {missing}")

    discarded = 0

    # 2. Normalizar región
    df["region"] = df["region"].str.upper().str.strip()
    invalid_regions = ~df["region"].isin(REGION_LANG_MAP.keys())
    if invalid_regions.any():
        count = int(invalid_regions.sum())
        log.warning("regiones_invalidas_descartadas", count=count)
        df = df[~invalid_regions].copy()
        discarded += count

    # 3. Derivar idioma desde región
    df["lang"] = df["region"].map(REGION_LANG_MAP)

    # 4. Seleccionar texto principal y limpiar
    df["text_raw"] = df.apply(_select_text_by_region, axis=1)
    df["text_clean"] = df["text_raw"].apply(_clean_text)

    # 5. Descartar filas con texto vacío
    empty_mask = df["text_clean"].str.strip() == ""
    if empty_mask.any():
        empty_count = int(empty_mask.sum())
        log.info("turnos_vacios_descartados", count=empty_count)
        df = df[~empty_mask].copy()
        discarded += empty_count

    # 6. Asignar turn_id incremental por sesión (ordenado por fecha)
    df = df.sort_values(["session_id", "fecha"]).reset_index(drop=True)
    df["turn_id"] = df.groupby("session_id").cumcount()

    # 7. Normalizar tipos
    df["es_churn_risk"] = df["es_churn_risk"].astype(bool)
    df["nivel_frustracion"] = df["nivel_frustracion"].fillna(0).astype(int)
    df["texto_espanol"] = df["texto_espanol"].fillna("")
    df["texto_portugues"] = df["texto_portugues"].fillna("")
    df["intencion"] = df["intencion"].fillna("otra")
    df["usuario"] = df["usuario"].fillna("unknown")

    # 8. Validar con Pydantic y escribir JSONL
    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "processed_corpus.jsonl"

    valid_turns: list[dict] = []
    validation_errors = 0

    for _, row in df.iterrows():
        try:
            turn = ProcessedTurn(
                session_id=row["session_id"],
                turn_id=int(row["turn_id"]),
                usuario=row["usuario"],
                fecha=str(row["fecha"]),
                region=row["region"],
                lang=row["lang"],
                text_clean=row["text_clean"],
                texto_espanol=row["texto_espanol"],
                texto_portugues=row["texto_portugues"],
                intencion_original=row["intencion"],
                nivel_frustracion=int(row["nivel_frustracion"]),
                es_churn_risk=bool(row["es_churn_risk"]),
            )
            valid_turns.append(turn.model_dump())
        except ValidationError as e:
            log.warning(
                "pydantic_validation_error",
                session_id=row["session_id"],
                error=str(e),
            )
            validation_errors += 1

    discarded += validation_errors

    with open(output_path, "w", encoding="utf-8") as f:
        for turn_dict in valid_turns:
            f.write(json.dumps(turn_dict, ensure_ascii=False) + "\n")

    # 9. Calcular estadísticas
    total_sessions = df["session_id"].nunique()
    region_counts = df["region"].value_counts()

    stats: dict[str, int | float] = {
        "total_msgs": len(valid_turns),
        "total_sessions": total_sessions,
        "pct_latam": round(
            region_counts.get("LATAM", 0) / len(df) * 100, 1
        ) if len(df) > 0 else 0,
        "pct_brazil": round(
            region_counts.get("BRAZIL", 0) / len(df) * 100, 1
        ) if len(df) > 0 else 0,
        "pct_europe": round(
            region_counts.get("EUROPE", 0) / len(df) * 100, 1
        ) if len(df) > 0 else 0,
        "avg_turns_per_session": round(
            len(valid_turns) / total_sessions if total_sessions > 0 else 0, 1
        ),
        "discarded_msgs": discarded,
    }

    # 10. Persistir a bases de datos
    if use_db and valid_turns:
        await _persist_to_databases(valid_turns, on_progress=on_progress)

    log.info("etl_completado", **stats)
    return stats


# ── Persistencia a bases de datos ────────────────────────────────────────────


async def _persist_to_databases(
    valid_turns: list[dict],
    on_progress: "Callable[[int, int, str], None] | None" = None,
) -> None:
    """
    Persiste los datos limpios a Supabase (SQL) y Qdrant (vectorial).
    """
    from qdrant_client.models import PointStruct

    from src.db.embeddings import embed_texts
    from src.db.qdrant_store import (
        COLLECTION_NAME,
        ensure_collection_exists,
        get_qdrant,
    )
    from src.db.supabase_client import get_supabase

    log.info("db_persist_starting", total_turns=len(valid_turns))

    sb = get_supabase()
    qdrant = get_qdrant()
    ensure_collection_exists(qdrant)

    # ── 1. Insertar sesiones ─────────────────────────────────────────────
    sessions_map: dict[str, dict] = {}
    for turn in valid_turns:
        sid = turn["session_id"]
        if sid not in sessions_map:
            sessions_map[sid] = {
                "id": sid,
                "usuario": turn["usuario"],
                "region": turn["region"],
                "total_turns": 0,
                "is_churn_risk": turn["es_churn_risk"],
            }
        sessions_map[sid]["total_turns"] += 1

    session_rows = list(sessions_map.values())
    if session_rows:
        sb.table("sessions").upsert(session_rows, on_conflict="id").execute()
        log.info("db_sessions_upserted", count=len(session_rows))

    # ── 2. Insertar mensajes ─────────────────────────────────────────────
    message_rows: list[dict] = []
    user_texts: list[str] = []
    user_point_ids: list[str] = []
    user_metadata: list[dict] = []

    for turn in valid_turns:
        point_id = str(uuid.uuid4())
        user_texts.append(turn["text_clean"])
        user_point_ids.append(point_id)
        user_metadata.append({
            "session_id": turn["session_id"],
            "turn_id": turn["turn_id"],
            "lang": turn["lang"],
            "region": turn["region"],
            "text_preview": turn["text_clean"][:200],
            "intencion_original": turn["intencion_original"],
            "nivel_frustracion": turn["nivel_frustracion"],
        })

        message_rows.append({
            "session_id": turn["session_id"],
            "turn_id": turn["turn_id"],
            "fecha": turn["fecha"],
            "region": turn["region"],
            "texto_espanol": turn["texto_espanol"],
            "texto_portugues": turn["texto_portugues"],
            "text_clean": turn["text_clean"],
            "intencion_original": turn["intencion_original"],
            "nivel_frustracion": turn["nivel_frustracion"],
            "es_churn_risk": turn["es_churn_risk"],
            "qdrant_point_id": point_id,
        })

    # Upsert en batches de 500
    batch_size = 500
    for i in range(0, len(message_rows), batch_size):
        batch = message_rows[i : i + batch_size]
        sb.table("messages").upsert(
            batch, on_conflict="session_id,turn_id"
        ).execute()
    log.info("db_messages_upserted", count=len(message_rows))

    # ── 3. Embeddings + Qdrant ───────────────────────────────────────────
    import os
    skip_embeddings = os.getenv("SKIP_EMBEDDINGS", "").lower() in ("1", "true", "yes")
    if user_texts and not skip_embeddings:
        def _embed_progress(done: int, total: int) -> None:
            if on_progress:
                on_progress(done, total, "etl_embeddings")
        vectors = embed_texts(user_texts, on_progress=_embed_progress)
        points = [
            PointStruct(id=pid, vector=vec, payload=meta)
            for pid, vec, meta in zip(user_point_ids, vectors, user_metadata)
        ]
        qdrant_batch = 100
        for i in range(0, len(points), qdrant_batch):
            qdrant.upsert(
                collection_name=COLLECTION_NAME,
                points=points[i : i + qdrant_batch],
            )
        log.info("qdrant_points_upserted", count=len(points))
    elif skip_embeddings:
        log.info("qdrant_embeddings_skipped", reason="SKIP_EMBEDDINGS=true")

    log.info("db_persist_completed")
