import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { Target } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── KPI Row ─────────────────────────────────────────────────────────────────
function IntencionesKpiRow() {
  const { colors } = useTheme();

  const kpis = [
    {
      label: "INTENCIONES SIN RESOLVER",
      value: "12",
      delta: "▲ 3 vs mes ant.",
      deltaColor: colors.error,
    },
    {
      label: "MENSAJES TOTALES",
      value: "9.6k",
      delta: "Abril 2025",
      deltaColor: colors.textMuted,
    },
    {
      label: "TASA DE RESOLUCIÓN",
      value: "18%",
      delta: "▼ 8%",
      deltaColor: colors.error,
    },
    {
      label: "CRÍTICAS",
      value: "5",
      delta: ">85% frustración",
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
function IntentsTable() {
  const { colors, isDark } = useTheme();

  const intents = [
    {
      name: "Cancelar suscripción",
      messages: "4.2k",
      resolution: 0,
      frustration: 88,
      severity: "critical",
      href: "/intenciones/cancelar-suscripcion",
    },
    {
      name: "Reembolso parcial",
      messages: "2.8k",
      resolution: 0,
      frustration: 85,
      severity: "critical",
      href: "#",
    },
    {
      name: "Eliminar cuenta",
      messages: "1.9k",
      resolution: 5,
      frustration: 82,
      severity: "critical",
      href: "#",
    },
    {
      name: "Portabilidad de datos",
      messages: "1.1k",
      resolution: 12,
      frustration: 71,
      severity: "high",
      href: "#",
    },
    {
      name: "Error de pago recurrente",
      messages: "980",
      resolution: 8,
      frustration: 68,
      severity: "high",
      href: "#",
    },
    {
      name: "Cambio de titular",
      messages: "540",
      resolution: 22,
      frustration: 54,
      severity: "medium",
      href: "#",
    },
    {
      name: "Actualizar forma de pago",
      messages: "420",
      resolution: 35,
      frustration: 48,
      severity: "medium",
      href: "#",
    },
    {
      name: "Cambiar email",
      messages: "310",
      resolution: 45,
      frustration: 39,
      severity: "medium",
      href: "#",
    },
    {
      name: "Ver historial",
      messages: "280",
      resolution: 58,
      frustration: 28,
      severity: "low",
      href: "#",
    },
    {
      name: "Consulta de saldo",
      messages: "220",
      resolution: 72,
      frustration: 18,
      severity: "low",
      href: "#",
    },
    {
      name: "Verificar identidad",
      messages: "180",
      resolution: 65,
      frustration: 24,
      severity: "low",
      href: "#",
    },
    {
      name: "Solicitar factura",
      messages: "140",
      resolution: 81,
      frustration: 12,
      severity: "low",
      href: "#",
    },
  ];

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
export function IntencionesPage() {
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
          <IntencionesKpiRow />

          {/* Intents Table */}
          <IntentsTable />
    </DashboardShell>
  );
}
