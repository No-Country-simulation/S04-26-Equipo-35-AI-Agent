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

from src.analytics.business_metrics import build_business_metrics, prioritize_by_impact

log = structlog.get_logger()


# ── Métricas globales ────────────────────────────────────────────────────────


def calc_global_metrics(df: pd.DataFrame) -> dict[str, Any]:
    """Calcula métricas globales del corpus enriquecido."""
    processed_sessions = df[df["sentiment_label"].notna()]["session_id"].unique()
    total_sessions = len(processed_sessions)
    if total_sessions == 0:
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

        processed_sessions = region_df[region_df["sentiment_label"].notna()]["session_id"].unique()
        total_sessions = len(processed_sessions)
        if total_sessions == 0:
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
    Crítico (P1 interno): unresolved_pct > 40 AND avg_frustration > 0.7
    Alto (P2 interno):    unresolved_pct entre 20-40 OR avg_frustration > 0.5
    Oportunidad (P3):     todo lo demás. Max: 3 críticos, 5 altos.

    Nota: las claves del dict retornado siguen siendo "P1"/"P2"/"P3" por
    compatibilidad con Supabase y snapshots existentes. Los labels de display
    se traducen en _generate_report y en el frontend.
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


# ── Generación de User Stories ───────────────────────────────────────────────


# Mapeo de intenciones a acciones concretas de producto (estándar de la industria)
_INTENT_TO_ACTION: dict[str, dict[str, str]] = {
    "reporte_problema": {
        "action": "escalar automáticamente a soporte L2 cuando el bot detecte que el troubleshooting básico ya fue intentado",
        "benefit": "no tenga que repetir mi problema múltiples veces y reciba una solución real en el primer contacto",
        "ac": "Dado que el usuario reportó un problema y el bot ya ofreció reinicio/troubleshooting, Cuando el usuario indica que no se resolvió, Entonces el sistema escala a un agente L2 con el contexto completo de la conversación",
    },
    "solicitud_reembolso": {
        "action": "ver el estado de mi solicitud de reembolso en tiempo real con un ETA claro",
        "benefit": "no tenga que preguntar repetidamente por el estado y sepa exactamente cuándo se resolverá",
        "ac": "Dado que el usuario solicita un reembolso, Cuando el bot confirma la solicitud, Entonces muestra un número de seguimiento y un ETA estimado en días hábiles",
    },
    "queja_servicio": {
        "action": "ser transferido a un agente humano en menos de 2 minutos cuando expreso insatisfacción con el servicio",
        "benefit": "mi frustración sea atendida por alguien que pueda ofrecer soluciones personalizadas",
        "ac": "Dado que el usuario expresa queja o solicita un humano, Cuando el sentiment_score supera 0.7, Entonces el bot ofrece transferencia inmediata a un agente y notifica al equipo de CX",
    },
    "consulta_estado": {
        "action": "recibir actualizaciones proactivas sobre el estado de mi pedido o reclamo",
        "benefit": "no tenga que iniciar una nueva conversación cada vez que quiero saber el progreso",
        "ac": "Dado que el usuario tiene un ticket/pedido abierto, Cuando hay un cambio de estado, Entonces el sistema envía una notificación push o email con el nuevo estado",
    },
    "cancelacion": {
        "action": "completar la cancelación de mi servicio en un solo paso sin obstáculos artificiales",
        "benefit": "el proceso sea transparente y no genere más frustración que la que ya siento",
        "ac": "Dado que el usuario solicita cancelación, Cuando confirma la solicitud, Entonces el sistema procesa la cancelación y ofrece un resumen de lo que pierde y alternativas de retención sin bloquear la cancelación",
    },
    "consulta_saldo": {
        "action": "ver mi saldo, crédito y deuda en una respuesta clara y estructurada del bot",
        "benefit": "obtenga la información financiera que necesito sin ambigüedades ni pasos adicionales",
        "ac": "Dado que el usuario pregunta por su saldo, Cuando el bot responde, Entonces muestra el saldo actual, crédito disponible y próxima fecha de pago en un formato visual claro",
    },
    "cambio_datos": {
        "action": "actualizar mis datos personales directamente desde el chat sin necesidad de llamar o ir a una sucursal",
        "benefit": "el proceso sea rápido, seguro y confirme los cambios realizados",
        "ac": "Dado que el usuario quiere cambiar sus datos, Cuando verifica su identidad, Entonces puede actualizar nombre, email o teléfono y recibe confirmación inmediata",
    },
    "solicitud_info": {
        "action": "recibir información precisa y contextualizada sobre productos o servicios disponibles",
        "benefit": "pueda tomar decisiones informadas sin tener que buscar en múltiples fuentes",
        "ac": "Dado que el usuario pregunta por un producto/servicio, Cuando el bot responde, Entonces incluye precio, disponibilidad, condiciones y un enlace directo para contratar",
    },
    "logistica_envio": {
        "action": "rastrear mi envío en tiempo real con información actualizada del transportista",
        "benefit": "sepa exactamente dónde está mi paquete y cuándo llegará sin tener que preguntar",
        "ac": "Dado que el usuario pregunta por un envío, Cuando el bot consulta el sistema de tracking, Entonces muestra ubicación actual, historial de movimientos y ETA actualizado",
    },
    "problema_pago": {
        "action": "resolver errores de pago con opciones claras de métodos alternativos y soporte inmediato",
        "benefit": "pueda completar mi transacción sin frustración ni pérdida de tiempo",
        "ac": "Dado que el usuario reporta un error de pago, Cuando el bot identifica el tipo de error, Entonces ofrece métodos de pago alternativos y contacto directo con el equipo de pagos si persiste",
    },
}

