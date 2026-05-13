"""
Analyst Agent — Métricas agregadas y reporte de insights.

Lee el corpus enriquecido con sentiment e intent. Calcula métricas
agregadas, detecta patrones y genera el reporte Markdown y el JSON
de métricas para el dashboard.

Usa `region` (LATAM/BRAZIL/EUROPE) para comparaciones regionales.

Cuando use_db=True:
  - Usa Qdrant para búsqueda semántica de conversaciones similares.
  - Guarda snapshots de métricas en Supabase para historial.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import structlog

log = structlog.get_logger()


# ── Métricas globales ────────────────────────────────────────────────────────


def calc_global_metrics(df: pd.DataFrame) -> dict[str, Any]:
    """Calcula métricas globales del corpus enriquecido."""
    total_sessions = int(df["session_id"].nunique())

    # Tasa de escalada
    sessions_with_escalation = df[df["escalation"] == True].groupby("session_id").ngroups  # noqa: E712
    escalation_rate = round(sessions_with_escalation / total_sessions, 3) if total_sessions > 0 else 0.0

    # Tasa de abandono
    sessions_with_abandonment = df[df["abandonment_risk"] == True].groupby("session_id").ngroups  # noqa: E712
    abandonment_rate = round(sessions_with_abandonment / total_sessions, 3) if total_sessions > 0 else 0.0

    # Tasa de resolución
    with_resolved = df[df["resolved"].notna()]
    resolution_rate = (
        round(float(with_resolved[with_resolved["resolved"] == True].shape[0] / len(with_resolved)), 3)  # noqa: E712
        if len(with_resolved) > 0 else 0.0
    )

    # Distribución de sentimiento
    sentiment_counts = df["sentiment_label"].value_counts()
    sentiment_total = sentiment_counts.sum()
    sentiment_distribution = {
        label: round(sentiment_counts.get(label, 0) / sentiment_total * 100, 1) if sentiment_total > 0 else 0
        for label in ["frustrado", "neutro", "satisfecho"]
    }

    # Distribución por región
    region_counts = df["region"].value_counts()
    region_total = region_counts.sum()
    region_distribution = {
        region: round(region_counts.get(region, 0) / region_total * 100, 1) if region_total > 0 else 0
        for region in ["LATAM", "BRAZIL", "EUROPE"]
    }

    # Tasa de churn
    churn_sessions = df[df["es_churn_risk"] == True]["session_id"].nunique()  # noqa: E712
    churn_rate = round(churn_sessions / total_sessions, 3) if total_sessions > 0 else 0.0

    return {
        "total_sessions": total_sessions,
        "total_messages": len(df),
        "escalation_rate": escalation_rate,
        "abandonment_rate": abandonment_rate,
        "resolution_rate": resolution_rate,
        "churn_rate": churn_rate,
        "sentiment_distribution": sentiment_distribution,
        "region_distribution": region_distribution,
    }


# ── Top flujos frustrados ────────────────────────────────────────────────────


def calc_top_frustrated_flows(df: pd.DataFrame, top_n: int = 5) -> list[dict[str, Any]]:
    """Identifica los top N flujos con mayor frustración."""
    frustrated = df[df["sentiment_label"] == "frustrado"]
    if frustrated.empty:
        return []

    flows = []
    for intent, group in frustrated.groupby("intent_label"):
        if intent is None:
            continue
        avg_score = round(float(group["sentiment_score"].mean()), 2)
        escalated = group[group["escalation"] == True]  # noqa: E712

        flows.append({
            "intent_label": str(intent),
            "avg_frustration_score": avg_score,
            "frustration_count": int(len(group)),
            "escalation_turn": (
                round(float(escalated["turn_id"].mean()), 1) if not escalated.empty else None
            ),
        })

    flows.sort(key=lambda x: x["avg_frustration_score"], reverse=True)
    return flows[:top_n]


# ── Correlación intent-frustración ───────────────────────────────────────────


def calc_intent_frustration_correlation(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Calcula correlación entre intención no resuelta y frustración."""
    user_df = df[df["intent_label"].notna()]
    if user_df.empty:
        return []

    correlations = []
    for intent, group in user_df.groupby("intent_label"):
        total = len(group)
        unresolved = group[group["resolved"] == False]  # noqa: E712
        unresolved_pct = round(len(unresolved) / total * 100, 1) if total > 0 else 0

        frustrated_unresolved = unresolved[unresolved["sentiment_label"] == "frustrado"]
        avg_frustration = (
            round(float(frustrated_unresolved["sentiment_score"].mean()), 2)
            if not frustrated_unresolved.empty else 0.0
        )

        combined_score = (unresolved_pct / 100) * avg_frustration

        correlations.append({
            "intent_label": str(intent),
            "total": int(total),
            "unresolved_pct": float(unresolved_pct),
            "avg_frustration": float(avg_frustration),
            "combined_score": round(float(combined_score), 3),
        })

    correlations.sort(key=lambda x: x["combined_score"], reverse=True)
    return correlations


