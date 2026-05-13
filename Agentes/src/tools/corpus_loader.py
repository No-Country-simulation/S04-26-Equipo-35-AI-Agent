"""
Corpus Loader — Utilidad para carga y validación del corpus CSV.

Funciones compartidas para cargar, validar y preprocesar el corpus
de conversaciones antes de ser procesado por el pipeline.

Columnas requeridas del CSV real:
  session_id, usuario, fecha, region, intencion, nivel_frustracion,
  texto_espanol, texto_portugues, es_churn_risk
"""
from pathlib import Path
from typing import Any

import pandas as pd
import structlog

log = structlog.get_logger()

REQUIRED_COLUMNS = {
    "session_id", "usuario", "fecha", "region", "intencion",
    "nivel_frustracion", "texto_espanol", "texto_portugues", "es_churn_risk",
}


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
    df = pd.read_csv(path, encoding="utf-8-sig")

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
        Dict con estadísticas del corpus.
    """
    stats: dict[str, Any] = {
        "total_rows": len(df),
        "total_sessions": int(df["session_id"].nunique()),
    }

    if "region" in df.columns:
        stats["regions"] = df["region"].value_counts().to_dict()

    if "fecha" in df.columns:
        stats["date_range"] = {
            "min": str(df["fecha"].min()),
            "max": str(df["fecha"].max()),
        }

    if "intencion" in df.columns:
        stats["intenciones"] = df["intencion"].value_counts().to_dict()

    if "nivel_frustracion" in df.columns:
        stats["frustracion_promedio"] = round(float(df["nivel_frustracion"].mean()), 2)

    return stats