# Fallback genérico para intenciones no mapeadas
_DEFAULT_ACTION: dict[str, str] = {
    "action": "recibir una respuesta clara y útil del bot que resuelva mi necesidad en la primera interacción",
    "benefit": "no tenga que repetir mi solicitud ni buscar otros canales de soporte",
    "ac": "Dado que el usuario contacta soporte, Cuando expresa su necesidad, Entonces el bot proporciona una respuesta accionable con pasos concretos o escalación si no puede resolver",
}


def generate_user_stories(
    priorities: dict[str, list[dict[str, Any]]],
    global_metrics: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Genera User Stories accionables a partir de las prioridades calculadas.

    Formato estándar de mercado:
      "Como [rol], quiero [acción], para que [beneficio]"
      + Criterios de Aceptación (Gherkin)
      + Métrica de éxito medible

    Returns:
        Lista de diccionarios con las User Stories listas para ser persistidas
        o renderizadas en el dashboard.
    """
    stories: list[dict[str, Any]] = []
    story_id = 0

    for priority_key in ["P1", "P2", "P3"]:
        items = priorities.get(priority_key, [])
        for item in items:
            story_id += 1
            intent = item.get("intent_label", "desconocido")
            unresolved_pct = item.get("unresolved_pct", 0)
            avg_frust = item.get("avg_frustration", 0)
            total_cases = item.get("total", 0)

            # Buscar acción y beneficio específicos para esta intención
            action_map = _INTENT_TO_ACTION.get(intent, _DEFAULT_ACTION)

            # Nombre legible de la intención
            readable_intent = intent.replace("_", " ").title()

            # Construir la User Story
            impact_score = item.get("impact_score", 0)

            story: dict[str, Any] = {
                "id": f"US-{story_id:03d}",
                "priority": priority_key,
                "intent": intent,
                "impact_score": impact_score,
                "title": f"Mejorar flujo de '{readable_intent}' — {unresolved_pct}% sin resolver",
                "user_story": (
                    f"Como usuario de soporte de ConversaAI, "
                    f"quiero {action_map['action']}, "
                    f"para que {action_map['benefit']}."
                ),
                "acceptance_criteria": action_map["ac"],
                "success_metric": (
                    f"Reducir la tasa de no resolución de '{readable_intent}' "
                    f"del {unresolved_pct}% actual al {max(unresolved_pct - 15, 5)}% "
                    f"y la frustración promedio de {avg_frust} a {max(avg_frust - 0.2, 0.1):.2f} "
                    f"en el próximo ciclo de análisis."
                ),
                "impact": {
                    "affected_sessions": total_cases,
                    "current_unresolved_pct": unresolved_pct,
                    "current_avg_frustration": avg_frust,
                },
                "severity": (
                    "crítico" if priority_key == "P1"
                    else "alto" if priority_key == "P2"
                    else "medio"
                ),
            }
            stories.append(story)

    return stories


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
    _PM_LABELS = {
        "P1": "🔴 Crítico — Acción inmediata",
        "P2": "🟡 Alta Prioridad — Próximo sprint",
        "P3": "🔵 Oportunidad — Backlog",
    }
    for priority_key, label in [("P1", _PM_LABELS["P1"]), ("P2", _PM_LABELS["P2"]), ("P3", _PM_LABELS["P3"])]:
        items = priorities[priority_key]
        if items:
            lines.append(f"### {label}")
            for i, p in enumerate(items, 1):
                lines.append(f"{i}. **{p['intent_label']}** — {p['unresolved_pct']}% sin resolver, malestar {p['avg_frustration']}")
            lines.append("")

    return "\n".join(lines)


# ── Recomendaciones con LLM (opcional) ───────────────────────────────────────

_SMART_RECS_PROMPT = """
Eres el Head of Product Analytics de ConversaAI, una plataforma de soporte
que procesa 2M+ mensajes/mes en español LATAM y portugués brasileño.

## Datos del Último Mes
- Total sesiones: {total_sessions}
- Tasa de escalada a humano: {escalation_rate:.1%}
- Tasa de abandono: {abandonment_rate:.1%}
- Tasa de resolución: {resolution_rate:.1%}
- Riesgo de abandono (churn): {churn_rate:.1%}

## Top Solicitudes con Mayor Malestar del Cliente
{top_flows_text}

## Top Solicitudes Sin Resolver
{unresolved_text}

Genera EXACTAMENTE este JSON (sin texto adicional):
{{
  "P1": [{{"intent": "nombre", "action": "acción concreta", "metric": "métrica medible", "impact": "impacto cuantificado"}}],
  "P2": [...],
  "P3": [...]
}}

Reglas:
- P1 = crítico, máximo 3 acciones de impacto inmediato
- P2 = alta prioridad, máximo 5 mejoras para el próximo sprint
- P3 = oportunidades de mejora para el backlog
- Cada acción debe redactarse como un ticket de Jira
- Usa lenguaje de equipo de producto (PM), no técnico
"""


async def generate_smart_recommendations(
    global_metrics: dict[str, Any],
    top_flows: list[dict[str, Any]],
    correlations: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]] | None:
    """Genera recomendaciones usando el LLM."""
    try:
        from src.core.llm.client import get_llm
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
    if not use_db:
        if not path.exists():
            raise FileNotFoundError(f"Corpus no encontrado: {path}")
        df = pd.read_json(path, lines=True)
    else:
        from src.db.supabase_client import get_supabase
        sb = get_supabase()
        rows = sb.table("messages").select("*").execute().data
        df = pd.DataFrame(rows)
        if df.empty:
            raise RuntimeError("No hay mensajes en Supabase. Ejecutá ETL primero.")

    log.info("analyst_starting", enriched_path=str(path) if not use_db else "[from DB]", rows=len(df))

    # Calcular métricas
    global_metrics = calc_global_metrics(df)
    top_flows = calc_top_frustrated_flows(df)
    correlations = calc_intent_frustration_correlation(df)
    abandonment = calc_abandonment_patterns(df)
    region_comparison = calc_region_comparison(df)
    business = build_business_metrics(df)
    priorities = business["priorities"]
    intent_matrix = business["intent_matrix"]

    # Generar User Stories accionables (ordenadas por impacto)
    user_stories = generate_user_stories(priorities, global_metrics)
    user_stories.sort(key=lambda s: s.get("impact_score", 0), reverse=True)
    log.info("user_stories_generated", count=len(user_stories))

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

    if business.get("top_priority_flows"):
        report_content += "\n\n## 🎯 Flujos prioritarios (impacto de negocio)\n\n"
        for i, flow in enumerate(business["top_priority_flows"], 1):
            report_content += (
                f"{i}. **{flow['intent_label']}** — impacto {flow['impact_score']:.3f}, "
                f"IRR {flow['irr']*100:.0f}%, {flow['unresolved_pct']}% sin resolver, "
                f"frustración media {flow['avg_frustration']:.2f}\n"
            )
    bp = business.get("breakpoints", {})
    if bp.get("avg_turn_first_escalation") is not None:
        report_content += (
            f"\n**Turno medio de primera escalada:** {bp['avg_turn_first_escalation']}\n"
        )
    rep = business.get("repeat_intent", {})
    if rep.get("repeat_intent_session_rate"):
        report_content += (
            f"**Sesiones con intención repetida (loop):** "
            f"{rep['repeat_intent_session_rate']*100:.1f}%\n"
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

    # Añadir User Stories al reporte
    if user_stories:
        report_content += "\n\n---\n\n## 📋 User Stories para el Sprint\n\n"
        for story in user_stories:
            severity_emoji = "🔴" if story["severity"] == "crítico" else "🟡" if story["severity"] == "alto" else "🔵"
            report_content += (
                f"### {severity_emoji} {story['id']} — {story['title']}\n\n"
                f"> {story['user_story']}\n\n"
                f"**Criterios de Aceptación:**\n"
                f"{story['acceptance_criteria']}\n\n"
                f"**Métrica de Éxito:**\n"
                f"{story['success_metric']}\n\n"
                f"**Impacto:** {story['impact']['affected_sessions']} sesiones afectadas\n\n"
                f"---\n\n"
            )

    reports_dir = Path("reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_path = reports_dir / "insights_report.md"
    report_path.write_text(report_content, encoding="utf-8")

    # Métricas JSON v2
    metrics_summary: dict[str, Any] = {
        "version": 2,
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "period": period,
        "global": global_metrics,
        "business": business,
        "intent_matrix": intent_matrix,
        "top_priority_flows": business["top_priority_flows"],
        "top_frustrated_flows": top_flows,
        "unresolved_intents": correlations[:10],
        "abandonment_patterns": abandonment,
        "region_comparison": region_comparison,
        "user_stories": user_stories,
    }

    # ── Análisis Longitudinal (Fase 2) ───────────────────────────────────
    # Comparar métricas actuales vs período anterior
    if use_db:
        try:
            prev_metrics = await _fetch_previous_period_metrics(period)
            if prev_metrics:
                deltas = _calc_deltas(global_metrics, prev_metrics)
                metrics_summary["previous_period"] = prev_metrics.get("period", "N/A")
                metrics_summary["deltas"] = deltas
                log.info(
                    "longitudinal_analysis_done",
                    prev_period=prev_metrics.get("period"),
                    deltas=deltas,
                )
            else:
                log.info("no_previous_period_found", current=period)
        except Exception as e:
            log.warning("longitudinal_analysis_failed", error=str(e))

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

    # Guardar User Stories como archivo JSON independiente para el dashboard
    stories_path = output_dir / "user_stories.json"
    with open(stories_path, "w", encoding="utf-8") as f:
        json.dump(user_stories, f, indent=2, ensure_ascii=False)
    log.info("user_stories_saved", path=str(stories_path))

    if use_db:
        await _save_metrics_snapshot(period, metrics_summary)
        await _save_user_stories(user_stories, period)

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
            # qdrant-client >= 1.7 usa query_points() en lugar del deprecado search()
            response = qdrant.query_points(
                collection_name=COLLECTION_NAME,
                query=vector,
                limit=5,
                score_threshold=0.7,
            )
            results = response.points
            if results:
                insights.append({
                    "pattern": sq["pattern"],
                    "matches_found": len(results),
                    "top_matches": [
                        {
                            "session_id": r.payload.get("session_id", "") if r.payload else "",
                            "text_preview": r.payload.get("text_preview", "") if r.payload else "",
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


async def _save_user_stories(
    stories: list[dict[str, Any]], period: str,
) -> None:
    """Persiste User Stories en Supabase para consumo del dashboard."""
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    for story in stories:
        try:
            row = {
                "story_id": story["id"],
                "period": period,
                "priority": story["priority"],
                "severity": story["severity"],
                "intent": story["intent"],
                "title": story["title"],
                "user_story": story["user_story"],
                "acceptance_criteria": story["acceptance_criteria"],
                "success_metric": story["success_metric"],
                "affected_sessions": story["impact"]["affected_sessions"],
                "current_unresolved_pct": story["impact"]["current_unresolved_pct"],
                "current_avg_frustration": story["impact"]["current_avg_frustration"],
                "status": "backlog",
            }
            sb.table("user_stories").upsert(row, on_conflict="story_id,period").execute()
        except Exception as e:
            log.error("user_story_save_failed", story_id=story["id"], error=str(e))

    log.info("user_stories_persisted", count=len(stories), period=period)


# ── Análisis Longitudinal — Helpers (Fase 2) ─────────────────────────────


async def _fetch_previous_period_metrics(current_period: str) -> dict[str, Any] | None:
    """
    Obtiene las métricas del período anterior al actual desde Supabase.
    Busca el snapshot más reciente con period < current_period.
    """
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    result = (
        sb.table("metrics_snapshots")
        .select("period, metrics_json")
        .lt("period", current_period)
        .order("period", desc=True)
        .limit(1)
        .execute()
    )

    if result.data and len(result.data) > 0:
        row = result.data[0]
        metrics = row.get("metrics_json", {})
        metrics["period"] = row.get("period", "unknown")
        return metrics

    return None


def _calc_deltas(
    current: dict[str, Any],
    previous_snapshot: dict[str, Any],
) -> dict[str, Any]:
    """
    Calcula los deltas (cambios porcentuales) entre el período actual y el anterior.

    Returns dict con:
      - resolution_rate_delta: cambio en puntos porcentuales
      - escalation_rate_delta
      - abandonment_rate_delta
      - churn_rate_delta
      - frustration_delta: cambio en distribución de frustrados
      Valores positivos = aumentó, negativos = disminuyó
    """
    prev_global = previous_snapshot.get("global", {})

    def _delta(current_val: float, prev_val: float) -> float:
        """Calcula delta en puntos porcentuales."""
        return round((current_val - prev_val) * 100, 1)

    def _pct_change(current_val: float, prev_val: float) -> float:
        """Calcula cambio porcentual relativo."""
        if prev_val == 0:
            return 0.0
        return round(((current_val - prev_val) / prev_val) * 100, 1)

    resolution_curr = current.get("resolution_rate", 0)
    resolution_prev = prev_global.get("resolution_rate", 0)

    escalation_curr = current.get("escalation_rate", 0)
    escalation_prev = prev_global.get("escalation_rate", 0)

    abandonment_curr = current.get("abandonment_rate", 0)
    abandonment_prev = prev_global.get("abandonment_rate", 0)

    churn_curr = current.get("churn_rate", 0)
    churn_prev = prev_global.get("churn_rate", 0)

    curr_sentiment = current.get("sentiment_distribution", {})
    prev_sentiment = prev_global.get("sentiment_distribution", {})

    frustration_curr = curr_sentiment.get("frustrado", 0)
    frustration_prev = prev_sentiment.get("frustrado", 0)

    return {
        "resolution_rate_delta": _delta(resolution_curr, resolution_prev),
        "resolution_rate_pct_change": _pct_change(resolution_curr, resolution_prev),
        "escalation_rate_delta": _delta(escalation_curr, escalation_prev),
        "abandonment_rate_delta": _delta(abandonment_curr, abandonment_prev),
        "churn_rate_delta": _delta(churn_curr, churn_prev),
        "frustration_pct_delta": round(frustration_curr - frustration_prev, 1),
        "previous_period": previous_snapshot.get("period", "N/A"),
    }

