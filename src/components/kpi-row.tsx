"use client";

import { useTheme } from "../context/theme-context";

import { GlobalKPIs } from "../lib/api";

type Kpi = { label: string; value: string; delta: string; deltaColor: string };

export function KpiRow({ data }: { data?: GlobalKPIs }) {
  const { colors } = useTheme();

  const kpis: Kpi[] = [
    { label: "TASA DE RESOLUCIÓN", value: data?.resolutionRate || "0%", delta: "Calculado por IA", deltaColor: colors.textMuted },
    { label: "ÍNDICE DE FRUSTRACIÓN", value: data?.frustrationIndex || "0/2", delta: "Promedio de la muestra", deltaColor: colors.textMuted },
    { label: "INTENCIONES SIN RESOLVER", value: data?.unresolvedCount || "0", delta: "Tickets estancados", deltaColor: colors.error },
    { label: "FLUJOS CRÍTICOS", value: data?.criticalFlows || "0", delta: `${data?.churnRate || 0}% riesgo de churn`, deltaColor: colors.error },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 16,
    height: 110,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12, alignItems: "stretch" }}>
      {kpis.map((k) => (
        <div key={k.label} style={cardStyle}>
          <div
            style={{
              color: colors.textMuted,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {k.label}
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 28, fontWeight: 600 }}>
            {k.value}
          </div>
          <div style={{ color: k.deltaColor, fontSize: 11 }}>{k.delta}</div>
        </div>
      ))}
    </div>
  );
}
