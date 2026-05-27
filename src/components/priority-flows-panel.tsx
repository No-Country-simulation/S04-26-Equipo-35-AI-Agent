"use client";

import { Target, ArrowRight, AlertTriangle, Users, TrendingDown, HelpCircle } from "lucide-react";
import { useTheme } from "../context/theme-context";
import type { PriorityFlow } from "../lib/api";

const PRIORITY_CONFIG = [
  { label: "P1 — Urgente", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
  { label: "P2 — Alto",    color: "#F5A623", bg: "rgba(245,166,35,0.12)" },
  { label: "P3 — Medio",   color: "#1A8FE3", bg: "rgba(26,143,227,0.12)" },
];

function ImpactBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.round(value * 100), 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct, 4)}%`, height: "100%", backgroundColor: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 36, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

function EmptyCard({ rank, colors }: { rank: number; colors: ReturnType<typeof useTheme>["colors"] }) {
  const cfg = PRIORITY_CONFIG[rank];
  return (
    <article
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.02)", opacity: 0.5 }}
    >
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
      <div style={{ color: colors.textMuted, fontSize: 12, fontStyle: "italic" }}>
        Sin suficientes datos — ejecuta el pipeline completo
      </div>
    </article>
  );
}

export function PriorityFlowsPanel({ flows }: { flows: PriorityFlow[] }) {
  const { colors, isDark } = useTheme();

  const cards = [0, 1, 2].map((i) => flows[i] ?? null);

  return (
    <section
      className="rounded-xl border p-5"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4" style={{ flexWrap: "wrap" }}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.15)" }}>
            <Target size={20} style={{ color: colors.accent }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
              Flujos a atacar esta semana
            </h2>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: colors.textSecondary }}>
              <TrendingDown size={12} />
              Ordenados por impacto = volumen × no-resolución × frustración
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: colors.textMuted, cursor: "help" }}
          title="Impacto: % de daño total al negocio. Sin resolver: % de sesiones que terminaron sin solución. IRR: tasa de resolución de intent."
        >
          <HelpCircle size={13} />
          ¿Cómo se calculan?
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((flow, i) =>
          !flow ? (
            <EmptyCard key={i} rank={i} colors={colors} />
          ) : (
            <article
              key={flow.intent_label}
              className="rounded-lg border p-4 flex flex-col gap-3"
              style={{
                borderColor: PRIORITY_CONFIG[i].color + "40",
                backgroundColor: isDark ? PRIORITY_CONFIG[i].bg : "rgba(248,250,252,0.8)",
              }}
            >
              {/* Rank + name */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                  style={{ color: PRIORITY_CONFIG[i].color, backgroundColor: PRIORITY_CONFIG[i].bg }}
                >
                  {PRIORITY_CONFIG[i].label}
                </span>
                {(flow.abandonment_rate ?? 0) > 0.3 && (
                  <span title="Alta tasa de abandono">
                    <AlertTriangle size={14} style={{ color: "#FF6B6B" }} />
                  </span>
                )}
              </div>
              <h3
                className="text-sm font-bold leading-snug capitalize"
                style={{ color: colors.textPrimary }}
              >
                {flow.intent_label.replace(/_/g, " ")}
              </h3>

              {/* Impact bar */}
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Impacto de negocio
                  </span>
                </div>
                <ImpactBar value={flow.impact_score} color={PRIORITY_CONFIG[i].color} />
              </div>

              {/* Key metrics */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2" style={{ fontSize: 11 }}>
                <div>
                  <dt style={{ color: colors.textMuted }}>Sin resolver</dt>
                  <dd style={{ color: flow.unresolved_pct > 50 ? "#FF6B6B" : colors.textPrimary, fontWeight: 700 }}>
                    {flow.unresolved_pct}%
                  </dd>
                </div>
                <div>
                  <dt style={{ color: colors.textMuted }} title="Intent Resolution Rate: % de sesiones resueltas">
                    Resolución (IRR)
                  </dt>
                  <dd style={{ color: flow.irr > 0.7 ? colors.accent : colors.warning, fontWeight: 700 }}>
                    {(flow.irr * 100).toFixed(0)}%
                  </dd>
                </div>
                <div>
                  <dt style={{ color: colors.textMuted }} className="flex items-center gap-1">
                    <Users size={10} /> Sesiones
                  </dt>
                  <dd style={{ color: colors.textPrimary, fontWeight: 600 }}>{flow.session_count}</dd>
                </div>
                {(flow.abandonment_rate ?? 0) > 0 && (
                  <div>
                    <dt style={{ color: colors.textMuted }}>Abandono</dt>
                    <dd style={{ color: (flow.abandonment_rate ?? 0) > 0.3 ? "#FF6B6B" : colors.textPrimary, fontWeight: 600 }}>
                      {((flow.abandonment_rate ?? 0) * 100).toFixed(0)}%
                    </dd>
                  </div>
                )}
              </dl>

              {/* CTA */}
              <a
                href={`#story-${flow.intent_label}`}
                className="mt-auto inline-flex items-center gap-1 text-xs font-semibold"
                style={{
                  color: PRIORITY_CONFIG[i].color,
                  textDecoration: "none",
                  borderTop: `1px solid ${colors.border}`,
                  paddingTop: 10,
                  marginTop: 4,
                }}
              >
                Ver tarea en Action Hub
                <ArrowRight size={13} />
              </a>
            </article>
          )
        )}
      </div>
    </section>
  );
}
