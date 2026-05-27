import { supabase } from "./supabaseClient";
import type { PriorityFlow } from "./api";

export type Recommendation = {
  id: string;
  priority: "crítico" | "alto" | "oportunidad";
  category: "diseno_experiencia" | "cobertura" | "escalada" | "friccion_repetida" | "experiencia";
  title: string;
  what: string;
  why: string;
  how: string;
  metric: string;
};

export type BusinessInsights = {
  period: string;
  intentMatrix: PriorityFlow[];
  topPriorityFlows: PriorityFlow[];
  repeatIntent: {
    repeat_intent_session_rate: number;
    repeat_sessions: number;
    total_sessions: number;
    top_intents_with_repeats: { intent_label: string; session_count: number }[];
  } | null;
  breakpoints: {
    avg_turn_first_escalation: number | null;
    avg_turn_high_frustration: number | null;
    sessions_with_escalation: number;
    by_intent_escalation: {
      intent_label: string;
      avg_escalation_turn: number | null;
      sessions_with_escalation: number;
    }[];
  } | null;
  recommendations: Recommendation[];
};

function generateRecommendations(
  intentMatrix: PriorityFlow[],
  repeatIntent: BusinessInsights["repeatIntent"],
  breakpoints: BusinessInsights["breakpoints"]
): Recommendation[] {
  const recs: Recommendation[] = [];

  const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // ── Loops del bot ────────────────────────────────────────────────────────
  if (repeatIntent && repeatIntent.repeat_intent_session_rate >= 0.5) {
    const topLoopIntent = repeatIntent.top_intents_with_repeats?.[0];
    recs.push({
      id: "loop-high",
      priority: repeatIntent.repeat_intent_session_rate >= 0.8 ? "crítico" : "alto",
      category: "friccion_repetida",
      title: "El bot no resuelve en el primer intento",
      what: `${(repeatIntent.repeat_intent_session_rate * 100).toFixed(0)}% de sesiones repiten la misma intención 2 o más veces.`,
      why: "Cuando el cliente repite su consulta, significa que la respuesta del bot no fue satisfactoria. Esto genera frustración y aumenta la tasa de abandono.",
      how: topLoopIntent
        ? `Revisar y reescribir las respuestas del intent "${fmt(topLoopIntent.intent_label)}" (${topLoopIntent.session_count} sesiones con loop). Agregar variantes de respuesta y validación de comprensión.`
        : "Auditar las respuestas de los intents con mayor frecuencia de repetición y reescribirlas con confirmación explícita al usuario.",
      metric: `Reducir loops de ${(repeatIntent.repeat_intent_session_rate * 100).toFixed(0)}% a menos del 20% en el próximo período.`,
    });
  }

  // ── Escalada temprana ────────────────────────────────────────────────────
  if (breakpoints && breakpoints.avg_turn_first_escalation !== null && breakpoints.avg_turn_first_escalation <= 2) {
    recs.push({
      id: "escalation-early",
      priority: "crítico",
      category: "escalada",
      title: "Los clientes piden hablar con una persona desde el primer mensaje",
      what: `La escalada a agente humano ocurre en promedio en el turno ${breakpoints.avg_turn_first_escalation}. Hay ${breakpoints.sessions_with_escalation} sesiones con escalada.`,
      why: "Una escalada en el turno 1 o 2 indica que el bot no está entendiendo la intención inicial del cliente, o que el mensaje de bienvenida genera desconfianza.",
      how: "1) Revisar el mensaje de bienvenida del bot para que sea más claro y confiable. 2) Mejorar el intent recognition para los primeros mensajes. 3) Agregar quick replies con las consultas más frecuentes.",
      metric: `Mover la primera escalada del turno ${breakpoints.avg_turn_first_escalation} al turno 5 o superior.`,
    });
  } else if (breakpoints && breakpoints.sessions_with_escalation > 0) {
    recs.push({
      id: "escalation-medium",
      priority: "alto",
      category: "escalada",
      title: "Reducir la cantidad de clientes que piden hablar con una persona",
      what: `${breakpoints.sessions_with_escalation} sesiones terminaron escalando a un agente humano.`,
      why: "Cada escalada tiene un costo operativo directo. Si el bot pudiera resolver más casos, se reduce carga del equipo de soporte.",
      how: "Identificar los intents más frecuentes en sesiones con escalada y crear respuestas más completas o flujos de auto-servicio.",
      metric: "Reducir sesiones con escalada en un 30% en el próximo período.",
    });
  }

  // ── Frustración alta en turno muy temprano ───────────────────────────────
  if (breakpoints && breakpoints.avg_turn_high_frustration !== null && breakpoints.avg_turn_high_frustration <= 1) {
    recs.push({
      id: "frustration-early",
      priority: "crítico",
      category: "experiencia",
      title: "Malestar del cliente detectado desde el inicio de la conversación",
      what: `La frustración alta aparece en promedio en el turno ${breakpoints.avg_turn_high_frustration}.`,
      why: "Si el cliente ya está frustrado en los primeros mensajes, probablemente llega con una experiencia previa negativa (intentó resolver antes y no pudo) o el bot no está respondiendo lo que espera.",
      how: "Agregar detección de tono negativo en los primeros mensajes y ofrecer escalada proactiva o disculpa + alternativa antes de que el cliente la pida.",
      metric: "Reducir sesiones con frustración en turno ≤2 en un 40%.",
    });
  }

  // ── Intents con alto impacto sin resolver ────────────────────────────────
  const criticalIntents = intentMatrix.filter(
    (f) => f.unresolved_pct > 50 && f.session_count >= 2
  );
  criticalIntents.slice(0, 2).forEach((intent, i) => {
    recs.push({
      id: `intent-unresolved-${intent.intent_label}`,
      priority: i === 0 ? "alto" : "oportunidad",
      category: "cobertura",
      title: `Mejorar atención a la solicitud "${fmt(intent.intent_label)}"`,
      what: `${intent.unresolved_pct}% de las conversaciones sobre "${fmt(intent.intent_label)}" (${intent.session_count} sesiones) no se resuelven.`,
      why: "Un intent con alta tasa de no-resolución indica que el bot no tiene respuestas adecuadas para esa consulta, o que el flujo no lleva al cliente a una solución.",
      how: `Revisar el flujo de "${fmt(intent.intent_label)}", agregar más utterances de entrenamiento y asegurar que el flujo tenga un happy path claro con confirmación al final.`,
      metric: `Llevar la tasa de resolución de "${fmt(intent.intent_label)}" por encima del 70%.`,
    });
  });

  // ── Si todo va bien ──────────────────────────────────────────────────────
  if (recs.length === 0) {
    recs.push({
      id: "baseline-ok",
      priority: "oportunidad",
      category: "diseno_experiencia",
      title: "El bot tiene buen desempeño base — enfocarse en escala",
      what: "No se detectaron patrones críticos de fallo en el período actual.",
      why: "Con un corpus pequeño los indicadores pueden ser engañosos. Al crecer el volumen aparecerán patrones más claros.",
      how: "Ejecutar el pipeline con un corpus más grande (>100 sesiones) para obtener recomendaciones más precisas. Mientras tanto, documentar los casos edge que aparezcan en soporte.",
      metric: "Objetivo: procesar al menos 100 sesiones únicas antes del próximo reporte.",
    });
  }

  const ORDER = { "crítico": 0, "alto": 1, "oportunidad": 2 };
  return recs.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}

export async function fetchBusinessInsights(): Promise<BusinessInsights | null> {
  const { data: snapshots } = await supabase
    .from("metrics_snapshots")
    .select("period, metrics_json")
    .order("period", { ascending: false })
    .limit(1);

  const row = snapshots?.[0];
  if (!row?.metrics_json) return null;

  const m = row.metrics_json as Record<string, unknown>;
  const business = (m.business ?? {}) as Record<string, unknown>;

  const intentMatrix = (m.intent_matrix ?? business.intent_matrix ?? []) as PriorityFlow[];
  const repeatIntent = (business.repeat_intent as BusinessInsights["repeatIntent"]) ?? null;
  const breakpoints = (business.breakpoints as BusinessInsights["breakpoints"]) ?? null;

  return {
    period: String(row.period ?? m.period ?? ""),
    intentMatrix,
    topPriorityFlows: (m.top_priority_flows ?? business.top_priority_flows ?? []) as PriorityFlow[],
    repeatIntent,
    breakpoints,
    recommendations: generateRecommendations(intentMatrix, repeatIntent, breakpoints),
  };
}