# ── Patrones de abandono ─────────────────────────────────────────────────────


def calc_abandonment_patterns(df: pd.DataFrame) -> dict[str, Any]:
    """Analiza patrones de abandono por región."""
    abandoned = df[df["abandonment_risk"] == True]  # noqa: E712

    if abandoned.empty:
        return {
            "avg_turn_of_abandonment": 0.0,
            "top_intents_at_abandonment": [],
            "region_abandonment": {"LATAM": 0.0, "BRAZIL": 0.0, "EUROPE": 0.0},
        }

    avg_turn = round(float(abandoned["turn_id"].mean()), 1)

    intent_counts = abandoned["intent_label"].value_counts().head(5)
    top_intents = [
        {"intent": str(intent), "count": int(count)}
        for intent, count in intent_counts.items()
    ]

    # Tasa de abandono por región
    total_by_region = df.groupby("region")["session_id"].nunique()
    abandoned_by_region = abandoned.groupby("region")["session_id"].nunique()

    region_abandonment = {}
    for region in ["LATAM", "BRAZIL", "EUROPE"]:
        total = total_by_region.get(region, 0)
        aband = abandoned_by_region.get(region, 0)
        region_abandonment[region] = round(aband / total, 3) if total > 0 else 0.0

    return {
        "avg_turn_of_abandonment": avg_turn,
        "top_intents_at_abandonment": top_intents,
        "region_abandonment": region_abandonment,
    }


# ── Comparación por región ───────────────────────────────────────────────────


