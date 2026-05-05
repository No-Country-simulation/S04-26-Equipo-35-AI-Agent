"""
Analyst Agent — Métricas agregadas y reporte de insights.

Lee el corpus enriquecido con sentiment e intent. Calcula métricas
agregadas, detecta patrones y genera el reporte Markdown y el JSON
de métricas para el dashboard.

Leer skills/skill_analyst.md antes de modificar este archivo.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import structlog

log = structlog.get_logger()

# ── Archivos requeridos ──────────────────────────────────────────────────────

REQUIRED_FILES = [
    "data/processed/enriched_corpus.jsonl",
    "data/processed/top_frustrated_sessions.csv",
    "data/processed/unresolved_intents_ranking.json",
]


# ── Métricas globales ────────────────────────────────────────────────────────


def calc_global_metrics(df: pd.DataFrame) -> dict[str, Any]:
    """
    Calcula métricas globales del corpus enriquecido.

    Returns:
        Dict con: total_sessions, escalation_rate, abandonment_rate,
        resolution_rate, sentiment_distribution, lang_distribution.
    """
    total_sessions = int(df["session_id"].nunique())

    # Tasa de escalada (sesiones con al menos un escalation=True)
    sessions_with_escalation = df[df["escalation"] == True].groupby("session_id").ngroups  # noqa: E712
    escalation_rate = round(sessions_with_escalation / total_sessions, 3) if total_sessions > 0 else 0.0

    # Tasa de abandono
    sessions_with_abandonment = df[df["abandonment_risk"] == True].groupby("session_id").ngroups  # noqa: E712
    abandonment_rate = round(sessions_with_abandonment / total_sessions, 3) if total_sessions > 0 else 0.0

    # Tasa de resolución (turnos de usuario)
    user_with_resolved = df[(df["speaker"] == "user") & (df["resolved"].notna())]
    if len(user_with_resolved) > 0:
        resolution_rate = round(
            len(user_with_resolved[user_with_resolved["resolved"] == True]) / len(user_with_resolved),  # noqa: E712
            3,
        )
    else:
        resolution_rate = 0.0

    # Distribución de sentimiento
    user_df = df[df["speaker"] == "user"]
    sentiment_counts = user_df["sentiment_label"].value_counts()
    sentiment_total = sentiment_counts.sum()
    sentiment_distribution = {
        "frustrado": round(sentiment_counts.get("frustrado", 0) / sentiment_total * 100, 1) if sentiment_total > 0 else 0,
        "neutro": round(sentiment_counts.get("neutro", 0) / sentiment_total * 100, 1) if sentiment_total > 0 else 0,
        "satisfecho": round(sentiment_counts.get("satisfecho", 0) / sentiment_total * 100, 1) if sentiment_total > 0 else 0,
    }

    # Distribución por idioma
    lang_counts = df["lang"].value_counts()
    lang_total = lang_counts.sum()
    lang_distribution = {
        "es": round(lang_counts.get("es", 0) / lang_total * 100, 1) if lang_total > 0 else 0,
        "pt": round(lang_counts.get("pt", 0) / lang_total * 100, 1) if lang_total > 0 else 0,
    }

    return {
        "total_sessions": total_sessions,
        "escalation_rate": escalation_rate,
        "abandonment_rate": abandonment_rate,
        "resolution_rate": resolution_rate,
        "sentiment_distribution": sentiment_distribution,
        "lang_distribution": lang_distribution,
    }


# ── Top flujos frustrados ────────────────────────────────────────────────────


def calc_top_frustrated_flows(
    df: pd.DataFrame, top_n: int = 5
) -> list[dict[str, Any]]:
    """
    Identifica los top N flujos con mayor frustración.

    Agrupa por intent_label, calcula avg_sentiment_score para frustrado.
    Identifica turn_id donde comienza la escalada.
    """
    user_frustrated = df[
        (df["speaker"] == "user") & (df["sentiment_label"] == "frustrado")
    ]

    if user_frustrated.empty:
        return []

    flows = []
    for intent, group in user_frustrated.groupby("intent_label"):
        avg_score = round(float(group["sentiment_score"].mean()), 2)

        # Encontrar turno promedio de escalada
        escalated = group[group["escalation"] == True]  # noqa: E712
        avg_escalation_turn = (
            round(float(escalated["turn_id"].mean()), 1) if not escalated.empty else None
        )

        flows.append({
            "intent_label": str(intent),
            "avg_frustration_score": avg_score,
            "frustration_count": int(len(group)),
            "escalation_turn": avg_escalation_turn,
        })

    flows.sort(key=lambda x: x["avg_frustration_score"], reverse=True)
    return flows[:top_n]


# ── Correlación intent-frustración ───────────────────────────────────────────


def calc_intent_frustration_correlation(
    df: pd.DataFrame,
) -> list[dict[str, Any]]:
    """
    Para cada intent: calcula correlación entre resolved=False y
    sentiment frustrado.

    Retorna lista ordenada por (unresolved_pct * avg_frustration) DESC.
    """
    user_df = df[
        (df["speaker"] == "user") & (df["intent_label"].notna())
    ]

    if user_df.empty:
        return []

    correlations = []
    for intent, group in user_df.groupby("intent_label"):
        total = len(group)
        unresolved = group[group["resolved"] == False]  # noqa: E712
        unresolved_pct = round(len(unresolved) / total * 100, 1) if total > 0 else 0

        frustrated_unresolved = unresolved[
            unresolved["sentiment_label"] == "frustrado"
        ]
        avg_frustration = (
            round(float(frustrated_unresolved["sentiment_score"].mean()), 2)
            if not frustrated_unresolved.empty
            else 0.0
        )

        # Score combinado para ranking
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
    """
    Analiza patrones de abandono.

    Returns:
        avg_turn_of_abandonment, top_intents_at_abandonment,
        es_vs_pt_abandonment rates.
    """
    abandoned = df[df["abandonment_risk"] == True]  # noqa: E712

    if abandoned.empty:
        return {
            "avg_turn_of_abandonment": 0.0,
            "top_intents_at_abandonment": [],
            "es_vs_pt_abandonment": {"es": 0.0, "pt": 0.0},
        }

    avg_turn = round(float(abandoned["turn_id"].mean()), 1)

    # Top intents en momento de abandono
    intent_counts = abandoned["intent_label"].value_counts().head(5)
    top_intents = [
        {"intent": str(intent), "count": int(count)}
        for intent, count in intent_counts.items()
    ]

    # Tasa de abandono por idioma
    total_by_lang = df.groupby("lang")["session_id"].nunique()
    abandoned_by_lang = abandoned.groupby("lang")["session_id"].nunique()

    es_vs_pt = {}
    for lang in ["es", "pt"]:
        total = total_by_lang.get(lang, 0)
        aband = abandoned_by_lang.get(lang, 0)
        es_vs_pt[lang] = round(aband / total, 3) if total > 0 else 0.0

    return {
        "avg_turn_of_abandonment": avg_turn,
        "top_intents_at_abandonment": top_intents,
        "es_vs_pt_abandonment": es_vs_pt,
    }


# ── Comparación por idioma ───────────────────────────────────────────────────


def calc_lang_comparison(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """
    Compara métricas clave entre ES y PT.

    Returns:
        Dict con métricas por idioma: {es: {...}, pt: {...}}.
    """
    result: dict[str, dict[str, Any]] = {}

    for lang in ["es", "pt"]:
        lang_df = df[df["lang"] == lang]
        user_lang = lang_df[lang_df["speaker"] == "user"]

        if user_lang.empty:
            result[lang] = {
                "sessions": 0,
                "avg_frustration": 0.0,
                "resolution_rate": 0.0,
                "escalation_rate": 0.0,
                "abandonment_rate": 0.0,
                "top_unresolved_intents": [],
            }
            continue

        total_sessions = lang_df["session_id"].nunique()
        frustrated = user_lang[user_lang["sentiment_label"] == "frustrado"]

        with_resolved = user_lang[user_lang["resolved"].notna()]
        res_rate = (
            round(float(with_resolved["resolved"].mean()), 3)
            if len(with_resolved) > 0
            else 0.0
        )

        sessions_escalated = lang_df[lang_df["escalation"] == True]["session_id"].nunique()  # noqa: E712
        sessions_abandoned = lang_df[lang_df["abandonment_risk"] == True]["session_id"].nunique()  # noqa: E712

        # Top intenciones no resueltas por idioma
        unresolved = user_lang[user_lang["resolved"] == False]  # noqa: E712
        top_unresolved = (
            unresolved["intent_label"]
            .value_counts()
            .head(5)
            .to_dict()
        ) if not unresolved.empty else {}

        result[lang] = {
            "sessions": int(total_sessions),
            "avg_frustration": round(
                float(frustrated["sentiment_score"].mean()), 2
            ) if not frustrated.empty else 0.0,
            "resolution_rate": res_rate,
            "escalation_rate": round(
                sessions_escalated / total_sessions, 3
            ) if total_sessions > 0 else 0.0,
            "abandonment_rate": round(
                sessions_abandoned / total_sessions, 3
            ) if total_sessions > 0 else 0.0,
            "top_unresolved_intents": [
                {"intent": k, "count": int(v)}
                for k, v in top_unresolved.items()
            ],
        }

    return result


# ── Priorización de recomendaciones ──────────────────────────────────────────


def prioritize_recommendations(
    intent_metrics: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """
    Prioriza recomendaciones según reglas del skill.

    P1: unresolved_pct > 40 AND avg_frustration > 0.7
    P2: unresolved_pct entre 20-40 OR avg_frustration > 0.5
    P3: todo lo demás

    Máximo: 3 items en P1, 5 en P2, sin límite en P3.
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

    return {
        "P1": p1[:3],
        "P2": p2[:5],
        "P3": p3,
    }


