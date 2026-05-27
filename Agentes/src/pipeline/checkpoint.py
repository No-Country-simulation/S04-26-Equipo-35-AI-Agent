"""Checkpoint de ingesta por etapa."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

CheckpointStage = Literal["etl", "sentiment", "intent", "analyst", "completed"]

DEFAULT_PATH = Path("data/raw/ingestion_checkpoint.json")


def load(path: Path = DEFAULT_PATH) -> dict:
    if not path.exists():
        return {"stage": "etl", "corpus_path": ""}
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"stage": "etl", "corpus_path": ""}


def save(stage: CheckpointStage, corpus_path: str, path: Path = DEFAULT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = load(path)
    data["stage"] = stage
    data["corpus_path"] = corpus_path
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def clear(path: Path = DEFAULT_PATH) -> None:
    if path.exists():
        path.unlink()
