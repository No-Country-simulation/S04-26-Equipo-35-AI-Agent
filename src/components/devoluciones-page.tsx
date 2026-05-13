import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { Download, ArrowLeft, Flag } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── KPI Row ─────────────────────────────────────────────────────────────────
function DevKpiRow() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const kpis = [
    {
      label: "Frustración promedio",
      value: "82%",
      delta: "▲ 12% vs mes ant.",
      deltaColor: "#FF6B6B",
    },
    {
      label: "Tasa de abandono",
      value: "47%",
      delta: "▲ 8%",
      deltaColor: "#FF6B6B",
    },
    {
      label: "Paso de quiebre",
      value: "Paso 3",
      delta: "verificación",
      deltaColor: "#6B93A8",
    },
    {
      label: "Resolución",
      value: "38%",
      delta: "▼ 9%",
      deltaColor: "#FF6B6B",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <div key={k.label} style={card}>
          <div
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {k.label}
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 24, fontWeight: 600, marginTop: 8 }}>
            {k.value}
          </div>
          <div style={{ color: k.deltaColor, fontSize: 11, marginTop: 6 }}>{k.delta}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Timeline Card ────────────────────────────────────────────────────────────
function TimelineCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const segments = [
    { pct: 20, color: colors.accent, opacity: 1 },          // 0-20 positivo
    { pct: 15, color: "#DFF5EF", opacity: 0.35 },        // 20-35 neutro
    { pct: 10, color: colors.warning, opacity: 0.6 },         // 35-45 leve frustración
    { pct: 30, color: colors.warning, opacity: 1 },           // 45-75 frustración alta
    { pct: 25, color: colors.error, opacity: 1 },           // 75-100 abandono
  ];

  const legend: { color: string; label: string; border?: string; opacity?: number }[] = [
    { color: colors.accent, label: "positivo" },
    { color: "#DFF5EF", label: "neutro", border: "1px solid rgba(0,196,154,0.2)" },
    { color: colors.warning, label: "leve frustración", opacity: 0.6 },
    { color: colors.warning, label: "frustración alta" },
    { color: colors.error, label: "abandono" },
  ];

  const axisLabels = ["inicio", "turno 3", "turno 6", "turno 9", "turno 12", "fin"];

  return (
    <div style={card}>
      <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>
        Timeline de sentimiento — promedio por turno de conversación
      </div>

      {/* Bar container */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        {/* Segmented bar */}
        <div
          style={{
            display: "flex",
            height: 48,
            borderRadius: 6,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {segments.map((s, i) => (
            <div
              key={i}
              style={{
                width: `${s.pct}%`,
                height: "100%",
                backgroundColor: s.color,
                opacity: s.opacity,
              }}
            />
          ))}
        </div>

        {/* Break marker at 45% */}
        <div
          style={{
            position: "absolute",
            left: "45%",
            top: -18,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span style={{ color: colors.error, fontSize: 9, fontWeight: 600, whiteSpace: "nowrap" }}>
            ⚑ quiebre
          </span>
          <div
            style={{
              width: 2,
              height: 48,
              backgroundColor: "#FF6B6B",
              marginTop: 2,
            }}
          />
        </div>
      </div>

      {/* Axis labels */}
      <div className="flex justify-between" style={{ marginTop: 8, marginBottom: 16 }}>
        {axisLabels.map((l) => (
          <span key={l} style={{ color: colors.textSecondary, fontSize: 10 }}>
            {l}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: l.color,
                opacity: l.opacity ?? 1,
                border: l.border,
                flexShrink: 0,
              }}
            />
            <span style={{ color: colors.textSecondary, fontSize: 11 }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Steps Card ───────────────────────────────────────────────────────────────
function StepsCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const steps = [
    { num: 1, name: "Saludo", frustration: "12% frustración", color: colors.accent, isCritical: false },
    { num: 2, name: "Tipo devolución", frustration: "34% frustración", color: colors.warning, isCritical: false },
    { num: 3, name: "Verificación", frustration: "81% frustración", color: colors.error, isCritical: true },
    { num: 4, name: "Confirmación", frustration: "62% frustración", color: colors.warning, isCritical: false },
    { num: 5, name: "Cierre", frustration: "55% frustración", color: colors.warning, isCritical: false },
  ];

  return (
    <div style={card}>
      <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>
        Pasos del flujo — frustración por etapa
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {steps.map((s) => (
          <div
            key={s.num}
            style={{
              backgroundColor: s.isCritical ? "rgba(255,107,107,0.06)" : colors.background,
              border: s.isCritical ? "1px solid #FF6B6B" : `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: "14px 12px",
            }}
          >
            <div className="flex items-center gap-1 mb-2">
              <span style={{ color: colors.textSecondary, fontSize: 10 }}>Paso {s.num}</span>
              {s.isCritical && (
                <Flag size={10} color="#FF6B6B" style={{ marginLeft: 2 }} />
              )}
            </div>
            <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              {s.name}
            </div>
            <div style={{ color: s.color, fontSize: 11 }}>{s.frustration}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Conversations Card ───────────────────────────────────────────────────────
function ConversationsCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const convos = [
    {
      barColor: "#FF6B6B",
      meta: "Usuario · Paso 3 · ES · hace 3 días",
      quote:
        "Ya envié el número de orden tres veces, ¿por qué me lo siguen pidiendo?",
      badge: "abandono",
      badgeColor: "#FF6B6B",
      badgeBg: "rgba(255,107,107,0.15)",
    },
    {
      barColor: "#F5A623",
      meta: "Usuario · Paso 3 · PT · hace 5 días",
      quote:
        "Não consigo avançar sem o código, mas o email não chegou.",
      badge: "frustración alta",
      badgeColor: "#F5A623",
      badgeBg: "rgba(245,166,35,0.15)",
    },
    {
      barColor: "#F5A623",
      meta: "Usuario · Paso 3 · ES · hace 7 días",
      quote:
        "Esto es un ciclo sin fin, siempre me pide lo mismo y nunca avanza.",
      badge: "frustración alta",
      badgeColor: "#F5A623",
      badgeBg: "rgba(245,166,35,0.15)",
    },
  ];

  return (
    <div style={card}>
      <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>
        Conversaciones representativas en punto de quiebre
      </div>
      <div className="space-y-3">
        {convos.map((c, i) => (
          <div
            key={i}
            className="flex gap-4 items-stretch"
            style={{
              backgroundColor: colors.background,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              overflow: "hidden",
            }}
          >
            {/* Colored left bar */}
            <div style={{ width: 3, backgroundColor: c.barColor, flexShrink: 0 }} />

            {/* Content */}
            <div className="flex flex-1 items-center justify-between gap-4 py-3 pr-4">
              <div className="flex flex-col gap-1">
                <span style={{ color: colors.textSecondary, fontSize: 11 }}>{c.meta}</span>
                <span
                  style={{
                    color: colors.textPrimary,
                    fontSize: 12,
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  &quot;{c.quote}&quot;
                </span>
              </div>
              {/* Badge */}
              <div
                style={{
                  flexShrink: 0,
                  backgroundColor: c.badgeBg,
                  color: c.badgeColor,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "3px 10px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                  border: `1px solid ${c.badgeColor}30`,
                }}
              >
                {c.badge}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function DevolucionesPage() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Frustración" />} mainClassName="space-y-4">

          {/* Breadcrumb + Back */}
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
              <Link href="/" style={{ color: colors.textSecondary, textDecoration: "none" }} className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
              <span style={{ color: colors.textSecondary }}>Flujos</span>
              <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
              <span style={{ color: colors.textPrimary }}>Devoluciones</span>
            </nav>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 transition-colors"
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                padding: "5px 12px",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary;
                (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
                (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border;
              }}
            >
              <ArrowLeft size={13} />
              Volver
            </button>
          </div>

          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
                  Flujo: Devoluciones
                </h1>
                <span
                  style={{
                    backgroundColor: "rgba(255,107,107,0.12)",
                    color: colors.error,
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "2px 10px",
                    borderRadius: 20,
                    border: "1px solid rgba(255,107,107,0.25)",
                  }}
                >
                  crítico
                </span>
              </div>
              <p style={{ color: colors.textSecondary, fontSize: 11, margin: 0 }}>
                12.4k conversaciones · Abril 2025 · ES + PT
              </p>
            </div>
            <button
              className="flex items-center gap-2 transition-colors"
              style={{
                color: colors.accent,
                fontSize: 12,
                border: `1px solid ${colors.accent}`,
                borderRadius: 6,
                padding: "6px 14px",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,196,154,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              <Download size={13} />
              Exportar PDF
            </button>
          </div>

          {/* KPI Cards */}
          <DevKpiRow />

          {/* Timeline */}
          <TimelineCard />

          {/* Steps */}
          <StepsCard />

          {/* Conversations */}
          <ConversationsCard />

    </DashboardShell>
  );
}
