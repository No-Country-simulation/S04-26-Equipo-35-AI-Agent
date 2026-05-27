"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "../context/theme-context";
import type { BusinessInsights, Recommendation } from "../lib/report-insights";

const P_COLOR: Record<string, string> = { "crítico": "#FF6B6B", "alto": "#F5A623", "oportunidad": "#1A8FE3" };
const P_LABEL: Record<string, string> = { "crítico": "Crítico", "alto": "Alta prioridad", "oportunidad": "Oportunidad" };
const CAT_LABEL: Record<string, string> = {
  friccion_repetida: "Fricción repetida",
  escalada: "Escalada a agente humano",
  experiencia: "Experiencia del cliente",
  cobertura: "Cobertura de solicitudes",
  diseno_experiencia: "Diseño de la experiencia",
};

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const pColor = P_COLOR[rec.priority] ?? colors.textMuted;

  return (
    <div style={{
      border: `1px solid ${pColor}30`,
      borderLeft: `4px solid ${pColor}`,
      borderRadius: 10,
      backgroundColor: `${pColor}08`,
      overflow: "hidden",
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: pColor, backgroundColor: `${pColor}18`, border: `1px solid ${pColor}40`, borderRadius: 6, padding: "2px 8px", flexShrink: 0, marginTop: 2 }}>
          {P_LABEL[rec.priority] ?? rec.priority}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{rec.title}</div>
          <div style={{ color: colors.textMuted, fontSize: 11 }}>{CAT_LABEL[rec.category]} · {rec.what}</div>
        </div>
        {open ? <ChevronUp size={15} style={{ color: colors.textMuted, flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: colors.textMuted, flexShrink: 0 }} />}
      </button>

      {/* Expandable detail */}
      {open && (
        <div style={{ padding: "0 16px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: colors.textMuted, marginBottom: 4 }}>¿Por qué es un problema?</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.6 }}>{rec.why}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: colors.textMuted, marginBottom: 4 }}>¿Cómo resolverlo?</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.6 }}>{rec.how}</div>
          </div>
          <div style={{ backgroundColor: `${pColor}10`, border: `1px solid ${pColor}30`, borderRadius: 6, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: pColor, marginBottom: 2 }}>Métrica de éxito</div>
            <div style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{rec.metric}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportBusinessSection({ insights }: { insights: BusinessInsights }) {
  const { colors, isDark } = useTheme();

  const cardStyle: React.CSSProperties = {
    backgroundColor: isDark ? "rgba(15,23,42,0.6)" : "#f8fafc",
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 20,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section style={{ ...cardStyle }} className="lg:col-span-2">
        <h3 className="text-sm font-semibold mb-1" style={{ color: colors.textPrimary }}>
          Matriz de impacto por solicitud
        </h3>
        <p className="text-xs mb-4" style={{ color: colors.textSecondary }}>
          Período {insights.period} · Tasa de resolución = conversaciones resueltas / total por tipo de solicitud
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ color: colors.textSecondary }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {["Solicitud del cliente", "Sesiones", "Tasa de resolución", "Sin resolver", "Malestar", "Abandono", "Impacto"].map(
                  (h) => (
                    <th key={h} className="text-left py-2 pr-3 font-medium" style={{ color: colors.textMuted }}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {insights.intentMatrix.slice(0, 12).map((row) => (
                <tr key={row.intent_label} style={{ borderBottom: `1px solid ${colors.border}40` }}>
                  <td className="py-2 pr-3 capitalize" style={{ color: colors.textPrimary }}>
                    {row.intent_label.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 pr-3">{row.session_count}</td>
                  <td className="py-2 pr-3">{(row.irr * 100).toFixed(0)}%</td>
                  <td className="py-2 pr-3">{row.unresolved_pct}%</td>
                  <td className="py-2 pr-3">{row.avg_frustration.toFixed(2)}</td>
                  <td className="py-2 pr-3">{((row.abandonment_rate ?? 0) * 100).toFixed(0)}%</td>
                  <td className="py-2 font-mono font-semibold" style={{ color: colors.warning }}>
                    {(row.impact_score * 100).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {insights.breakpoints && (
        <section style={cardStyle}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: colors.textPrimary }}>
            ¿Cuándo se pierde al cliente?
          </h3>
          <ul className="space-y-2 text-sm" style={{ color: colors.textSecondary }}>
            <li>
              Turno medio en que el cliente <strong style={{ color: colors.textPrimary }}>pide hablar con una persona</strong>:{" "}
              {insights.breakpoints.avg_turn_first_escalation ?? "—"}
            </li>
            <li>
              Turno medio del <strong style={{ color: colors.textPrimary }}>momento de mayor malestar</strong>:{" "}
              {insights.breakpoints.avg_turn_high_frustration ?? "—"}
            </li>
            <li>Clientes que pidieron hablar con una persona: {insights.breakpoints.sessions_with_escalation}</li>
          </ul>
        </section>
      )}

      {insights.repeatIntent && (
        <section style={cardStyle}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: colors.textPrimary }}>
            Clientes que repiten su consulta sin resolver
          </h3>
          <p className="text-2xl font-bold mb-1" style={{ color: colors.error }}>
            {(insights.repeatIntent.repeat_intent_session_rate * 100).toFixed(0)}%
          </p>
          <p className="text-xs" style={{ color: colors.textSecondary }}>
            de conversaciones donde el cliente repitió su solicitud sin obtener respuesta
          </p>
        </section>
      )}

      {/* Recommendations for Product Team */}
      {insights.recommendations.length > 0 && (
        <section style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                Recomendaciones del equipo de análisis
              </h3>
              <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                Generadas automáticamente a partir del comportamiento real de los clientes · Expandí cada una para ver el detalle
              </p>
            </div>
            <span style={{ fontSize: 11, color: colors.textMuted }}>
              {insights.recommendations.length} recomendacion{insights.recommendations.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.recommendations.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
