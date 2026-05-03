import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { ArrowLeft, ArrowRight, Zap } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── KPI Row ───────────────────────────────────────────────────────────────
function IntentKpiRow() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Mensajes afectados */}
      <div style={card}>
        <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Mensajes afectados
        </div>
        <div style={{ color: colors.textPrimary, fontSize: 24, fontWeight: 600, marginTop: 8 }}>4.2k</div>
        <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>Abril 2025</div>
      </div>

      {/* Tasa de resolución */}
      <div style={card}>
        <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Tasa de resolución
        </div>
        <div style={{ color: colors.textPrimary, fontSize: 24, fontWeight: 600, marginTop: 8 }}>0%</div>
        <div style={{ color: colors.error, fontSize: 11, marginTop: 6 }}>sin resolver</div>
      </div>

      {/* Frustración asociada */}
      <div style={card}>
        <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Frustración asociada
        </div>
        <div style={{ color: colors.error, fontSize: 24, fontWeight: 600, marginTop: 8 }}>88%</div>
        <div style={{ color: colors.error, fontSize: 11, marginTop: 6 }}>▲ 15% vs mes ant.</div>
      </div>

      {/* Idiomas */}
      <div style={card}>
        <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Idiomas
        </div>
        <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600, marginTop: 8, letterSpacing: "0.05em" }}>
          ES · PT
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>2 mercados activos</div>
      </div>
    </div>
  );
}

// ─── Flows card ─────────────────────────────────────────────────────────────
type FlowRow = {
  name: string;
  pct: number;
  barColor: string;
  count: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
};

function FlowsCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const flows: FlowRow[] = [
    { name: "Devoluciones",     pct: 90, barColor: "#FF6B6B", count: "1.8k", badge: "crítico", badgeColor: "#FF6B6B", badgeBg: "rgba(255,107,107,0.12)" },
    { name: "Cambio de plan",   pct: 60, barColor: "#FF6B6B", count: "1.2k", badge: "crítico", badgeColor: "#FF6B6B", badgeBg: "rgba(255,107,107,0.12)" },
    { name: "Facturación",      pct: 40, barColor: "#F5A623", count: "780",  badge: "medio",   badgeColor: "#F5A623", badgeBg: "rgba(245,166,35,0.12)"  },
    { name: "Soporte técnico",  pct: 20, barColor: "#6B93A8", count: "420",  badge: "bajo",    badgeColor: "#6B93A8", badgeBg: "rgba(107,147,168,0.12)" },
  ];

  return (
    <div style={card}>
      <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>
        Flujos donde aparece esta intención
      </div>
      <div className="space-y-4">
        {flows.map((f) => (
          <div key={f.name} className="flex items-center gap-3">
            {/* Name */}
            <div style={{ width: 130, color: colors.textPrimary, fontSize: 12, flexShrink: 0 }}>
              {f.name}
            </div>
            {/* Bar */}
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: colors.background }}>
              <div
                style={{
                  width: `${f.pct}%`,
                  height: "100%",
                  backgroundColor: f.barColor,
                  borderRadius: 999,
                }}
              />
            </div>
            {/* Count */}
            <div style={{ width: 36, textAlign: "right", color: colors.textSecondary, fontSize: 12, flexShrink: 0 }}>
              {f.count}
            </div>
            {/* Badge */}
            <div
              style={{
                flexShrink: 0,
                backgroundColor: f.badgeBg,
                color: f.badgeColor,
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 20,
                border: `1px solid ${f.badgeColor}30`,
                minWidth: 52,
                textAlign: "center",
              }}
            >
              {f.badge}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Patterns card ───────────────────────────────────────────────────────────
type Pattern = { dot: string; title: string; desc: string };

function PatternsCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const patterns: Pattern[] = [
    {
      dot: "#FF6B6B",
      title: "El bot no reconoce la intención",
      desc: "Responde con FAQ genérica · 62% de casos",
    },
    {
      dot: "#F5A623",
      title: "Usuario repite la solicitud 3+ veces",
      desc: "Antes de abandonar · 41% de casos",
    },
    {
      dot: "#F5A623",
      title: "Abandono sin escalación a humano",
      desc: "No hay handoff configurado · 38% de casos",
    },
  ];

  return (
    <div style={card}>
      <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>
        Patrones detectados
      </div>
      <div className="space-y-5">
        {patterns.map((p) => (
          <div key={p.title} className="flex gap-3 items-start">
            {/* Dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: p.dot,
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <div>
              <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                {p.title}
              </div>
              <div style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${colors.border}`, margin: "20px 0" }} />

      {/* Extra stat */}
      <div className="flex items-center justify-between">
        <span style={{ color: colors.textSecondary, fontSize: 11 }}>Intentos promedio antes del abandono</span>
        <span style={{ color: colors.error, fontSize: 13, fontWeight: 600 }}>3.8x</span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span style={{ color: colors.textSecondary, fontSize: 11 }}>Tiempo medio en flujo antes de salida</span>
        <span style={{ color: colors.warning, fontSize: 13, fontWeight: 600 }}>4m 12s</span>
      </div>
    </div>
  );
}

// ─── Conversations card ──────────────────────────────────────────────────────
type Convo = {
  lang: string;
  time: string;
  flow: string;
  quote: string;
  botReply: string;
  barColor: string;
};

function ConversationsCard() {
  const { colors } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const convos: Convo[] = [
    {
      lang: "ES",
      time: "hace 1 día",
      flow: "Devoluciones",
      quote: "Quiero cancelar mi suscripción ahora mismo, no me está funcionando nada.",
      botReply: "\"Entiendo tu consulta. ¿En qué más puedo ayudarte?\" → abandono",
      barColor: "#FF6B6B",
    },
    {
      lang: "PT",
      time: "hace 2 días",
      flow: "Cambio de plan",
      quote: "Preciso cancelar, já tentei três vezes e o bot não entende o que quero.",
      botReply: "\"Por favor, consulta nuestra sección de ayuda.\" → abandono",
      barColor: "#FF6B6B",
    },
    {
      lang: "ES",
      time: "hace 3 días",
      flow: "Facturación",
      quote: "Llevo media hora intentando cancelar y el sistema me sigue mandando al mismo menú.",
      botReply: "\"Selecciona una opción del menú principal.\" → abandono",
      barColor: "#F5A623",
    },
    {
      lang: "ES",
      time: "hace 4 días",
      flow: "Soporte técnico",
      quote: "No quiero ayuda, quiero cancelar. ¿Por qué no existe esa opción?",
      botReply: "\"Lo siento, no he entendido tu solicitud.\" → abandono",
      barColor: "#F5A623",
    },
  ];

  return (
    <div style={card}>
      <div style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>
        Ejemplos de conversaciones reales
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {convos.map((c, i) => (
          <div
            key={i}
            style={{
              backgroundColor: colors.background,
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              overflow: "hidden",
            }}
          >
            {/* Top accent bar */}
            <div style={{ height: 3, backgroundColor: c.barColor }} />

            <div style={{ padding: "14px 16px" }}>
              {/* Meta */}
              <div style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 10 }}>
                Usuario · {c.flow} · {c.lang} · {c.time}
              </div>

              {/* Quote bubble */}
              <div
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 10,
                  borderLeft: `3px solid ${c.barColor}60`,
                }}
              >
                <p
                  style={{
                    color: colors.textPrimary,
                    fontSize: 12,
                    fontStyle: "italic",
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  "{c.quote}"
                </p>
              </div>

              {/* Bot reply */}
              <div style={{ color: colors.error, fontSize: 11, lineHeight: 1.5 }}>
                Bot respondió: {c.botReply}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recommendation banner ───────────────────────────────────────────────────
function RecommendationBanner() {
  const { colors } = useTheme();

  return (
    <div
      style={{
        backgroundColor: "rgba(26,143,227,0.08)",
        border: "1px solid #1A8FE3",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: "rgba(26,143,227,0.15)",
          border: "1px solid rgba(26,143,227,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Zap size={15} color="#1A8FE3" />
      </div>

      <div className="flex-1">
        <div style={{ color: colors.link, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          Recomendación del sistema
        </div>
        <p style={{ color: "#DFF5EF", fontSize: 12, margin: 0, lineHeight: 1.7 }}>
          Configura un flujo dedicado de cancelación con confirmación explícita en 2 pasos y ofrece
          una alternativa de pausa o descuento antes del cierre. Añade un handoff a agente humano
          cuando el usuario repita la intención más de 2 veces.{" "}
          <strong style={{ color: colors.textPrimary }}>
            Impacto estimado: reducción del 60% en abandono sin resolución
          </strong>{" "}
          y recuperación de ~2.5k conversaciones mensuales con resolución positiva.
        </p>

        <div className="flex items-center gap-6 mt-4 flex-wrap">
          {[
            { label: "Dificultad de implementación", value: "Media", color: colors.warning },
            { label: "Impacto esperado", value: "Alto", color: colors.accent },
            { label: "Tiempo estimado", value: "~3 días", color: colors.textSecondary },
          ].map((tag) => (
            <div key={tag.label} className="flex items-center gap-2">
              <span style={{ color: colors.textSecondary, fontSize: 11 }}>{tag.label}:</span>
              <span style={{ color: tag.color, fontSize: 11, fontWeight: 600 }}>{tag.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        className="flex items-center gap-1.5 shrink-0 transition-colors"
        style={{
          color: colors.link,
          fontSize: 12,
          fontWeight: 500,
          border: "1px solid rgba(26,143,227,0.4)",
          borderRadius: 6,
          padding: "6px 14px",
          backgroundColor: "transparent",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(26,143,227,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
        }}
      >
        Ver plan de acción
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function CancelarSuscripcionPage() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Intenciones" />} mainClassName="space-y-4">

          {/* Breadcrumb + Back */}
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
              <Link href="/" style={{ color: colors.textSecondary, textDecoration: "none" }} className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <span style={{ color: colors.textSecondary, margin: "0 5px" }}>›</span>
              <span style={{ color: colors.textSecondary }}>Intenciones</span>
              <span style={{ color: colors.textSecondary, margin: "0 5px" }}>›</span>
              <span style={{ color: colors.textPrimary }}>Cancelar suscripción</span>
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

          {/* Page header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
                  Intención: Cancelar suscripción
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
                4.2k mensajes afectados · Abril 2025 · sin resolución detectada
              </p>
            </div>

            {/* Status pill */}
            <div
              style={{
                flexShrink: 0,
                backgroundColor: "rgba(255,107,107,0.08)",
                border: "1px solid rgba(255,107,107,0.2)",
                borderRadius: 8,
                padding: "8px 16px",
                textAlign: "center",
              }}
            >
              <div style={{ color: colors.error, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Estado
              </div>
              <div style={{ color: colors.error, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                Sin handoff
              </div>
            </div>
          </div>

          {/* KPI row */}
          <IntentKpiRow />

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FlowsCard />
            <PatternsCard />
          </div>

          {/* Conversations */}
          <ConversationsCard />

          {/* Recommendation banner */}
          <RecommendationBanner />

    </DashboardShell>
  );
}
