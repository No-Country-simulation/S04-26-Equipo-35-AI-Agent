"""
Evaluación de calidad de labels vs corpus CSV (ground truth parcial).

No entrena modelos: mide acuerdo entre CSV (intencion, nivel_frustracion) y
labels generados por el pipeline LLM (intent_label, sentiment_label).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import structlog

log = structlog.get_logger()

_INTENT_ALIASES: dict[str, set[str]] = {
    "logistica_envio": {"logistica_envio", "consulta_estado"},
    "problema_pago": {"problema_pago", "solicitud_reembolso"},
    "queja_servicio": {"queja_servicio"},
    "reporte_problema": {"reporte_problema"},
    "consulta_saldo": {"consulta_saldo"},
    "cancelacion": {"cancelacion"},
    "cambio_datos": {"cambio_datos"},
    "solicitud_info": {"solicitud_info"},
}

PT_THRESHOLD_DROP = 0.05
MIN_SENTIMENT_AGREEMENT = 0.70


def _intent_match(csv_intent: str, predicted: str) -> bool:
    csv_intent = (csv_intent or "otra").strip().lower()
    predicted = (predicted or "otra").strip().lower()
    if csv_intent == predicted:
        return True
    aliases = _INTENT_ALIASES.get(csv_intent, {csv_intent})
    return predicted in aliases


def _expected_sentiment(nivel: int) -> str:
    if nivel >= 1:
        return "frustrado"
    return "neutro"


def _region_lang(region: str) -> str:
    return "PT" if str(region).upper() == "BRAZIL" else "ES"


def _compute_metrics(merged: pd.DataFrame) -> dict[str, Any]:
    total = len(merged)
    if total == 0:
        return {"error": "Sin filas evaluables"}

    def _has_label(series: pd.Series) -> pd.Series:
        return series.notna() & series.astype(str).str.strip().ne("") & series.astype(str).ne("nan")

    labeled = _has_label(merged["sentiment_label"]) & _has_label(merged["intent_label"])
    coverage_pct = round(float(labeled.sum()) / total * 100, 1) if total else 0.0
    eval_df = merged[labeled].copy()

    if eval_df.empty:
        return {
            "rows_evaluated": total,
            "rows_with_labels": 0,
            "coverage_pct": coverage_pct,
            "error": "Sin mensajes con sentiment/intent del pipeline",
        }

    n = len(eval_df)

    intent_ok = sum(
        _intent_match(
            str(row.get("intencion_original", "")),
            str(row.get("intent_label", "otra")),
        )
        for _, row in eval_df.iterrows()
    )
    intent_accuracy = round(intent_ok / n, 3)

    sentiment_ok = 0
    for _, row in eval_df.iterrows():
        nivel = int(row.get("nivel_frustracion", 0) or 0)
        expected = _expected_sentiment(nivel)
        label = str(row.get("sentiment_label", "neutro"))
        if label == expected or (expected == "frustrado" and label == "frustrado"):
            sentiment_ok += 1
    sentiment_agreement = round(sentiment_ok / n, 3)

    by_intent: dict[str, dict[str, int]] = {}
    for _, row in eval_df.iterrows():
        orig = str(row.get("intencion_original", "otra"))
        pred = str(row.get("intent_label", "otra"))
        by_intent.setdefault(orig, {"total": 0, "correct": 0})
        by_intent[orig]["total"] += 1
        if _intent_match(orig, pred):
            by_intent[orig]["correct"] += 1

    per_intent = {
        k: {"accuracy": round(v["correct"] / v["total"], 3), "n": v["total"]}
        for k, v in by_intent.items()
    }

    low_conf = 0
    if "intent_confidence" in eval_df.columns:
        low_conf = int((eval_df["intent_confidence"].fillna(0) < 0.6).sum())

    by_region: dict[str, dict[str, Any]] = {}
    sentiment_breakdown: dict[str, dict[str, dict[str, int]]] = {}

    for region_key, filter_fn in [
        ("ALL", lambda _: True),
        ("LATAM", lambda r: _region_lang(r) == "ES"),
        ("BRAZIL", lambda r: _region_lang(r) == "PT"),
    ]:
        if region_key == "ALL":
            sub = eval_df
        else:
            sub = eval_df[eval_df["region"].apply(filter_fn)]
        if sub.empty:
            by_region[region_key] = {
                "lang": "ES" if region_key == "LATAM" else "PT" if region_key == "BRAZIL" else "ALL",
                "n": 0,
                "intent_accuracy": None,
                "sentiment_agreement": None,
            }
            continue

        sn = len(sub)
        i_ok = sum(
            _intent_match(str(r.get("intencion_original", "")), str(r.get("intent_label", "otra")))
            for _, r in sub.iterrows()
        )
        s_ok = 0
        for _, r in sub.iterrows():
            nivel = int(r.get("nivel_frustracion", 0) or 0)
            exp = _expected_sentiment(nivel)
            lab = str(r.get("sentiment_label", "neutro"))
            if lab == exp or (exp == "frustrado" and lab == "frustrado"):
                s_ok += 1

        lang = "ALL" if region_key == "ALL" else _region_lang(region_key)
        by_region[region_key] = {
            "lang": lang,
            "n": sn,
            "intent_accuracy": round(i_ok / sn, 3),
            "sentiment_agreement": round(s_ok / sn, 3),
        }

        if region_key != "ALL":
            lang_key = _region_lang(region_key)
            sentiment_breakdown[lang_key] = {}
            for label in ("frustrado", "neutro", "satisfecho"):
                bucket = sub[sub["sentiment_label"] == label]
                if bucket.empty:
                    sentiment_breakdown[lang_key][label] = {"agreement": None, "n": 0}
                    continue
                ok = 0
                for _, r in bucket.iterrows():
                    nivel = int(r.get("nivel_frustracion", 0) or 0)
                    if str(r.get("sentiment_label")) == _expected_sentiment(nivel):
                        ok += 1
                sentiment_breakdown[lang_key][label] = {
                    "agreement": round(ok / len(bucket), 3),
                    "n": len(bucket),
                }

    alerts: list[str] = []
    es_sent = by_region.get("LATAM", {}).get("sentiment_agreement")
    pt_sent = by_region.get("BRAZIL", {}).get("sentiment_agreement")
    if es_sent is not None and pt_sent is not None:
        if pt_sent < es_sent - PT_THRESHOLD_DROP:
            alerts.append(
                f"Sentimiento PT ({pt_sent:.1%}) por debajo de ES ({es_sent:.1%}) "
                f"más de {PT_THRESHOLD_DROP:.0%}."
            )
        if pt_sent < MIN_SENTIMENT_AGREEMENT:
            alerts.append(
                f"Acuerdo de sentimiento PT bajo umbral ({pt_sent:.1%} < {MIN_SENTIMENT_AGREEMENT:.0%})."
            )
    if intent_accuracy < 0.65:
        alerts.append(f"Precisión de intención global baja ({intent_accuracy:.1%}).")
    if coverage_pct < 50:
        alerts.append(
            f"Solo {coverage_pct:.0f}% de mensajes tienen labels del pipeline; "
            "termina sentiment/intent en la ingesta."
        )

    return {
        "rows_evaluated": total,
        "rows_with_labels": n,
        "coverage_pct": coverage_pct,
        "intent_accuracy": intent_accuracy,
        "sentiment_agreement": sentiment_agreement,
        "low_confidence_intents": low_conf,
        "low_confidence_pct": round(low_conf / n * 100, 1) if n else 0.0,
        "per_intent_accuracy": per_intent,
        "by_region": by_region,
        "sentiment_breakdown": sentiment_breakdown,
        "alerts": alerts,
    }


def _merge_corpus_enriched(corpus_path: str, enriched_path: Path) -> pd.DataFrame:
    csv_df = pd.read_csv(corpus_path, encoding="utf-8-sig")
    enr_df = pd.read_json(enriched_path, lines=True)

    if "turn_id" not in csv_df.columns:
        csv_df = csv_df.sort_values(["session_id", "fecha"]).reset_index(drop=True)
        csv_df["turn_id"] = csv_df.groupby("session_id").cumcount()

    csv_df = csv_df.rename(columns={"intencion": "intencion_original"})
    return csv_df.merge(enr_df, on=["session_id", "turn_id"], how="inner", suffixes=("_csv", "_enr"))


def run_evaluation(
    corpus_path: str,
    enriched_path: str = "data/processed/enriched_corpus.jsonl",
    *,
    sample_size: int = 0,
    persist: bool = True,
) -> dict[str, Any]:
    """Compara enriched_corpus.jsonl con el CSV original."""
    enr_path = Path(enriched_path)
    if not enr_path.exists():
        raise FileNotFoundError(f"No existe {enr_path}")

    merged = _merge_corpus_enriched(corpus_path, enr_path)
    if sample_size > 0 and len(merged) > sample_size:
        merged = merged.sample(n=sample_size, random_state=42)

    if "intencion_original_csv" in merged.columns:
        merged["intencion_original"] = merged["intencion_original_csv"].fillna(
            merged.get("intencion_original_enr", "")
        )
    if "nivel_frustracion_csv" in merged.columns:
        merged["nivel_frustracion"] = merged["nivel_frustracion_csv"].fillna(
            merged.get("nivel_frustracion_enr", 0)
        )
    if "region_csv" in merged.columns:
        merged["region"] = merged["region_csv"].fillna(merged.get("region_enr", "LATAM"))

    report = _compute_metrics(merged)
    report["corpus_path"] = corpus_path
    report["enriched_path"] = str(enr_path)
    report["source"] = "enriched_file"
    report["evaluated_at"] = datetime.now(timezone.utc).isoformat()

    out = Path("data/processed/evaluation_report.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    if persist and "error" not in report:
        persist_evaluation_snapshot(report)

    log.info("evaluation_done", intent=report.get("intent_accuracy"), sentiment=report.get("sentiment_agreement"))
    return report


def run_evaluation_from_supabase(
    corpus_path: str,
    *,
    sample_size: int = 0,
    persist: bool = True,
) -> dict[str, Any]:
    """Evalúa usando mensajes en Supabase (fuente de verdad del dashboard)."""
    from src.db.supabase_client import get_supabase

    csv_df = pd.read_csv(corpus_path, encoding="utf-8-sig")
    if "turn_id" not in csv_df.columns:
        csv_df = csv_df.sort_values(["session_id", "fecha"]).reset_index(drop=True)
        csv_df["turn_id"] = csv_df.groupby("session_id").cumcount()
    csv_df = csv_df.rename(columns={"intencion": "intencion_original"})

    sb = get_supabase()
    rows: list[dict[str, Any]] = []
    offset = 0
    page = 2000
    while True:
        res = (
            sb.table("messages")
            .select(
                "session_id,turn_id,region,intencion_original,nivel_frustracion,"
                "sentiment_label,intent_label,intent_confidence"
            )
            .range(offset, offset + page - 1)
            .execute()
        )
        batch = res.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page

    if not rows:
        return {"error": "No hay mensajes en Supabase"}

    msg_df = pd.DataFrame(rows)
    merged = csv_df.merge(msg_df, on=["session_id", "turn_id"], how="inner", suffixes=("_csv", "_db"))

    if sample_size > 0 and len(merged) > sample_size:
        merged = merged.sample(n=sample_size, random_state=42)

    if "intencion_original_csv" in merged.columns:
        merged["intencion_original"] = merged["intencion_original_csv"]
    if "nivel_frustracion_csv" in merged.columns:
        merged["nivel_frustracion"] = merged["nivel_frustracion_csv"]
    if "region_db" in merged.columns:
        merged["region"] = merged["region_db"].fillna(merged.get("region_csv", "LATAM"))
    elif "region_csv" in merged.columns:
        merged["region"] = merged["region_csv"]

    report = _compute_metrics(merged)
    report["corpus_path"] = corpus_path
    report["source"] = "supabase"
    report["evaluated_at"] = datetime.now(timezone.utc).isoformat()

    out = Path("data/processed/evaluation_report.json")
    with out.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    if persist and "error" not in report:
        persist_evaluation_snapshot(report)

    log.info("evaluation_from_db_done", rows=report.get("rows_evaluated"))
    return report


def persist_evaluation_snapshot(report: dict[str, Any]) -> None:
    """Guarda evaluación en metrics_snapshots + historial para tendencia."""
    from src.db.supabase_client import get_supabase

    period = datetime.now(timezone.utc).strftime("%Y-%m")
    sb = get_supabase()

    prev_eval: dict[str, Any] | None = None
    prev_period: str | None = None
    try:
        prev_res = (
            sb.table("metrics_snapshots")
            .select("metrics_json,period")
            .neq("period", period)
            .order("period", desc=True)
            .limit(1)
            .execute()
        )
        if prev_res.data:
            prev_period = prev_res.data[0].get("period")
            prev_eval = (prev_res.data[0].get("metrics_json") or {}).get("model_evaluation")
    except Exception:
        pass

    if prev_eval:
        report["previous"] = {
            "period": prev_period,
            "intent_accuracy": prev_eval.get("intent_accuracy"),
            "sentiment_agreement": prev_eval.get("sentiment_agreement"),
            "by_region": prev_eval.get("by_region"),
        }
        pa = prev_eval.get("by_region", {})
        ca = report.get("by_region", {})
        for key in ("LATAM", "BRAZIL", "ALL"):
            if key in ca and key in pa:
                cur = ca[key]
                old = pa[key]
                if cur.get("sentiment_agreement") is not None and old.get("sentiment_agreement") is not None:
                    cur["sentiment_delta"] = round(
                        cur["sentiment_agreement"] - old["sentiment_agreement"], 3
                    )
                if cur.get("intent_accuracy") is not None and old.get("intent_accuracy") is not None:
                    cur["intent_delta"] = round(
                        cur["intent_accuracy"] - old["intent_accuracy"], 3
                    )

    existing: dict[str, Any] = {}
    try:
        cur = sb.table("metrics_snapshots").select("metrics_json").eq("period", period).limit(1).execute()
        if cur.data:
            existing = cur.data[0].get("metrics_json") or {}
    except Exception:
        pass

    existing["model_evaluation"] = report
    sb.table("metrics_snapshots").upsert(
        {"period": period, "metrics_json": existing},
        on_conflict="period",
    ).execute()


def fetch_evaluation_history(limit: int = 6) -> list[dict[str, Any]]:
    """Últimos snapshots con model_evaluation (para gráfico de tendencia)."""
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    res = (
        sb.table("metrics_snapshots")
        .select("period,metrics_json,created_at")
        .order("period", desc=False)
        .limit(20)
        .execute()
    )
    history: list[dict[str, Any]] = []
    for row in res.data or []:
        ev = (row.get("metrics_json") or {}).get("model_evaluation")
        if ev:
            history.append({
                "period": row["period"],
                "intent_accuracy": ev.get("intent_accuracy"),
                "sentiment_agreement": ev.get("sentiment_agreement"),
            })
    return history[-limit:]
