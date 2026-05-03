import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { AlertCircle, Flag } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner() {
  const { colors, isDark } = useTheme();

  return (
    <div
      style={{
        backgroundColor: isDark ? "rgba(245,166,35,0.08)" : "rgba(232,146,10,0.08)",
        border: `1px solid ${colors.warning}`,
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <AlertCircle size={16} color={colors.warning} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ color: colors.warning, fontSize: 12, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600 }}>Alerta de degradación:</span> El modelo de sentimiento
        (PT) bajó 6.2% en F1 respecto al mes anterior — supera el umbral del 5%. Se recomienda
        revisar el corpus de entrenamiento o reentrenar.
      </div>
    </div>
  );
}

// ─── Global Metrics Card ──────────────────────────────────────────────────────
function GlobalMetricsCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const tabs = ["Todos", "ES", "PT"];

  const metrics = [
    {
      label: "F1 Score Sentimiento",
      value: "0.847",
      delta: "+0.012",
      deltaColor: "#00C49A",
      deltaBg: "rgba(0,196,154,0.13)",
      previous: "0.835",
      isDegraded: false,
    },
    {
      label: "F1 Score Intención",
      value: "0.791",
      delta: "−0.023",
      deltaColor: "#F5A623",
      deltaBg: "rgba(245,166,35,0.13)",
      previous: "0.814",
      isDegraded: false,
    },
    {
      label: "F1 Score Sentimiento PT",
      value: "0.762",
      delta: "−0.062 ⚑",
      deltaColor: "#FF6B6B",
      deltaBg: "rgba(255,107,107,0.13)",
      previous: "0.824 · umbral: −5%",
      isDegraded: true,
    },
  ];

  return (
    <div style={card}>
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 20 }}
      >
        <div
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Métricas globales por idioma
        </div>

        {/* Language tabs */}
        <div className="flex gap-2">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 20,
                cursor: "pointer",
                backgroundColor: i === 0 ? "rgba(223,245,239,0.06)" : "transparent",
                color: i === 0 ? colors.accent : colors.textSecondary,
                border: i === 0 ? `1px solid ${colors.accent}` : `1px solid ${colors.textSecondary}`,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              backgroundColor: m.isDegraded ? "rgba(255,107,107,0.03)" : colors.background,
              borderRadius: 8,
              padding: 12,
              border: m.isDegraded ? "1px solid #FF6B6B" : "none",
            }}
          >
            <div style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>
              {m.label}
            </div>
            <div
              style={{
                color: m.isDegraded ? "#FF6B6B" : "#FFFFFF",
                fontSize: 24,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {m.value}
            </div>
            <div
              style={{
                display: "inline-block",
                backgroundColor: m.deltaBg,
                color: m.deltaColor,
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 4,
                marginBottom: 8,
              }}
            >
              {m.delta}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: 11 }}>
              Anterior: {m.previous}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Accuracy Table Card ──────────────────────────────────────────────────────
function AccuracyTableCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const rows = [
    { intent: "Cancelar suscripción", actual: 0.91, previous: 0.89, delta: +0.02 },
    { intent: "Reembolso parcial", actual: 0.83, previous: 0.87, delta: -0.04 },
    { intent: "Soporte técnico", actual: 0.79, previous: 0.81, delta: -0.02 },
    { intent: "Cambio de plan", actual: 0.88, previous: 0.86, delta: +0.02 },
    { intent: "Error de pago", actual: 0.72, previous: 0.8, delta: -0.08, isCritical: true },
    { intent: "Portabilidad datos", actual: 0.65, previous: 0.67, delta: -0.02 },
  ];

  return (
    <div style={card}>
      <div
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 16,
        }}
      >
        Accuracy por clase de intención
      </div>

      <div>
        {/* Header */}
        <div
          className="grid grid-cols-4 gap-4"
          style={{
            padding: "8px 12px",
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: 4,
          }}
        >
          <div style={{ color: colors.textSecondary, fontSize: 11 }}>Intención</div>
          <div style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>Actual</div>
          <div style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>Anterior</div>
          <div style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>Delta</div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={row.intent}
            className="grid grid-cols-4 gap-4"
            style={{
              padding: "10px 12px",
              backgroundColor: i % 2 === 0 ? colors.card : colors.background,
              borderRadius: 4,
            }}
          >
            <div style={{ color: colors.textPrimary, fontSize: 12 }}>{row.intent}</div>
            <div style={{ color: colors.textPrimary, fontSize: 12, textAlign: "right" }}>
              {row.actual.toFixed(2)}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: "right" }}>
              {row.previous.toFixed(2)}
            </div>
            <div
              style={{
                color: row.delta >= 0 ? "#00C49A" : "#FF6B6B",
                fontSize: 12,
                textAlign: "right",
                fontWeight: row.isCritical ? 600 : 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 4,
              }}
            >
              {row.delta >= 0 ? "+" : ""}
              {row.delta.toFixed(2)}
              {row.isCritical && <Flag size={11} color="#FF6B6B" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trend Chart Card ─────────────────────────────────────────────────────────
function TrendChartCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const data = [
    { month: "Nov", sentimiento: 0.81, intencion: 0.76 },
    { month: "Dic", sentimiento: 0.82, intencion: 0.78 },
    { month: "Ene", sentimiento: 0.83, intencion: 0.79 },
    { month: "Feb", sentimiento: 0.835, intencion: 0.81 },
    { month: "Mar", sentimiento: 0.84, intencion: 0.814 },
    { month: "Abr", sentimiento: 0.847, intencion: 0.791 },
  ];

  return (
    <div style={card}>
      <div
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 16,
        }}
      >
        Tendencia F1 — últimos 6 meses
      </div>

      {/* Legend */}
      <div className="flex gap-4" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#7F77DD",
              flexShrink: 0,
            }}
          />
          <span style={{ color: colors.textSecondary, fontSize: 11 }}>Sentimiento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#00C49A",
              flexShrink: 0,
            }}
          />
          <span style={{ color: colors.textSecondary, fontSize: 11 }}>Intención</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative", height: 240 }}>
        {/* Y-axis reference lines */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 5, paddingBottom: 25 }}>
          {[0.9, 0.85, 0.8, 0.75, 0.7].map((val) => (
            <div key={val} style={{ borderTop: "1px solid rgba(107,147,168,0.08)", position: "relative" }}>
              <span style={{ position: "absolute", left: -30, top: -8, fontSize: 9, color: colors.textSecondary }}>
                {val.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Bars */}
        <div style={{ position: "absolute", inset: "5px 0 25px 0", display: "flex", alignItems: "flex-end", gap: 16, paddingLeft: 10 }}>
          {data.map((d, i) => {
            const sentHeight = ((d.sentimiento - 0.7) / (0.9 - 0.7)) * 100;
            const intHeight = ((d.intencion - 0.7) / (0.9 - 0.7)) * 100;

            return (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", display: "flex", gap: 4, alignItems: "flex-end", height: "100%" }}>
                  <div
                    style={{
                      flex: 1,
                      height: `${sentHeight}%`,
                      backgroundColor: "#7F77DD",
                      borderRadius: "4px 4px 0 0",
                      minHeight: 4,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: `${intHeight}%`,
                      backgroundColor: "#00C49A",
                      borderRadius: "4px 4px 0 0",
                      minHeight: 4,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>{d.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Recall Grid Card ─────────────────────────────────────────────────────────
function RecallGridCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const recalls = [
    { label: "Positivo ES", value: "0.91", color: colors.accent, isDegraded: false },
    { label: "Neutro ES", value: "0.87", color: colors.accent, isDegraded: false },
    { label: "Frustración ES", value: "0.79", color: colors.warning, isDegraded: false },
    { label: "Positivo PT", value: "0.88", color: colors.accent, isDegraded: false },
    { label: "Neutro PT", value: "0.76", color: colors.warning, isDegraded: false },
    { label: "Frustración PT", value: "0.61 ⚑", color: colors.error, isDegraded: true },
  ];

  return (
    <div style={card}>
      <div
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 16,
        }}
      >
        Recall por clase de sentimiento · ES y PT
      </div>

      <div className="grid grid-cols-6 gap-4">
        {recalls.map((r) => (
          <div
            key={r.label}
            style={{
              backgroundColor: r.isDegraded ? "rgba(255,107,107,0.03)" : colors.background,
              borderRadius: 8,
              padding: "12px 10px",
              textAlign: "center",
              border: r.isDegraded ? "1px solid #FF6B6B" : "none",
            }}
          >
            <div style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 8 }}>
              {r.label}
            </div>
            <div
              style={{
                color: r.color,
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function ModelMetricsPage() {
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Métricas modelo" />} mainClassName="space-y-4">
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
            <span style={{ color: colors.textPrimary }}>Métricas del modelo</span>
          </nav>

          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
                Métricas del modelo
              </h1>
              <p style={{ color: colors.textSecondary, fontSize: 11, margin: "4px 0 0 0" }}>
                Corpus: abril 2025 · 2.13M mensajes
              </p>
            </div>
            <div
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                border: `1px solid ${colors.textSecondary}`,
                borderRadius: 20,
                padding: "4px 12px",
              }}
            >
              Comparando con: marzo 2025
            </div>
          </div>

          {/* Alert Banner */}
          <AlertBanner />

          {/* Global Metrics */}
          <GlobalMetricsCard />

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AccuracyTableCard />
            <TrendChartCard />
          </div>

          {/* Recall Grid */}
          <RecallGridCard />
    </DashboardShell>
  );
}
