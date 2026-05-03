import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { Workflow } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── Flows Table ─────────────────────────────────────────────────────────────
function FlowsTable() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };
  const flows = [
    {
      name: "Devoluciones",
      conversations: "12.4k",
      resolution: 58,
      frustration: 82,
      abandonment: 47,
      severity: "crítico",
      severityBg: "rgba(255,107,107,0.13)",
      severityColor: "#FF6B6B",
      href: "/flujos/devoluciones",
    },
    {
      name: "Cambio de plan",
      conversations: "8.9k",
      resolution: 62,
      frustration: 71,
      abandonment: 38,
      severity: "alto",
      severityBg: "rgba(245,166,35,0.13)",
      severityColor: "#F5A623",
      href: "#",
    },
    {
      name: "Soporte técnico",
      conversations: "15.2k",
      resolution: 71,
      frustration: 58,
      abandonment: 29,
      severity: "medio",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
    {
      name: "Facturación",
      conversations: "6.7k",
      resolution: 78,
      frustration: 44,
      abandonment: 22,
      severity: "medio",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
    {
      name: "Onboarding",
      conversations: "22.1k",
      resolution: 88,
      frustration: 29,
      abandonment: 12,
      severity: "bajo",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
    {
      name: "Configuración",
      conversations: "4.3k",
      resolution: 91,
      frustration: 24,
      abandonment: 9,
      severity: "bajo",
      severityBg: "rgba(107,147,168,0.13)",
      severityColor: "#6B93A8",
      href: "#",
    },
  ];

  return (
    <div style={card}>
      <div
        style={{
          color: colors.textMuted,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 20,
        }}
      >
        Todos los flujos conversacionales
      </div>

      {/* Header */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 4,
        }}
      >
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600 }}>Flujo</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Conversaciones</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Resolución</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Frustración</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: "right" }}>Abandono</div>
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
          <div style={{ color: colors.textSecondary, fontSize: 13, textAlign: "right" }}>
            {flow.conversations}
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 13, textAlign: "right", fontWeight: 600 }}>
            {flow.resolution}%
          </div>
          <div
            style={{
              color: flow.severityColor,
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

// ─── Full Page ────────────────────────────────────────────────────────────────
export function FlujosPage() {
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar />} mainClassName="space-y-4">
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
            <span style={{ color: colors.textPrimary }}>Flujos</span>
          </nav>

          {/* Page Header */}
          <div className="flex items-center gap-3">
            <Workflow size={20} color={colors.accent} />
            <h1 style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>
              Flujos conversacionales
            </h1>
          </div>
          <p style={{ color: colors.textSecondary, fontSize: 12, margin: 0 }}>
            Todos los flujos del asistente · Abril 2025
          </p>

          {/* Flows Table */}
          <FlowsTable />
    </DashboardShell>
  );
}
