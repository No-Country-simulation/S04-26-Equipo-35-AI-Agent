import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { AlertTriangle } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── KPI Row ─────────────────────────────────────────────────────────────────
function FrustracionKpiRow() {
  const { colors } = useTheme();

  const kpis = [
    {
      label: "ÍNDICE DE FRUSTRACIÓN",
      value: "31%",
      delta: "▲ 5% vs mes ant.",
      deltaColor: colors.error,
    },
    {
      label: "FLUJOS CRÍTICOS",
      value: "4",
      delta: ">80% frustración",
      deltaColor: colors.warning,
    },
    {
      label: "TASA DE ABANDONO",
      value: "41%",
      delta: "▲ 5% vs mes ant.",
      deltaColor: colors.error,
    },
    {
      label: "TIEMPO PROMEDIO",
      value: "8.2 min",
      delta: "▲ 1.3 min",
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

// ─── Flows Table ─────────────────────────────────────────────────────────────
function FlowsTable() {
  const { colors } = useTheme();

  const flows = [
    {
      name: "Devoluciones",
      frustration: 82,
      frustColor: "#FF6B6B",
      abandonment: 47,
      conversations: "12.4k",
      trend: "▲ 12%",
      trendColor: "#FF6B6B",
      severity: "crítico",
      severityBg: "rgba(255,107,107,0.13)",
      severityColor: "#FF6B6B",
      href: "/flujos/devoluciones",
    },
    {
      name: "Cambio de plan",
      frustration: 71,
      frustColor: "#FF6B6B",
      abandonment: 38,
      conversations: "8.9k",
      trend: "▲ 8%",
      trendColor: "#FF6B6B",
      severity: "alto",
      severityBg: "rgba(245,166,35,0.13)",
      severityColor: "#F5A623",
      href: "#",
    },
    {
      name: "Soporte técnico",
      frustration: 58,
      frustColor: "#F5A623",
      abandonment: 29,
      conversations: "15.2k",
      trend: "▼ 2%",
      trendColor: "#00C49A",
      severity: "medio",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
    {
      name: "Facturación",
      frustration: 44,
      frustColor: "#F5A623",
      abandonment: 22,
      conversations: "6.7k",
      trend: "▲ 3%",
      trendColor: "#FF6B6B",
      severity: "medio",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
    {
      name: "Onboarding",
      frustration: 29,
      frustColor: "#FFFFFF",
      abandonment: 12,
      conversations: "22.1k",
      trend: "▼ 5%",
      trendColor: "#00C49A",
      severity: "bajo",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
    {
      name: "Configuración",
      frustration: 24,
      frustColor: "#FFFFFF",
      abandonment: 9,
      conversations: "4.3k",
      trend: "▼ 1%",
      trendColor: "#00C49A",
      severity: "bajo",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 16,
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          color: colors.textMuted,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 14,
        }}
      >
        Todos los flujos ordenados por frustración
      </div>

      {/* Header */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
          padding: "8px 12px",
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: 4,
        }}
      >
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600 }}>Flujo</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Frustración</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Abandono</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Conversaciones</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Tendencia</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "center" }}>Severidad</div>
      </div>

      {/* Rows */}
      {flows.map((flow, i) => (
        <Link
          key={flow.name}
          href={flow.href}
          className="grid gap-4 no-underline transition-colors"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
            padding: "12px",
            backgroundColor: i % 2 === 0 ? colors.card : colors.background,
            borderRadius: 4,
            textDecoration: "none",
            minHeight: 48,
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = colors.cardHover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = i % 2 === 0 ? colors.card : colors.background;
          }}
        >
          <div style={{ color: colors.link, fontSize: 13, fontWeight: 500 }}>{flow.name}</div>
          <div
            style={{
              color: flow.frustColor,
              fontSize: 13,
              textAlign: "right",
              fontWeight: 600,
            }}
          >
            {flow.frustration}%
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 13, textAlign: "right" }}>
            {flow.abandonment}%
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 13, textAlign: "right" }}>
            {flow.conversations}
          </div>
          <div
            style={{
              color: flow.trendColor,
              fontSize: 13,
              textAlign: "right",
            }}
          >
            {flow.trend}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              style={{
                backgroundColor: flow.severityBg,
                color: flow.severityColor,
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: 20,
                border: `1px solid ${flow.severityColor}40`,
              }}
            >
              {flow.severity}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Timeline Chart ───────────────────────────────────────────────────────────
function TimelineChart() {
  const { colors } = useTheme();

  const data = [
    { month: "Nov", es: 32, pt: 28 },
    { month: "Dic", es: 38, pt: 31 },
    { month: "Ene", es: 35, pt: 33 },
    { month: "Feb", es: 48, pt: 42 },
    { month: "Mar", es: 56, pt: 51 },
    { month: "Abr", es: 64, pt: 58 },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 16,
  };

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div
          style={{
            color: colors.textMuted,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Tendencia de frustración — últimos 6 meses
        </div>
        {/* Legend */}
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#1A8FE3",
                flexShrink: 0,
              }}
            />
            <span style={{ color: colors.textMuted, fontSize: 11 }}>ES</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: colors.accent,
                flexShrink: 0,
              }}
            />
            <span style={{ color: colors.textMuted, fontSize: 11 }}>PT</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative", height: 240 }}>
        {/* Y-axis labels */}
        <div style={{ position: "absolute", left: -35, top: 0, bottom: 25, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {[75, 50, 25, 0].map((val) => (
            <div key={val} style={{ color: colors.textMuted, fontSize: 10 }}>
              {val}%
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div style={{ position: "absolute", inset: "0 0 25px 0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ borderTop: `1px solid ${colors.textMuted}20` }} />
          ))}
        </div>

        {/* Bars */}
        <div style={{ position: "absolute", inset: "0 0 25px 0", display: "flex", alignItems: "flex-end", gap: 16 }}>
          {data.map((d) => {
            const esHeight = (d.es / 75) * 100;
            const ptHeight = (d.pt / 75) * 100;

            return (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", display: "flex", gap: 4, alignItems: "flex-end", height: "100%" }}>
                  <div
                    style={{
                      flex: 1,
                      height: `${esHeight}%`,
                      backgroundColor: "#1A8FE3",
                      borderRadius: "3px 3px 0 0",
                      minHeight: 4,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: `${ptHeight}%`,
                      backgroundColor: colors.accent,
                      borderRadius: "3px 3px 0 0",
                      minHeight: 4,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>{d.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight note */}
      <div style={{ color: colors.textSecondary, fontSize: 11, fontStyle: "italic", marginTop: 12 }}>
        La frustración en ES aumentó 32 puntos porcentuales en 6 meses. PT muestra tendencia similar con menor intensidad.
      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function FrustracionPage() {
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Frustración" />} mainClassName="space-y-4">
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
            <span style={{ color: colors.textPrimary }}>Frustración</span>
          </nav>

          {/* Page Header */}
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} color={colors.warning} />
            <h1 style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>
              Análisis de Frustración
            </h1>
          </div>
          <p style={{ color: colors.textSecondary, fontSize: 12, margin: 0 }}>
            Flujos conversacionales ordenados por nivel de frustración · Abril 2025
          </p>

          {/* KPI Cards */}
          <FrustracionKpiRow />

          {/* Flows Table */}
          <FlowsTable />

          {/* Timeline Chart */}
          <TimelineChart />
    </DashboardShell>
  );
}
