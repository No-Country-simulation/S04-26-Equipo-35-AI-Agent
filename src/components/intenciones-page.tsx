"use client";

import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { Target } from "lucide-react";
import { useTheme } from "../context/theme-context";
import { IntentTableItem } from "../lib/api";

// ─── KPI Row ─────────────────────────────────────────────────────────────────
function IntencionesKpiRow({ data }: { data: IntentTableItem[] }) {
  const { colors } = useTheme();

  const totalUnresolved = data.length;
  const totalMessages = data.reduce((acc, curr) => {
    let msgCount = 0;
    if (curr.messages.endsWith('k')) {
      msgCount = parseFloat(curr.messages.replace('k', '')) * 1000;
    } else {
      msgCount = parseInt(curr.messages, 10);
    }
    return acc + (isNaN(msgCount) ? 0 : msgCount);
  }, 0);
  
  const criticalCount = data.filter(d => d.severity === "critical").length;

  const kpis = [
    {
      label: "INTENCIONES SIN RESOLVER",
      value: totalUnresolved.toString(),
      delta: "Tickets estancados",
      deltaColor: colors.error,
    },
    {
      label: "MENSAJES EN ESTAS INTENCIONES",
      value: totalMessages > 999 ? (totalMessages / 1000).toFixed(1) + 'k' : totalMessages.toString(),
      delta: "Volumen actual",
      deltaColor: colors.textMuted,
    },
    {
      label: "TASA DE RESOLUCIÓN",
      value: "0%",
      delta: "Por definición",
      deltaColor: colors.error,
    },
    {
      label: "CRÍTICAS",
      value: criticalCount.toString(),
      delta: ">75% frustración",
      deltaColor: colors.error,
    },
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

// ─── Intents Table ───────────────────────────────────────────────────────────
function IntentsTable({ intents }: { intents: IntentTableItem[] }) {
  const { colors, isDark } = useTheme();

  if (!intents || intents.length === 0) {
    return (
      <div style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12 }}>
        <div style={{ color: colors.textMuted, fontSize: 13 }}>No hay datos disponibles.</div>
      </div>
    );
  }



  const getSeverityColor = (severity: string) => {
    if (severity === "critical") return colors.error;
    if (severity === "high") return colors.warning;
    if (severity === "medium") return colors.warning;
    return colors.textSecondary;
  };

  const getSeverityBg = (severity: string) => {
    if (severity === "critical") return isDark ? "rgba(255,92,92,0.12)" : "rgba(229,57,53,0.12)";
    if (severity === "high") return isDark ? "rgba(245,166,35,0.12)" : "rgba(232,146,10,0.12)";
    return "transparent";
  };

  const getSeverityLabel = (severity: string) => {
    if (severity === "critical") return "crítico";
    if (severity === "high") return "alto";
    if (severity === "medium") return "medio";
    return "bajo";
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          color: colors.textMuted,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 20,
        }}
      >
        Todas las intenciones sin resolver
      </div>

      {/* Header */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
          padding: "8px 12px",
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: 4,
        }}
      >
        <div style={{ color: colors.textSecondary, fontSize: 11 }}>Intención</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>Mensajes</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>Resolución</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>Frustración</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, textAlign: "center" }}>Severidad</div>
      </div>

      {/* Rows */}
      {intents.map((intent, i) => (
        <Link
          key={intent.name}
          href={intent.href}
          className="grid gap-4 no-underline hover:opacity-90 transition-opacity"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            padding: "12px",
            backgroundColor: i % 2 === 0 ? colors.card : colors.background,
            borderRadius: 4,
            textDecoration: "none",
          }}
        >
          <div style={{ color: colors.link, fontSize: 12, fontWeight: 500 }}>{intent.name}</div>
          <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: "right" }}>
            {intent.messages}
          </div>
          <div
            style={{
              color: intent.resolution === 0 ? colors.error : colors.textPrimary,
              fontSize: 12,
              textAlign: "right",
              fontWeight: intent.resolution === 0 ? 600 : 400,
            }}
          >
            {intent.resolution}%
          </div>
          <div
            style={{
              color: getSeverityColor(intent.severity),
              fontSize: 12,
              textAlign: "right",
              fontWeight: 600,
            }}
          >
            {intent.frustration}%
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              style={{
                backgroundColor: getSeverityBg(intent.severity),
                color: getSeverityColor(intent.severity),
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: 12,
                border: `1px solid ${getSeverityColor(intent.severity)}40`,
              }}
            >
              {getSeverityLabel(intent.severity)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function IntencionesPage({ data }: { data: IntentTableItem[] }) {
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Intenciones" />} mainClassName="space-y-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
            <Link
              href="/"
              style={{ color: colors.textSecondary, textDecoration: "none" }}
              className="hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
            <span style={{ color: colors.textPrimary }}>Intenciones</span>
          </nav>

          {/* Page Header */}
          <div className="flex items-center gap-3">
            <Target size={20} color={colors.accent} />
            <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
              Intenciones sin resolver
            </h1>
          </div>
          <p style={{ color: colors.textSecondary, fontSize: 11, margin: 0 }}>
            Intenciones del usuario que no están siendo atendidas por el asistente · Abril 2025
          </p>

          {/* KPI Cards */}
          <IntencionesKpiRow data={data} />

          {/* Intents Table */}
          <IntentsTable intents={data} />
    </DashboardShell>
  );
}