# ── Generación del reporte ───────────────────────────────────────────────────


def _generate_report(
    global_metrics: dict,
    top_flows: list[dict],
    correlations: list[dict],
    abandonment: dict,
    priorities: dict,
    lang_comparison: dict[str, dict[str, Any]],
    period: str,
) -> str:
    """Genera el reporte Markdown siguiendo la estructura del skill."""
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
        f"| Tasa de escalada | {global_metrics['escalation_rate'] * 100:.1f}% |",
        f"| Tasa de abandono | {global_metrics['abandonment_rate'] * 100:.1f}% |",
        f"| Resolution rate | {global_metrics['resolution_rate'] * 100:.1f}% |",
        f"| Frustrado | {global_metrics['sentiment_distribution']['frustrado']}% |",
        f"| Neutro | {global_metrics['sentiment_distribution']['neutro']}% |",
        f"| Satisfecho | {global_metrics['sentiment_distribution']['satisfecho']}% |",
        f"| Español (ES) | {global_metrics['lang_distribution']['es']}% |",
        f"| Portugués (PT) | {global_metrics['lang_distribution']['pt']}% |",
        "",
    ]

    # Top flujos frustrados
    lines.append("## Top 5 Flujos con Mayor Frustración")
    for i, flow in enumerate(top_flows, 1):
        lines.extend([
            f"### {i}. {flow['intent_label']}",
            f"- **Intención:** {flow['intent_label']}",
            f"- **Frustración promedio:** {flow['avg_frustration_score']}",
            f"- **Casos de frustración:** {flow['frustration_count']}",
            f"- **Momento de escalada:** Turno {flow.get('escalation_turn', 'N/A')}",
            "",
        ])

    # Top intenciones no resueltas
    lines.extend([
        "## Top 10 Intenciones No Resueltas",
        "| Rank | Intención | Total | % No Resuelto | Frustración Asociada |",
        "|------|-----------|-------|---------------|----------------------|",
    ])
    for i, corr in enumerate(correlations[:10], 1):
        lines.append(
            f"| {i} | {corr['intent_label']} | {corr['total']} | "
            f"{corr['unresolved_pct']}% | {corr['avg_frustration']} |"
        )
    lines.append("")

    # Patrones de abandono
    lines.extend([
        "## Patrones de Abandono",
        f"- **Turno promedio de abandono:** {abandonment['avg_turn_of_abandonment']}",
        f"- **Abandono ES:** {abandonment['es_vs_pt_abandonment'].get('es', 0) * 100:.1f}%",
        f"- **Abandono PT:** {abandonment['es_vs_pt_abandonment'].get('pt', 0) * 100:.1f}%",
        "",
    ])

    if abandonment["top_intents_at_abandonment"]:
        lines.append("### Intenciones en Momento de Abandono")
        for item in abandonment["top_intents_at_abandonment"]:
            lines.append(f"- {item['intent']}: {item['count']} casos")
        lines.append("")

    # Diferencias ES vs PT
    lines.extend([
        "## Diferencias ES vs PT",
        "| Métrica | Español (ES) | Portugués (PT) |",
        "|---------|:------------:|:--------------:|",
    ])
    es = lang_comparison.get("es", {})
    pt = lang_comparison.get("pt", {})
    lines.extend([
        f"| Sesiones | {es.get('sessions', 0)} | {pt.get('sessions', 0)} |",
        f"| Frustración promedio | {es.get('avg_frustration', 0)} | {pt.get('avg_frustration', 0)} |",
        f"| Resolution rate | {es.get('resolution_rate', 0) * 100:.1f}% | {pt.get('resolution_rate', 0) * 100:.1f}% |",
        f"| Tasa de escalada | {es.get('escalation_rate', 0) * 100:.1f}% | {pt.get('escalation_rate', 0) * 100:.1f}% |",
        f"| Tasa de abandono | {es.get('abandonment_rate', 0) * 100:.1f}% | {pt.get('abandonment_rate', 0) * 100:.1f}% |",
        "",
    ])

    # Top intenciones no resueltas por idioma
    for lang, label in [("es", "Español"), ("pt", "Portugués")]:
        lang_data = lang_comparison.get(lang, {})
        top_intents = lang_data.get("top_unresolved_intents", [])
        if top_intents:
            lines.append(f"### Top Intenciones No Resueltas — {label}")
            for item in top_intents:
                lines.append(f"- {item['intent']}: {item['count']} casos")
            lines.append("")

    # Recomendaciones
    lines.append("## Recomendaciones para el Sprint")

    if priorities["P1"]:
        lines.append("### P1 — Impacto Alto (resolver esta semana)")
        for i, p in enumerate(priorities["P1"], 1):
            lines.extend([
                f"{i}. **{p['intent_label']}** — {p['unresolved_pct']}% sin resolver, frustración {p['avg_frustration']}",
                f"   - Acción: Revisar flujo conversacional de {p['intent_label']}, rediseñar respuestas del bot para confirmar resolución explícitamente",
                f"   - Métrica de éxito: Reducir unresolved_pct a <20% y frustración a <0.5",
                "",
            ])

    if priorities["P2"]:
        lines.append("### P2 — Impacto Medio (próximo sprint)")
        for i, p in enumerate(priorities["P2"], 1):
            lines.extend([
                f"{i}. **{p['intent_label']}** — {p['unresolved_pct']}% sin resolver, frustración {p['avg_frustration']}",
                f"   - Acción: Analizar los 3 turnos previos a la frustración en flujos de {p['intent_label']} e identificar respuestas del bot que no abordan la intención",
                f"   - Métrica de éxito: Reducir unresolved_pct en 50% relativo (de {p['unresolved_pct']}% a {p['unresolved_pct'] / 2:.1f}%)",
                "",
            ])

    if priorities["P3"]:
        lines.append("### P3 — Backlog")
        for p in priorities["P3"]:
            lines.append(f"- {p['intent_label']}: {p['unresolved_pct']}% sin resolver")
        lines.append("")

    return "\n".join(lines)


