"""
Corpus Loader — Utilidad para carga y validación del corpus CSV.

Funciones compartidas para cargar, validar y preprocesar el corpus
de conversaciones antes de ser procesado por el pipeline.
"""
from pathlib import Path
from typing import Any

import pandas as pd
import structlog

log = structlog.get_logger()

REQUIRED_COLUMNS = {"session_id", "timestamp", "speaker", "text"}


def load_corpus(corpus_path: str | Path) -> pd.DataFrame:
    """
    Carga el corpus CSV y valida columnas requeridas.

    Args:
        corpus_path: Path al archivo CSV del corpus.

    Returns:
        DataFrame con el corpus cargado.

    Raises:
        FileNotFoundError: Si el archivo no existe.
        RuntimeError: Si faltan columnas requeridas.
    """
    path = Path(corpus_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus no encontrado: {path}")

    log.info("corpus_loading", path=str(path))
    df = pd.read_csv(path)

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise RuntimeError(f"Columnas faltantes en corpus: {missing}")

    log.info(
        "corpus_loaded",
        rows=len(df),
        columns=list(df.columns),
        sessions=df["session_id"].nunique(),
    )
    return df


def load_processed_corpus(processed_path: str | Path) -> pd.DataFrame:
    """
    Carga el corpus procesado en formato JSONL.

    Args:
        processed_path: Path al archivo JSONL procesado.

    Returns:
        DataFrame con el corpus procesado.

    Raises:
        FileNotFoundError: Si el archivo no existe.
    """
    path = Path(processed_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus procesado no encontrado: {path}")

    log.info("processed_corpus_loading", path=str(path))
    df = pd.read_json(path, lines=True)
    log.info("processed_corpus_loaded", rows=len(df))
    return df


def load_enriched_corpus(enriched_path: str | Path) -> pd.DataFrame:
    """
    Carga el corpus enriquecido con campos de sentiment e intent.

    Args:
        enriched_path: Path al archivo JSONL enriquecido.

    Returns:
        DataFrame con el corpus enriquecido.

    Raises:
        FileNotFoundError: Si el archivo no existe.
    """
    path = Path(enriched_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus enriquecido no encontrado: {path}")

    log.info("enriched_corpus_loading", path=str(path))
    df = pd.read_json(path, lines=True)
    log.info("enriched_corpus_loaded", rows=len(df))
    return df


def get_corpus_stats(df: pd.DataFrame) -> dict[str, Any]:
    """
    Calcula estadísticas básicas del corpus.

    Args:
        df: DataFrame con el corpus (cualquier etapa).

    Returns:
        Dict con estadísticas: total_rows, total_sessions,
        speakers, date_range.
    """
    stats: dict[str, Any] = {
        "total_rows": len(df),
        "total_sessions": int(df["session_id"].nunique()),
    }

    if "speaker" in df.columns:
        stats["speakers"] = df["speaker"].value_counts().to_dict()

    if "timestamp" in df.columns:
        stats["date_range"] = {
            "min": str(df["timestamp"].min()),
            "max": str(df["timestamp"].max()),
        }

    if "lang" in df.columns:
        stats["languages"] = df["lang"].value_counts().to_dict()

    return stats
