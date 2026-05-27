"""
CLI ConversaAI — ingesta y análisis sin CrewAI.

  uv run python -m src.cli ingest --corpus data/raw/data_conversa_ai.csv --use-db
  uv run python -m src.cli ingest --corpus data/raw/test_mini.csv --smart-recommendations
  uv run python -m src.cli reset-checkpoint
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

import structlog
from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env", override=True)
log = structlog.get_logger()


def _cmd_ingest(args: argparse.Namespace) -> None:
    from src.pipeline.orchestrator import run_full_pipeline

    corpus = Path(args.corpus)
    if not corpus.exists():
        log.error("corpus_not_found", path=str(corpus))
        sys.exit(1)

    try:
        result = asyncio.run(
            run_full_pipeline(
                str(corpus),
                use_db=args.use_db,
                smart_recommendations=args.smart_recommendations,
                resume=not args.no_resume,
                skip_etl=args.skip_etl,
                from_stage=args.from_stage,
            )
        )
        print("Pipeline completado:")
        for k, v in result.items():
            print(f"  {k}: {v}")
    except Exception as e:
        err = str(e).lower()
        if (
            "429" in str(e)
            or "resource_exhausted" in err
            or "rate_limit" in err
            or "tokens per day" in err
        ):
            print(
                "Cuota API agotada (rate limit). "
                "Reintenta mañana o sube LLM_BATCH_DELAY_SEC; el checkpoint permite reanudar."
            )
            sys.exit(0)
        raise


def _cmd_evaluate(args: argparse.Namespace) -> None:
    from src.analytics.evaluate import run_evaluation, run_evaluation_from_supabase

    corpus = Path(args.corpus)
    if not corpus.exists():
        log.error("corpus_not_found", path=str(corpus))
        sys.exit(1)

    if args.from_db:
        report = run_evaluation_from_supabase(
            str(corpus),
            sample_size=args.sample,
        )
    else:
        report = run_evaluation(
            str(corpus),
            enriched_path=args.enriched,
            sample_size=args.sample,
        )
    print("\n=== Evaluación de calidad ===")
    for k, v in report.items():
        if k != "per_intent_accuracy":
            print(f"  {k}: {v}")
    if report.get("per_intent_accuracy"):
        print("\n  Por intención (CSV):")
        for intent, stats in report["per_intent_accuracy"].items():
            print(f"    {intent}: {stats['accuracy']*100:.0f}% (n={stats['n']})")


def _cmd_reset_checkpoint(_: argparse.Namespace) -> None:
    from src.pipeline.checkpoint import clear

    clear()
    print("Checkpoint eliminado.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ConversaAI — pipeline de sentiment e intent (sin CrewAI)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="ETL → sentiment → intent → analyst")
    ingest.add_argument("--corpus", required=True, help="Ruta al CSV")
    ingest.add_argument("--use-db", action="store_true", help="Persistir en Supabase/Qdrant")
    ingest.add_argument(
        "--smart-recommendations",
        action="store_true",
        help="Recomendaciones LLM en el informe analyst",
    )
    ingest.add_argument("--no-resume", action="store_true", help="Ignorar checkpoint")
    ingest.add_argument("--skip-etl", action="store_true", help="Usar processed_corpus.jsonl existente")
    ingest.add_argument(
        "--from-stage",
        choices=("etl", "sentiment", "intent", "analyst"),
        default=None,
        help="Iniciar en esta etapa (salta ETL si no es etl)",
    )
    ingest.set_defaults(func=_cmd_ingest)

    ev = sub.add_parser("evaluate", help="Evaluar labels vs CSV original")
    ev.add_argument("--corpus", required=True, help="CSV original")
    ev.add_argument(
        "--enriched",
        default="data/processed/enriched_corpus.jsonl",
        help="JSONL enriquecido",
    )
    ev.add_argument("--sample", type=int, default=0, help="Muestra aleatoria (0=todo)")
    ev.add_argument(
        "--from-db",
        action="store_true",
        help="Evaluar contra mensajes en Supabase (recomendado para el dashboard)",
    )
    ev.set_defaults(func=_cmd_evaluate)

    reset = sub.add_parser("reset-checkpoint", help="Borrar ingestion_checkpoint.json")
    reset.set_defaults(func=_cmd_reset_checkpoint)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
