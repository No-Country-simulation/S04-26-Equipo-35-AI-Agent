"use client";

import { useTheme } from "../context/theme-context";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { GlobalKPIs } from "../lib/api";

type Kpi = {
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
  deltaIcon?: "up" | "down" | "neutral";
  // For "up" metrics (like resolution), going up is good.
  // For "down" metrics (like frustration), going down is good.
  invertedPolarity?: boolean;
};

function DeltaIndicator({
  icon,
  inverted,
  colors,
}: {
  icon?: "up" | "down" | "neutral";
  inverted?: boolean;
  colors: { success: string; error: string; textMuted: string };
}) {
  if (!icon || icon === "neutral") {
    return <Minus size={10} style={{ color: colors.textMuted }} />;
  }

  const isGood = inverted ? icon === "down" : icon === "up";
  const color = isGood ? colors.success : colors.error;

  return icon === "up" ? (
    <TrendingUp size={10} style={{ color }} />
  ) : (
    <TrendingDown size={10} style={{ color }} />
  );
}

export function KpiRow({ data }: { data?: GlobalKPIs }) {
  const { colors } = useTheme();
  const deltas = data?.deltas;

  // Helper to format delta strings
  const fmtDelta = (val: number | undefined, suffix: string = "pp"): string => {
    if (val === undefined || val === null) return "Sin datos previos";
    if (val === 0) return "Sin cambio";
    const sign = val > 0 ? "+" : "";
    return `${sign}${val}${suffix} vs período anterior`;
  };

  const getDeltaDirection = (val: number | undefined): "up" | "down" | "neutral" => {
    if (val === undefined || val === null || val === 0) return "neutral";
    return val > 0 ? "up" : "down";
  };

  const getDeltaColor = (val: number | undefined, inverted: boolean = false): string => {
    if (val === undefined || val === null || val === 0) return colors.textMuted;
    const isGood = inverted ? val < 0 : val > 0;
    return isGood ? colors.success : colors.error;
  };

  const kpis: Kpi[] = [
    {
      label: "TASA DE RESOLUCIÓN",
      value: data?.resolutionRate || "0%",
      delta: deltas
        ? fmtDelta(deltas.resolution_rate_delta)
        : "Calculado por IA",
      deltaColor: deltas
        ? getDeltaColor(deltas.resolution_rate_delta)
        : colors.textMuted,
      deltaIcon: deltas ? getDeltaDirection(deltas.resolution_rate_delta) : undefined,
    },
    {
      label: "NIVEL DE MALESTAR",
      value: data?.frustrationIndex || "0/2",
      delta: deltas
        ? fmtDelta(deltas.frustration_pct_delta, "%")
        : "Promedio del período",
      deltaColor: deltas
        ? getDeltaColor(deltas.frustration_pct_delta, true)
        : colors.textMuted,
      deltaIcon: deltas ? getDeltaDirection(deltas.frustration_pct_delta) : undefined,
      invertedPolarity: true,
    },
    {
      label: "SOLICITUDES SIN ATENDER",
      value: data?.unresolvedCount || "0",
      delta: deltas
        ? fmtDelta(deltas.abandonment_rate_delta)
        : "Oportunidades de mejora",
      deltaColor: deltas
        ? getDeltaColor(deltas.abandonment_rate_delta, true)
        : colors.error,
      deltaIcon: deltas ? getDeltaDirection(deltas.abandonment_rate_delta) : undefined,
      invertedPolarity: true,
    },
    {
      label: "PUNTOS DE FRICCIÓN",
      value: data?.criticalFlows || "0",
      delta: `${data?.churnRate || 0}% riesgo de churn`,
      deltaColor: colors.error,
      deltaIcon: deltas ? getDeltaDirection(deltas.churn_rate_delta) : undefined,
      invertedPolarity: true,
    },
  ];

  const cardStyle: React.CSSProperties = {
    background: colors.card,
    backdropFilter: "blur(12px)",
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: "18px 22px",
    minHeight: 100,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.04)",
    transition: "all 0.2s ease",
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 16, alignItems: "stretch" }}>
      {kpis.map((k) => (
        <div key={k.label} style={cardStyle} className="transition-transform hover:-translate-y-1">
          <div
            style={{
              color: colors.textMuted,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {k.label}
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 32, fontWeight: 600, lineHeight: 1.1 }}>
            {k.value}
          </div>
          <div
            style={{
              color: k.deltaColor,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {k.deltaIcon && (
              <DeltaIndicator
                icon={k.deltaIcon}
                inverted={k.invertedPolarity}
                colors={colors}
              />
            )}
            {k.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
