"use client";

import { useTheme } from "../context/theme-context";
import { AlertTriangle, TrendingUp, Users, Clock, Bell, BellOff } from "lucide-react";
import type { Alert } from "../lib/alerts";

// Re-export for convenience
export type { Alert } from "../lib/alerts";
export { generateAlerts } from "../lib/alerts";


// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  const { colors } = useTheme();

  const severityConfig = {
    critical: {
      bg: `${colors.error}12`,
      border: `${colors.error}30`,
      icon: <AlertTriangle size={16} style={{ color: colors.error }} />,
      badge: { bg: colors.error, text: "#fff", label: "CRÍTICO" },
    },
    warning: {
      bg: `${colors.warning}12`,
      border: `${colors.warning}30`,
      icon: <TrendingUp size={16} style={{ color: colors.warning }} />,
      badge: { bg: colors.warning, text: "#000", label: "ALERTA" },
    },
    info: {
      bg: `${colors.success}08`,
      border: `${colors.success}30`,
      icon: <Bell size={16} style={{ color: colors.success }} />,
      badge: { bg: colors.success, text: "#fff", label: "OK" },
    },
  };

  const typeIcons: Record<string, React.ReactNode> = {
    churn_risk: <Users size={14} style={{ color: colors.error }} />,
    frustration_spike: <AlertTriangle size={14} style={{ color: colors.warning }} />,
    resolution_drop: <Clock size={14} style={{ color: colors.warning }} />,
    escalation_surge: <TrendingUp size={14} style={{ color: colors.error }} />,
  };

  const config = severityConfig[alert.severity];

  return (
    <div
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 10,
        padding: 14,
        borderLeft: `3px solid ${config.badge.bg}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          <div style={{ marginTop: 2 }}>{config.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: config.badge.text,
                  backgroundColor: config.badge.bg,
                  padding: "1px 6px",
                  borderRadius: 3,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {config.badge.label}
              </span>
              <span style={{ fontSize: 10, color: colors.textMuted }}>
                {typeIcons[alert.type]}
              </span>
            </div>
            <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {alert.title}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
              {alert.description}
            </div>

            {/* Metric bar */}
            {alert.threshold > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: colors.textMuted }}>Umbral: {alert.threshold}</span>
                  <span style={{ fontSize: 10, color: config.badge.bg, fontWeight: 600 }}>
                    Actual: {alert.metric_value}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    backgroundColor: `${colors.textMuted}20`,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((alert.metric_value / (alert.threshold * 2)) * 100, 100)}%`,
                      backgroundColor: config.badge.bg,
                      borderRadius: 2,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Acknowledge */}
        {!alert.acknowledged && alert.severity !== "info" && (
          <button
            style={{
              background: "none",
              border: `1px solid ${colors.textMuted}30`,
              borderRadius: 6,
              padding: "4px 8px",
              color: colors.textMuted,
              fontSize: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <BellOff size={10} />
            Silenciar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Alerts Panel (Main Component) ────────────────────────────────────────────

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const { colors } = useTheme();

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div
      style={{
        background: colors.card,
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        padding: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              color: colors.textMuted,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            SISTEMA DE ALERTAS TEMPRANAS
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 12 }}>
            Monitoreo automático de umbrales críticos
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {criticalCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#fff",
                backgroundColor: colors.error,
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              {criticalCount} Crítico{criticalCount > 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#000",
                backgroundColor: colors.warning,
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              {warningCount} Alerta{warningCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Alert cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