# ── Recomendaciones con LLM (opcional) ───────────────────────────────────────

_SMART_RECS_PROMPT = """
Eres el Head of Product Analytics de ConversaAI, una plataforma de soporte conversacional
que procesa más de 2 millones de mensajes mensuales en español LATAM y portugués brasileño.

Vas a presentar estas recomendaciones al VP de Producto en la reunión de sprint.
Tu análisis debe ser tan bueno que parezca hecho por un analista humano senior con
10 años de experiencia en CX — no una lista genérica de mejoras.

## Datos del Último Mes
- Total sesiones analizadas: {total_sessions}
- Tasa de escalada emocional: {escalation_rate:.1%}
- Tasa de abandono: {abandonment_rate:.1%}
- Resolution rate: {resolution_rate:.1%}

## Top 5 Flujos con Mayor Frustración
{top_flows_text}

## Top Intenciones No Resueltas
{unresolved_text}

## Tu Análisis Debe Incluir
Para CADA recomendación, piensa como un detective de CX:
1. **Causa raíz**: ¿POR QUÉ este flujo falla? (no solo QUÉ falla)
2. **Acción concreta**: Qué debe cambiar EN EL BOT esta semana/sprint
3. **Métrica de éxito**: Cómo medimos mejora con ESTE MISMO pipeline el mes siguiente
4. **Impacto estimado**: Cuántos usuarios se benefician (basado en volumen de datos)

## Formato de Respuesta
Genera EXACTAMENTE este JSON (sin texto adicional, sin markdown):
{{
  "P1": [
    {{
      "intent": "nombre_intent",
      "action": "Acción específica y ejecutable en 1-2 semanas. Ejemplo: 'En el flujo de reporte_problema, cuando el usuario dice que ya reinició la app, ofrecer escalación automática a L2 con ticket en lugar de repetir troubleshooting básico'",
      "metric": "Métrica medible. Ejemplo: 'Reducir unresolved_pct de 47% a <25% y frustración promedio de 0.74 a <0.5 en el próximo mes'",
      "impact": "Impacto cuantificado. Ejemplo: 'Afecta a ~2,100 sesiones/mes, potencial reducción de 15% en tasa de abandono general'"
    }}
  ],
  "P2": [...],
  "P3": [...]
}}

## Reglas Inquebrantables
- P1: máximo 3 items — los quick wins que más mueven la aguja esta semana
- P2: máximo 5 items — mejoras para el próximo sprint
- P3: el resto para backlog
- NUNCA decir "mejorar el bot en general" o "optimizar la experiencia"
- Cada acción debe ser tan concreta que un PM la pueda convertir en ticket de Jira
- Cada métrica debe ser verificable re-ejecutando este pipeline el mes siguiente
- Piensa en 'customer journeys rotos': conecta la intención no resuelta con la
  frustración y el abandono como una secuencia narrativa, no como datos aislados
"""


