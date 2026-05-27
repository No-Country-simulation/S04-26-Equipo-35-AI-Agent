"""
Orquestador del pipeline ConversaAI (sin CrewAI).

ETL → Sentiment → Intent → Analyst
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog

from src.agents.analyst_agent import run_analyst
from src.agents.etl_agent import run_etl_pipeline
from src.agents.intent_agent import run_intent_analysis
from src.agents.sentiment_agent import run_sentiment_analysis
from src.pipeline import checkpoint

log = structlog.get_logger()

PROCESSED = Path("data/processed/processed_corpus.jsonl")
ENRICHED = Path("data/processed/enriched_corpus.jsonl")

_STAGE_ORDER = ("etl", "sentiment", "intent", "analyst", "completed")


def _stage_index(stage: str) -> int:
    try:
        return _STAGE_ORDER.index(stage)
    except ValueError:
        return 0


def _record_pipeline_run(
    corpus_file: str,
    status: str,
    *,
    total_messages: int = 0,
    error_message: str | None = None,
) -> None:
    from src.db import writer

    writer.log_pipeline_run(
        corpus_file,
        status,
        total_messages=total_messages,
        error_message=error_message,
    )


async def run_full_pipeline(
    corpus_path: str,
    *,
    use_db: bool = False,
    smart_recommendations: bool = False,
    resume: bool = True,
    skip_etl: bool = False,
    from_stage: str | None = None,
) -> dict[str, str]:
    """
    Ejecuta el pipeline completo alineado al brief.

    Args:
        from_stage: Si se indica (etl|sentiment|intent|analyst), inicia en esa etapa.
            Las etapas distintas de etl implican skip_etl automático.

    Returns:
        Paths de salida por etapa.
    """
    corpus = str(Path(corpus_path).resolve())
    cp = checkpoint.load()

    if from_stage and from_stage in _STAGE_ORDER:
        start_i = _stage_index(from_stage)
        skip_etl = skip_etl or from_stage != "etl"
        checkpoint.save(from_stage, corpus)  # type: ignore[arg-type]
        log.info("pipeline_forced_stage", from_stage=from_stage, skip_etl=skip_etl)
    elif resume and cp.get("corpus_path") == corpus:
        start_i = _stage_index(cp.get("stage", "etl"))
    else:
        start_i = 0

    if start_i >= _stage_index("completed") and not (
        from_stage and from_stage in _STAGE_ORDER and from_stage != "completed"
    ):
        log.info("pipeline_already_completed", corpus=corpus)
        return {
            "processed": str(PROCESSED),
            "enriched": str(ENRICHED),
            "status": "completed",
        }

    single_stage = bool(from_stage and from_stage in _STAGE_ORDER)

    def _run_stage(name: str) -> bool:
        if single_stage:
            return from_stage == name
        return start_i <= _stage_index(name)

    _record_pipeline_run(corpus, "running")
    outputs: dict[str, str] = {"corpus": corpus}

    try:
        if _run_stage("etl") and not skip_etl:
            log.info("pipeline_stage", stage="etl")
            stats = await run_etl_pipeline(corpus, use_db=use_db)
            outputs["processed"] = str(PROCESSED)
            outputs["etl_stats"] = str(stats)
            checkpoint.save("sentiment", corpus)

        if _run_stage("sentiment"):
            if not PROCESSED.exists():
                raise FileNotFoundError(f"Falta {PROCESSED}; ejecuta ETL primero.")
            log.info("pipeline_stage", stage="sentiment")
            enriched = await run_sentiment_analysis(str(PROCESSED), use_db=use_db)
            outputs["enriched"] = enriched
            checkpoint.save("intent", corpus)

        if _run_stage("intent"):
            enriched_path = outputs.get("enriched") or str(ENRICHED)
            if not Path(enriched_path).exists():
                raise FileNotFoundError(f"Falta corpus enriquecido: {enriched_path}")
            log.info("pipeline_stage", stage="intent")
            enriched = await run_intent_analysis(enriched_path, use_db=use_db)
            outputs["enriched"] = enriched
            checkpoint.save("analyst", corpus)

        if _run_stage("analyst"):
            final_path = outputs.get("enriched") or str(ENRICHED)
            log.info("pipeline_stage", stage="analyst")
            analyst_out = await run_analyst(
                final_path,
                smart_recommendations=smart_recommendations,
                use_db=use_db,
            )
            outputs.update(analyst_out)
            checkpoint.save("completed", corpus)

            if use_db:
                try:
                    from src.analytics.evaluate import run_evaluation_from_supabase

                    run_evaluation_from_supabase(corpus, persist=True)
                except Exception as ev_err:
                    log.warning("model_evaluation_skipped", error=str(ev_err))

        total_msgs = 0
        if ENRICHED.exists():
            import pandas as pd

            total_msgs = len(pd.read_json(ENRICHED, lines=True))

        pipeline_done = not single_stage or from_stage == "analyst"
        _record_pipeline_run(corpus, "completed", total_messages=total_msgs)
        outputs["status"] = "completed" if pipeline_done else "stage_done"
        log.info("pipeline_finished", status=outputs["status"], single_stage=single_stage)
        return outputs

    except Exception as e:
        err = str(e)
        rate_limited = (
            "429" in err
            or "RESOURCE_EXHAUSTED" in err
            or "RateLimitError" in err
            or "Rate limit" in err
            or "tokens per day" in err
        )
        if rate_limited:
            log.warning("pipeline_rate_limited", error=err[:200])
            _record_pipeline_run(corpus, "failed", error_message="RateLimitError: cuota diaria de Groq agotada. El progreso está guardado.")
            outputs["status"] = "rate_limited"
            raise
        clean_err = err.splitlines()[0][:300] if err else "Error desconocido"
        _record_pipeline_run(corpus, "failed", error_message=clean_err)
        log.error("pipeline_failed", error=err)
        raise
