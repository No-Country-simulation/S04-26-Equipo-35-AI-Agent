"""
ETL Agent — Limpieza y normalización del corpus de soporte.

Lee el CSV mensual crudo, limpia y normaliza los mensajes en ES/PT,
segmenta en turnos y escribe data/processed/processed_corpus.jsonl.

Leer skills/skill_etl.md antes de modificar este archivo.
"""
import asyncio
import json
import re
from pathlib import Path
from typing import Literal

import pandas as pd
import structlog
from langdetect import LangDetectException, detect
from pydantic import BaseModel, ValidationError, field_validator

log = structlog.get_logger()

# ── Schema de salida ─────────────────────────────────────────────────────────


class ProcessedTurn(BaseModel):
    """Schema estricto para cada turno procesado del corpus."""

    session_id: str
    turn_id: int
    speaker: Literal["user", "bot"]
    text_clean: str
    lang: Literal["es", "pt"]

    @field_validator("text_clean")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text_clean no puede estar vacío")
        return v


# ── Columnas requeridas ──────────────────────────────────────────────────────

REQUIRED_COLUMNS = {"session_id", "timestamp", "speaker", "text"}

# ── Mapeo de speaker ─────────────────────────────────────────────────────────

SPEAKER_MAP = {"system": "bot", "agent": "bot", "bot": "bot", "user": "user"}

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
    # 1. Timestamps inline: [12:34] o [12:34:56]
    (re.compile(r"\[\d{1,2}:\d{2}(:\d{2})?\]"), ""),
    # 2. IDs embebidos: #SES-12345, TICKET-123
    (re.compile(r"#[A-Z]+-\d+"), ""),
    # 3. HTML tags y entidades
    (re.compile(r"<[^>]+>"), ""),
    (re.compile(r"&\w+;"), ""),
    # 4. URLs → [URL]
    (re.compile(r"https?://\S+"), "[URL]"),
]

# Caracteres repetidos: noooo → no
_REPEATED_CHARS = re.compile(r"(.)\1{3,}")

# Espacios múltiples
_MULTIPLE_SPACES = re.compile(r"\s+")


# ── Funciones de limpieza ────────────────────────────────────────────────────


def _clean_text(text: str) -> str:
    """
    Aplica pipeline de limpieza en el orden definido por skill_etl.md.

    Orden:
    1. Timestamps inline
    2. IDs embebidos
    3. HTML tags/entidades
    4. URLs → [URL]
    5. Emojis frustración → [EMOJI_FRUSTRADO]
    6. Resto de emojis → ""
    7. Caracteres repetidos
    8. Lowercase
    9. Espacios múltiples → " "
    10. Strip
    """
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


def _map_speaker(speaker: str) -> str | None:
    """Mapea speaker al valor normalizado. Retorna None si no es válido."""
    return SPEAKER_MAP.get(speaker.lower().strip())


def _detect_session_language(texts: list[str]) -> Literal["es", "pt"]:
    """
    Detecta el idioma dominante de una sesión.

    Si >70% de los mensajes detectables son de un idioma, asigna ese.
    Default: 'es' si no se puede determinar.
    """
    lang_counts: dict[str, int] = {"es": 0, "pt": 0}
    total_detected = 0

    for text in texts:
        if not text or len(text.strip()) < 3:
            continue
        try:
            detected = detect(text)
            if detected in lang_counts:
                lang_counts[detected] += 1
                total_detected += 1
        except LangDetectException:
            continue

    if total_detected == 0:
        return "es"

    for lang, count in lang_counts.items():
        if count / total_detected > 0.7:
            return lang  # type: ignore[return-value]

    # Si no hay idioma dominante, usar el más frecuente
    return max(lang_counts, key=lang_counts.get)  # type: ignore[arg-type,return-value]


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_etl_pipeline(corpus_path: str) -> dict[str, int | float]:
    """
    Ejecuta el pipeline ETL completo sobre el corpus.

    Args:
        corpus_path: Path al CSV mensual de entrada.

    Returns:
        Diccionario con estadísticas: total_msgs, total_sessions,
        pct_es, pct_pt, avg_turns_per_session, discarded_msgs.
    """
    path = Path(corpus_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus no encontrado: {path}")

    log.info("etl_starting", corpus_path=str(path))

    # 1. Cargar CSV y validar columnas
    df = pd.read_csv(path)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise RuntimeError(f"Columnas faltantes en corpus: {missing}")

    initial_count = len(df)
    discarded = 0

    # 2. Mapear speaker → normalizar
    df["speaker_mapped"] = df["speaker"].apply(_map_speaker)
    invalid_speakers = df["speaker_mapped"].isna()
    if invalid_speakers.any():
        invalid_count = invalid_speakers.sum()
        for _, row in df[invalid_speakers].iterrows():
            log.warning(
                "speaker_invalido",
                session_id=row["session_id"],
                speaker=row["speaker"],
            )
        df = df[~invalid_speakers].copy()
        discarded += invalid_count

    df["speaker"] = df["speaker_mapped"]
    df = df.drop(columns=["speaker_mapped"])

    # 3. Detectar idioma por sesión
    session_texts = df.groupby("session_id")["text"].apply(list)
    session_langs = {
        sid: _detect_session_language(texts)
        for sid, texts in session_texts.items()
    }

    # 4. Limpiar texto
    df["text_clean"] = df["text"].apply(_clean_text)

    # 5. Descartar turnos con text_clean vacío
    empty_mask = df["text_clean"].str.strip() == ""
    if empty_mask.any():
        empty_count = empty_mask.sum()
        log.info("turnos_vacios_descartados", count=int(empty_count))
        df = df[~empty_mask].copy()
        discarded += empty_count

    # 6. Asignar turn_id incremental por sesión
    df = df.sort_values(["session_id", "timestamp"]).reset_index(drop=True)
    df["turn_id"] = df.groupby("session_id").cumcount()

    # 7. Asignar idioma de sesión
    df["lang"] = df["session_id"].map(session_langs)

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
                speaker=row["speaker"],
                text_clean=row["text_clean"],
                lang=row["lang"],
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
    lang_counts = df["lang"].value_counts()
    total_with_lang = lang_counts.sum()

    stats: dict[str, int | float] = {
        "total_msgs": len(valid_turns),
        "total_sessions": total_sessions,
        "pct_es": round(
            (lang_counts.get("es", 0) / total_with_lang * 100)
            if total_with_lang > 0
            else 0,
            1,
        ),
        "pct_pt": round(
            (lang_counts.get("pt", 0) / total_with_lang * 100)
            if total_with_lang > 0
            else 0,
            1,
        ),
        "avg_turns_per_session": round(
            len(valid_turns) / total_sessions if total_sessions > 0 else 0, 1
        ),
        "discarded_msgs": discarded,
    }

    log.info("etl_completado", **stats)
    return stats