async def generate_smart_recommendations(
    global_metrics: dict[str, Any],
    top_flows: list[dict[str, Any]],
    correlations: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]] | None:
    """
    Genera recomendaciones usando el LLM para análisis más profundo.

    Returns:
        Dict con P1/P2/P3 recommendations, o None si falla.
    """
    try:
        from src.llm_factory import get_llm
    except ImportError:
        log.warning("llm_factory_not_available")
        return None

    # Formatear datos para el prompt
    top_flows_text = "\n".join(
        f"- {f['intent_label']}: frustración {f['avg_frustration_score']}, "
        f"{f['frustration_count']} casos, escalada en turno {f.get('escalation_turn', 'N/A')}"
        for f in top_flows[:5]
    ) or "Sin datos"

    unresolved_text = "\n".join(
        f"- {c['intent_label']}: {c['unresolved_pct']}% no resuelto, "
        f"frustración {c['avg_frustration']}, {c['total']} ocurrencias"
        for c in correlations[:10]
    ) or "Sin datos"

    prompt = _SMART_RECS_PROMPT.format(
        total_sessions=global_metrics["total_sessions"],
        escalation_rate=global_metrics["escalation_rate"],
        abandonment_rate=global_metrics["abandonment_rate"],
        resolution_rate=global_metrics["resolution_rate"],
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
) -> dict[str, str]:
    """
    Genera el reporte de insights y el JSON de métricas.

    Args:
        enriched_path: Path al enriched_corpus.jsonl
        smart_recommendations: Si True, usa LLM para generar recomendaciones.

    Returns:
        Dict con paths: {"report": "reports/insights_report.md",
                         "metrics": "data/processed/metrics_summary.json"}
    """
    path = Path(enriched_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus enriquecido no encontrado: {path}")

    log.info("analyst_starting", enriched_path=str(path))

    # Cargar datos
    df = pd.read_json(path, lines=True)

    # Calcular todas las métricas
    global_metrics = calc_global_metrics(df)
    top_flows = calc_top_frustrated_flows(df)
    correlations = calc_intent_frustration_correlation(df)
    abandonment = calc_abandonment_patterns(df)
    lang_comparison = calc_lang_comparison(df)
    priorities = prioritize_recommendations(correlations)

    # Recomendaciones inteligentes con LLM (opcional)
    smart_recs = None
    if smart_recommendations:
        log.info("generating_smart_recommendations")
        smart_recs = await generate_smart_recommendations(
            global_metrics, top_flows, correlations,
        )

    # Determinar período
    period = datetime.now(tz=timezone.utc).strftime("%Y-%m")

    # Generar reporte Markdown
    report_content = _generate_report(
        global_metrics, top_flows, correlations, abandonment,
        priorities, lang_comparison, period,
    )

    # Agregar recomendaciones LLM al reporte si existen
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

    # Generar JSON de métricas para dashboard
    metrics_summary: dict[str, Any] = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "period": period,
        "global": global_metrics,
        "top_frustrated_flows": top_flows,
        "unresolved_intents": correlations[:10],
        "abandonment_patterns": abandonment,
        "lang_comparison": lang_comparison,
    }
    if smart_recs:
        metrics_summary["smart_recommendations"] = smart_recs

    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = output_dir / "metrics_summary.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2, ensure_ascii=False)

    log.info(
        "analyst_completado",
        report=str(report_path),
        metrics=str(metrics_path),
    )

    return {
        "report": str(report_path),
        "metrics": str(metrics_path),
    }