def calc_region_comparison(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Compara métricas clave entre LATAM, BRAZIL y EUROPE."""
    result: dict[str, dict[str, Any]] = {}

    for region in ["LATAM", "BRAZIL", "EUROPE"]:
        region_df = df[df["region"] == region]
        if region_df.empty:
            result[region] = {
                "sessions": 0, "avg_frustration": 0.0, "resolution_rate": 0.0,
                "escalation_rate": 0.0, "abandonment_rate": 0.0, "churn_rate": 0.0,
            }
            continue

        total_sessions = region_df["session_id"].nunique()
        frustrated = region_df[region_df["sentiment_label"] == "frustrado"]

        with_resolved = region_df[region_df["resolved"].notna()]
        res_rate = round(float(with_resolved["resolved"].mean()), 3) if len(with_resolved) > 0 else 0.0

        sessions_escalated = region_df[region_df["escalation"] == True]["session_id"].nunique()  # noqa: E712
        sessions_abandoned = region_df[region_df["abandonment_risk"] == True]["session_id"].nunique()  # noqa: E712
        sessions_churn = region_df[region_df["es_churn_risk"] == True]["session_id"].nunique()  # noqa: E712

        result[region] = {
            "sessions": int(total_sessions),
            "avg_frustration": (
                round(float(frustrated["sentiment_score"].mean()), 2)
                if not frustrated.empty else 0.0
            ),
            "resolution_rate": res_rate,
            "escalation_rate": round(sessions_escalated / total_sessions, 3) if total_sessions > 0 else 0.0,
            "abandonment_rate": round(sessions_abandoned / total_sessions, 3) if total_sessions > 0 else 0.0,
            "churn_rate": round(sessions_churn / total_sessions, 3) if total_sessions > 0 else 0.0,
        }

    return result


# ── Priorización de recomendaciones ──────────────────────────────────────────


def prioritize_recommendations(
    intent_metrics: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """
    P1: unresolved_pct > 40 AND avg_frustration > 0.7
    P2: unresolved_pct entre 20-40 OR avg_frustration > 0.5
    P3: todo lo demás. Max: 3 P1, 5 P2.
    """
    p1: list[dict[str, Any]] = []
    p2: list[dict[str, Any]] = []
    p3: list[dict[str, Any]] = []

    for metric in intent_metrics:
        pct = metric.get("unresolved_pct", 0)
        frust = metric.get("avg_frustration", 0)

        if pct > 40 and frust > 0.7:
            p1.append(metric)
        elif 20 <= pct <= 40 or frust > 0.5:
            p2.append(metric)
        else:
            p3.append(metric)

    return {"P1": p1[:3], "P2": p2[:5], "P3": p3}


# ── Generación del reporte ───────────────────────────────────────────────────


def _generate_report(
    global_metrics: dict, top_flows: list[dict], correlations: list[dict],
    abandonment: dict, priorities: dict,
    region_comparison: dict[str, dict[str, Any]], period: str,
) -> str:
    """Genera el reporte Markdown."""
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines = [
        "# ConversaAI — Insights Report",
        f"**Período:** {period}  ",
        f"**Generado:** {now}",
        "",
        "## Métricas Clave del Mes",
        "| Métrica | Valor |",
        "|---------|-------|",
        f"| Total sesiones | {global_metrics['total_sessions']} |",
        f"| Total mensajes | {global_metrics['total_messages']} |",
        f"| Tasa de escalada | {global_metrics['escalation_rate'] * 100:.1f}% |",
        f"| Tasa de abandono | {global_metrics['abandonment_rate'] * 100:.1f}% |",
        f"| Tasa de churn | {global_metrics['churn_rate'] * 100:.1f}% |",
        f"| Resolution rate | {global_metrics['resolution_rate'] * 100:.1f}% |",
        f"| Frustrado | {global_metrics['sentiment_distribution']['frustrado']}% |",
        f"| Neutro | {global_metrics['sentiment_distribution']['neutro']}% |",
        f"| Satisfecho | {global_metrics['sentiment_distribution']['satisfecho']}% |",
        "",
    ]

    # Distribución regional
    lines.extend([
        "## Distribución Regional",
        "| Región | % |",
        "|--------|---|",
    ])
    for region, pct in global_metrics["region_distribution"].items():
        lines.append(f"| {region} | {pct}% |")
    lines.append("")

    # Top flujos
    lines.append("## Top 5 Flujos con Mayor Frustración")
    for i, flow in enumerate(top_flows, 1):
        lines.extend([
            f"### {i}. {flow['intent_label']}",
            f"- Frustración promedio: {flow['avg_frustration_score']}",
            f"- Casos: {flow['frustration_count']}",
            f"- Escalada en turno: {flow.get('escalation_turn', 'N/A')}",
            "",
        ])

    # Top intenciones no resueltas
    lines.extend([
        "## Top 10 Intenciones No Resueltas",
        "| Rank | Intención | Total | % No Resuelto | Frustración |",
        "|------|-----------|-------|---------------|-------------|",
    ])
    for i, corr in enumerate(correlations[:10], 1):
        lines.append(
            f"| {i} | {corr['intent_label']} | {corr['total']} | "
            f"{corr['unresolved_pct']}% | {corr['avg_frustration']} |"
        )
    lines.append("")

    # Abandono
    lines.extend([
        "## Patrones de Abandono",
        f"- Turno promedio de abandono: {abandonment['avg_turn_of_abandonment']}",
    ])
    for region, rate in abandonment["region_abandonment"].items():
        lines.append(f"- Abandono {region}: {rate * 100:.1f}%")
    lines.append("")

    # Comparación regional
    lines.extend([
        "## Comparación Regional",
        "| Métrica | LATAM | BRAZIL | EUROPE |",
        "|---------|:-----:|:------:|:------:|",
    ])
    latam = region_comparison.get("LATAM", {})
    brazil = region_comparison.get("BRAZIL", {})
    europe = region_comparison.get("EUROPE", {})

    lines.extend([
        f"| Sesiones | {latam.get('sessions', 0)} | {brazil.get('sessions', 0)} | {europe.get('sessions', 0)} |",
        f"| Frustración | {latam.get('avg_frustration', 0)} | {brazil.get('avg_frustration', 0)} | {europe.get('avg_frustration', 0)} |",
        f"| Resolution | {latam.get('resolution_rate', 0) * 100:.1f}% | {brazil.get('resolution_rate', 0) * 100:.1f}% | {europe.get('resolution_rate', 0) * 100:.1f}% |",
        f"| Churn | {latam.get('churn_rate', 0) * 100:.1f}% | {brazil.get('churn_rate', 0) * 100:.1f}% | {europe.get('churn_rate', 0) * 100:.1f}% |",
        "",
    ])

    # Recomendaciones
    lines.append("## Recomendaciones para el Sprint")
    for priority_key, label in [("P1", "P1 — Impacto Alto"), ("P2", "P2 — Impacto Medio"), ("P3", "P3 — Backlog")]:
        items = priorities[priority_key]
        if items:
            lines.append(f"### {label}")
            for i, p in enumerate(items, 1):
                lines.append(f"{i}. **{p['intent_label']}** — {p['unresolved_pct']}% sin resolver, frustración {p['avg_frustration']}")
            lines.append("")

    return "\n".join(lines)


# ── Recomendaciones con LLM (opcional) ───────────────────────────────────────

_SMART_RECS_PROMPT = """
Eres el Head of Product Analytics de ConversaAI, una plataforma de soporte
que procesa 2M+ mensajes/mes en español LATAM y portugués brasileño.

## Datos del Último Mes
- Total sesiones: {total_sessions}
- Escalada: {escalation_rate:.1%}
- Abandono: {abandonment_rate:.1%}
- Resolution rate: {resolution_rate:.1%}
- Churn rate: {churn_rate:.1%}

## Top Flujos Frustrados
{top_flows_text}

## Top Intenciones No Resueltas
{unresolved_text}

Genera EXACTAMENTE este JSON (sin texto adicional):
{{
  "P1": [{{"intent": "nombre", "action": "acción concreta", "metric": "métrica medible", "impact": "impacto cuantificado"}}],
  "P2": [...],
  "P3": [...]
}}

Reglas: P1 máximo 3 quick wins, P2 máximo 5, cada acción debe ser un ticket de Jira.
"""


async def generate_smart_recommendations(
    global_metrics: dict[str, Any],
    top_flows: list[dict[str, Any]],
    correlations: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]] | None:
    """Genera recomendaciones usando el LLM."""
    try:
        from src.llm_factory import get_llm
    except ImportError:
        return None

    top_flows_text = "\n".join(
        f"- {f['intent_label']}: frustración {f['avg_frustration_score']}, {f['frustration_count']} casos"
        for f in top_flows[:5]
    ) or "Sin datos"

    unresolved_text = "\n".join(
        f"- {c['intent_label']}: {c['unresolved_pct']}% no resuelto, frustración {c['avg_frustration']}"
        for c in correlations[:10]
    ) or "Sin datos"

    prompt = _SMART_RECS_PROMPT.format(
        total_sessions=global_metrics["total_sessions"],
        escalation_rate=global_metrics["escalation_rate"],
        abandonment_rate=global_metrics["abandonment_rate"],
        resolution_rate=global_metrics["resolution_rate"],
        churn_rate=global_metrics.get("churn_rate", 0),
        top_flows_text=top_flows_text,
        unresolved_text=unresolved_text,
    )

    try:
        llm = get_llm(role="smart")
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        parsed = json.loads(content)
        log.info("smart_recommendations_generated", p1=len(parsed.get("P1", [])))
        return parsed
    except Exception as e:
        log.warning("smart_recommendations_failed", error=str(e))
        return None


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_analyst(
    enriched_path: str,
    smart_recommendations: bool = False,
    use_db: bool = False,
) -> dict[str, str]:
    """
    Genera el reporte de insights y el JSON de métricas.

    Args:
        enriched_path: Path al enriched_corpus.jsonl.
        smart_recommendations: Si True, usa LLM.
        use_db: Si True, usa Qdrant y guarda snapshots en Supabase.
    """
    path = Path(enriched_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus no encontrado: {path}")

    log.info("analyst_starting", enriched_path=str(path))

    df = pd.read_json(path, lines=True)

    # Calcular métricas
    global_metrics = calc_global_metrics(df)
    top_flows = calc_top_frustrated_flows(df)
    correlations = calc_intent_frustration_correlation(df)
    abandonment = calc_abandonment_patterns(df)
    region_comparison = calc_region_comparison(df)
    priorities = prioritize_recommendations(correlations)

    # Recomendaciones LLM
    smart_recs = None
    if smart_recommendations:
        smart_recs = await generate_smart_recommendations(global_metrics, top_flows, correlations)

    period = datetime.now(tz=timezone.utc).strftime("%Y-%m")

    # Generar reporte
    report_content = _generate_report(
        global_metrics, top_flows, correlations, abandonment,
        priorities, region_comparison, period,
    )

    if smart_recs:
        report_content += "\n\n---\n\n## 🤖 Recomendaciones Inteligentes (AI)\n\n"
        for priority, items in smart_recs.items():
            if not items:
                continue
            report_content += f"### {priority}\n"
            for i, item in enumerate(items, 1):
                report_content += (
                    f"{i}. **{item.get('intent', 'N/A')}**\n"
                    f"   - Acción: {item.get('action', 'N/A')}\n"
                    f"   - Métrica: {item.get('metric', 'N/A')}\n"
                    f"   - Impacto: {item.get('impact', 'N/A')}\n\n"
                )

    reports_dir = Path("reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_path = reports_dir / "insights_report.md"
    report_path.write_text(report_content, encoding="utf-8")

    # Métricas JSON
    metrics_summary: dict[str, Any] = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "period": period,
        "global": global_metrics,
        "top_frustrated_flows": top_flows,
        "unresolved_intents": correlations[:10],
        "abandonment_patterns": abandonment,
        "region_comparison": region_comparison,
    }

    # Búsqueda semántica
    if use_db:
        try:
            semantic_insights = await _generate_semantic_insights()
            if semantic_insights:
                metrics_summary["semantic_insights"] = semantic_insights
        except Exception as e:
            log.warning("semantic_insights_failed", error=str(e))

    if smart_recs:
        metrics_summary["smart_recommendations"] = smart_recs

    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = output_dir / "metrics_summary.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2, ensure_ascii=False)

    if use_db:
        await _save_metrics_snapshot(period, metrics_summary)

    log.info("analyst_completado", report=str(report_path), metrics=str(metrics_path))
    return {"report": str(report_path), "metrics": str(metrics_path)}


# ── Búsqueda semántica con Qdrant ────────────────────────────────────────────


async def _generate_semantic_insights() -> list[dict[str, Any]] | None:
    """Usa Qdrant para encontrar patrones semánticos en conversaciones."""
    from src.db.embeddings import embed_query
    from src.db.qdrant_store import COLLECTION_NAME, get_qdrant

    qdrant = get_qdrant()
    insights = []

    queries = [
        {"query": "no me resuelven el problema, ya les dije varias veces", "pattern": "Repetición sin solución"},
        {"query": "quiero hablar con un humano, el bot no me entiende", "pattern": "Escalación a humano"},
        {"query": "llevo días esperando y nadie me responde", "pattern": "Abandono por espera"},
        {"query": "me cobraron mal y no me devuelven el dinero", "pattern": "Reembolso no resuelto"},
        {"query": "quiero cancelar mi compra, nunca más vuelvo", "pattern": "Cancelación por frustración"},
    ]

    for sq in queries:
        try:
            vector = embed_query(sq["query"])
            results = qdrant.search(
                collection_name=COLLECTION_NAME,
                query_vector=vector,
                limit=5,
                score_threshold=0.7,
            )
            if results:
                insights.append({
                    "pattern": sq["pattern"],
                    "matches_found": len(results),
                    "top_matches": [
                        {
                            "session_id": r.payload.get("session_id", ""),
                            "text_preview": r.payload.get("text_preview", ""),
                            "similarity": round(r.score, 3),
                        }
                        for r in results
                    ],
                })
        except Exception as e:
            log.warning("semantic_query_failed", pattern=sq["pattern"], error=str(e))

    return insights if insights else None


# ── Persistencia de snapshots ────────────────────────────────────────────────


async def _save_metrics_snapshot(period: str, metrics_summary: dict[str, Any]) -> None:
    """Guarda un snapshot de métricas en Supabase."""
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    sb.table("metrics_snapshots").upsert(
        {"period": period, "metrics_json": metrics_summary},
        on_conflict="period",
    ).execute()
    log.info("metrics_snapshot_saved", period=period)
