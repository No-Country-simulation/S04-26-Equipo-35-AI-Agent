// ─── Alert Types & Generator (Server-compatible) ──────────────────────────────
// This file has NO "use client" directive so it can be called from Server Components.

export type Alert = {
  id: string;
  type: "frustration_spike" | "churn_risk" | "resolution_drop" | "escalation_surge";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  metric_value: number;
  threshold: number;
  affected_intent?: string;
  affected_region?: string;
  triggered_at: string;
  acknowledged: boolean;
};

export function generateAlerts(kpis: {
  churnRate: number;
  frustrationIndex: string;
  resolutionRate: string;
  totalSessions: number;
  deltas?: {
    frustration_pct_delta: number;
    churn_rate_delta: number;
    resolution_rate_delta: number;
    escalation_rate_delta: number;
  };
}): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  const frustIdx = parseFloat(kpis.frustrationIndex.split("/")[0]) || 0;
  const resRate = parseInt(kpis.resolutionRate) || 0;
  const deltas = kpis.deltas;

  // 1. Churn rate alert
  if (kpis.churnRate > 15) {
    alerts.push({
      id: "alert-churn",
      type: "churn_risk",
      severity: kpis.churnRate > 25 ? "critical" : "warning",
      title: "Riesgo de Churn Elevado",
      description: `${kpis.churnRate}% de las sesiones muestran riesgo de abandono de cliente. ${
        kpis.churnRate > 25
          ? "Se requiere acción inmediata del equipo de retención."
          : "Monitorear de cerca en las próximas horas."
      }`,
      metric_value: kpis.churnRate,
      threshold: 15,
      triggered_at: now,
      acknowledged: false,
    });
  }

  // 2. Frustration index alert
  if (frustIdx > 1.2) {
    alerts.push({
      id: "alert-frustration",
      type: "frustration_spike",
      severity: frustIdx > 1.5 ? "critical" : "warning",
      title: "Pico de Frustración Detectado",
      description: `El índice de frustración promedio es ${frustIdx}/2.0, superando el umbral de 1.2. ${
        deltas && deltas.frustration_pct_delta > 0
          ? `Aumentó ${deltas.frustration_pct_delta}% vs período anterior.`
          : ""
      }`,
      metric_value: frustIdx,
      threshold: 1.2,
      triggered_at: now,
      acknowledged: false,
    });
  }

  // 3. Low resolution rate
  if (resRate < 50) {
    alerts.push({
      id: "alert-resolution",
      type: "resolution_drop",
      severity: resRate < 30 ? "critical" : "warning",
      title: "Tasa de Resolución Baja",
      description: `Solo ${resRate}% de las sesiones se resuelven satisfactoriamente. ${
        deltas && deltas.resolution_rate_delta < 0
          ? `Cayó ${Math.abs(deltas.resolution_rate_delta)}pp vs período anterior.`
          : ""
      }`,
      metric_value: resRate,
      threshold: 50,
      triggered_at: now,
      acknowledged: false,
    });
  }

  // 4. Escalation surge (from deltas)
  if (deltas && deltas.escalation_rate_delta > 5) {
    alerts.push({
      id: "alert-escalation",
      type: "escalation_surge",
      severity: deltas.escalation_rate_delta > 10 ? "critical" : "warning",
      title: "Aumento de Escalaciones",
      description: `Las escalaciones aumentaron ${deltas.escalation_rate_delta}pp vs el período anterior. Revisar la capacidad del equipo de soporte L2.`,
      metric_value: deltas.escalation_rate_delta,
      threshold: 5,
      triggered_at: now,
      acknowledged: false,
    });
  }

  // If everything is fine
  if (alerts.length === 0) {
    alerts.push({
      id: "alert-ok",
      type: "frustration_spike",
      severity: "info",
      title: "Todo en Orden",
      description: "No se detectaron alertas. Todas las métricas están dentro de los umbrales normales.",
      metric_value: 0,
      threshold: 0,
      triggered_at: now,
      acknowledged: true,
    });
  }

  return alerts;
}
