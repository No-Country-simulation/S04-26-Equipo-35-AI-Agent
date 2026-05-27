"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { AlertTriangle, X, Download, MessageSquareWarning, ExternalLink, ChevronRight, Plus, CheckCircle2, ChevronDown } from "lucide-react";
import { useTheme } from "../context/theme-context";
import { dispatchAccionesRefresh, buildSeedItems } from "../lib/action-seeds";
import type { ActionItem } from "../lib/action-seeds";
import type { GlobalKPIs, FlowTableItem, TrendData, VoiceOfCustomerMessage } from "../lib/api";
import { fetchVoiceOfCustomer } from "../lib/api";

type Props = {
  kpis: GlobalKPIs;
  flows: FlowTableItem[];
  trendData: TrendData[];
};

function normalizeKey(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, ""); // remove spaces, underscores, hyphens
}

// ─── KPI Row ─────────────────────────────────────────────────────────────────
function FrustracionKpiRow({ kpis }: { kpis: GlobalKPIs }) {
  const { colors } = useTheme();

  const criticalFlows = Number(kpis.criticalFlows) || 0;
  const abandonmentDelta = kpis.deltas
    ? `${kpis.deltas.abandonment_rate_delta >= 0 ? "▲" : "▼"} ${Math.abs(kpis.deltas.abandonment_rate_delta)}% vs mes ant.`
    : "datos en vivo";

  const kpiList = [
    {
      label: "NIVEL DE MALESTAR",
      value: kpis.frustrationIndex,
      delta: kpis.deltas
        ? `${kpis.deltas.frustration_pct_delta >= 0 ? "▲" : "▼"} ${Math.abs(kpis.deltas.frustration_pct_delta)}% vs mes ant.`
        : "escala de impacto 0–2",
      deltaColor: colors.error,
    },
    {
      label: "PUNTOS DE FRICCIÓN",
      value: criticalFlows.toString(),
      delta: "con abandono o churn",
      deltaColor: colors.warning,
    },
    {
      label: "TASA DE ABANDONO",
      value: kpis.abandonmentRate || "—",
      delta: abandonmentDelta,
      deltaColor: colors.error,
    },
    {
      label: "CLIENTES ANALIZADOS",
      value: kpis.totalSessions > 999
        ? (kpis.totalSessions / 1000).toFixed(1) + "k"
        : kpis.totalSessions.toString(),
      delta: `${kpis.totalMessages > 999 ? (kpis.totalMessages / 1000).toFixed(1) + "k" : kpis.totalMessages} mensajes`,
      deltaColor: colors.textMuted,
    },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
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
      {kpiList.map((k) => (
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
function FlowsTable({
  flows,
  onSelect,
  selected,
  actions = [],
  isHistory = false,
}: {
  flows: FlowTableItem[];
  onSelect: (flow: FlowTableItem) => void;
  selected: FlowTableItem | null;
  actions?: ActionItem[];
  isHistory?: boolean;
}) {
  const { colors } = useTheme();
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  if (!flows || flows.length === 0) {
    return (
      <div style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, border: `1px solid ${colors.border}` }}>
        <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
          {isHistory ? "No hay fricciones resueltas en el historial." : "No hay fricciones sin resolver."}
        </div>
      </div>
    );
  }

  const filtered = severityFilter === "all" ? flows : flows.filter((f) => f.severity === severityFilter);

  const exportCSV = () => {
    const header = ["Flujo", "Frustración %", "Abandono %", "Conversaciones", "Resolución %", "Severidad"];
    const rows = filtered.map((f) => [f.name, f.frustration, f.abandonment, f.conversations, f.resolution, f.severity]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "frustracion.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const severityOptions = [
    { key: "all", label: "Todos", color: colors.textMuted },
    { key: "crítico", label: "Crítico", color: "#FF6B6B" },
    { key: "alto", label: "Alto", color: "#F5A623" },
    { key: "medio", label: "Medio", color: "#6B93A8" },
    { key: "bajo", label: "Bajo", color: colors.textMuted },
  ];

  return (
    <div style={{ backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, padding: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div style={{ color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {isHistory ? "Historial de fricciones resueltas" : "Puntos de contacto con mayor fricción"} · {filtered.length} resultados
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {severityOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSeverityFilter(opt.key)}
              style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                border: severityFilter === opt.key ? `1px solid ${opt.color}` : `1px solid ${colors.border}`,
                backgroundColor: severityFilter === opt.key ? `${opt.color}15` : "transparent",
                color: severityFilter === opt.key ? opt.color : colors.textMuted,
                fontWeight: severityFilter === opt.key ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={exportCSV}
            style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 10px",
              borderRadius: 20, cursor: "pointer", border: `1px solid ${colors.border}`,
              backgroundColor: "transparent", color: colors.textMuted,
            }}
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 24px", gap: 8, padding: "6px 12px", borderBottom: `1px solid ${colors.border}`, marginBottom: 4 }}>
        {["Punto de contacto", "Fricción", "Abandono", "Clientes", "Impacto", ""].map((h) => (
          <div key={h} style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: h === "Flujo" ? "left" : "center" }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 24 }}>Sin resultados para este filtro.</div>
      ) : filtered.map((flow, i) => {
        const isSelected = selected?.intentKey === flow.intentKey;
        const act = actions.find((a) => a.source_type === "flow" && a.source_id === flow.intentKey);

        return (
          <button
            key={flow.intentKey}
            onClick={() => onSelect(flow)}
            style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 24px", gap: 8,
              padding: "10px 12px", borderRadius: 6, width: "100%", textAlign: "left",
              backgroundColor: isSelected ? `${colors.accent}15` : i % 2 === 0 ? colors.card : colors.background,
              border: isSelected ? `1px solid ${colors.accent}40` : "1px solid transparent",
              cursor: "pointer", alignItems: "center", transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
              <div style={{ color: isSelected ? colors.accent : colors.textPrimary, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {flow.name}
              </div>
              {act && act.status !== "resolved" && !act.notes?.startsWith("[ARCHIVED]") && (
                <span style={{
                  backgroundColor: act.status === "in_progress" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.12)",
                  color: act.status === "in_progress" ? "#60a5fa" : "#fbbf24",
                  border: `1px solid ${act.status === "in_progress" ? "rgba(59,130,246,0.25)" : "rgba(245,158,11,0.25)"}`,
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "1px 5px",
                  borderRadius: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}>
                  {act.status === "in_progress" ? "En Desarrollo" : act.status === "analyzing" ? "En Análisis" : "Planificado"}
                </span>
              )}
              {act && (act.status === "resolved" || act.notes?.startsWith("[ARCHIVED]")) && (
                <span style={{
                  backgroundColor: "rgba(34,197,94,0.12)",
                  color: "#34d399",
                  border: "1px solid rgba(34,197,94,0.25)",
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "1px 5px",
                  borderRadius: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}>
                  Resuelto
                </span>
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                <div style={{ height: "100%", width: `${flow.frustration}%`, backgroundColor: flow.frustration >= 75 ? "#FF6B6B" : flow.frustration >= 50 ? "#F5A623" : colors.accent, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: flow.frustration >= 75 ? "#FF6B6B" : flow.frustration >= 50 ? "#F5A623" : colors.textPrimary }}>{flow.frustration}%</span>
            </div>
            <div style={{ color: colors.textPrimary, fontSize: 12, textAlign: "center" }}>{flow.abandonment}%</div>
            <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>{flow.conversations}</div>
            <div style={{ textAlign: "center" }}>
              <span style={{ backgroundColor: flow.severityBg, color: flow.severityColor, fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 20, border: `1px solid ${flow.severityColor}40` }}>
                {flow.severity}
              </span>
            </div>
            <ChevronRight size={14} style={{ color: isSelected ? colors.accent : colors.textMuted }} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function FlowSidePanel({
  flow,
  onClose,
  actions = [],
}: {
  flow: FlowTableItem;
  onClose: () => void;
  actions: ActionItem[];
}) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<VoiceOfCustomerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdLocal, setCreatedLocal] = useState(false);

  const existingAction = actions.find((a) => a.source_type === "flow" && a.source_id === flow.intentKey);
  const hasAction = !!existingAction || createdLocal;

  const createAction = async () => {
    setCreating(true);
    const sevMap: Record<string, string> = { crítico: "critical", alto: "high", medio: "medium", bajo: "low" };
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Resolver fricción: ${flow.name}`,
          description: `${flow.conversations} clientes afectados. Fricción ${flow.frustration}%, abandono ${flow.abandonment}%.`,
          source_type: "flow",
          source_id: flow.intentKey,
          severity: sevMap[flow.severity] ?? "high",
          impact_score: flow.frustration / 100,
          status: "detected",
          is_suggestion: false,
        }),
      });
      setCreatedLocal(true);
      dispatchAccionesRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setCreatedLocal(false);
    fetchVoiceOfCustomer(flow.intentKey).then((data) => {
      setMessages(data);
      setLoading(false);
    });
  }, [flow.intentKey]);

  return (
    <div style={{
      width: 360, flexShrink: 0, backgroundColor: colors.card, border: `1px solid ${colors.border}`,
      borderRadius: 12, display: "flex", flexDirection: "column", maxHeight: "70vh", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            <MessageSquareWarning size={14} style={{ color: colors.error, display: "inline", marginRight: 6 }} />
            {flow.name}
          </div>
          <div style={{ color: colors.textMuted, fontSize: 11 }}>
            {flow.conversations} sesiones · Frustración: <span style={{ color: "#FF6B6B", fontWeight: 600 }}>{flow.frustration}%</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, padding: 2 }}>
          <X size={16} />
        </button>
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {hasAction ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
              color: (existingAction?.status === "resolved" || existingAction?.notes?.startsWith("[ARCHIVED]")) ? colors.success : colors.accent,
              backgroundColor: (existingAction?.status === "resolved" || existingAction?.notes?.startsWith("[ARCHIVED]")) ? `${colors.success}15` : `${colors.accent}15`,
              border: `1px solid ${(existingAction?.status === "resolved" || existingAction?.notes?.startsWith("[ARCHIVED]")) ? colors.success : colors.accent}40`,
              borderRadius: 8, padding: "6px 12px",
            }}>
              <CheckCircle2 size={13} />
              {existingAction?.status === "resolved" || existingAction?.notes?.startsWith("[ARCHIVED]")
                ? "Resuelto"
                : existingAction?.status === "in_progress"
                ? "En Desarrollo"
                : existingAction?.status === "analyzing"
                ? "En Análisis"
                : "Planificado"}
            </span>
            <a href="/acciones" style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
              color: colors.textPrimary, backgroundColor: colors.background, border: `1px solid ${colors.border}`,
              borderRadius: 8, padding: "6px 12px", textDecoration: "none",
            }}>
              <ExternalLink size={13} /> Ver en Acciones
            </a>
          </div>
        ) : (
          <button
            onClick={createAction}
            disabled={creating}
            style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
              color: colors.textPrimary,
              backgroundColor: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: 8, padding: "6px 12px", cursor: creating ? "default" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            <Plus size={13} />
            {creating ? "Creando..." : "Crear acción"}
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ overflowY: "auto", flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          Voz del cliente
        </div>
        {loading ? (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 24, fontSize: 12 }}>Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 24, fontSize: 12, fontStyle: "italic" }}>
            No se encontraron mensajes frustrados para este flujo aún.
          </div>
        ) : messages.map((msg, idx) => (
          <div key={`${msg.session_id}-${idx}`} style={{
            backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12,
            borderLeft: `3px solid ${msg.sentiment_score > 0.7 ? "#FF6B6B" : msg.sentiment_score > 0.4 ? "#F5A623" : colors.textMuted}`,
          }}>
            <div style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 1.5, marginBottom: 8, fontStyle: "italic" }}>
              &ldquo;{msg.text_clean || msg.texto_espanol || msg.texto_portugues}&rdquo;
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: colors.error, backgroundColor: `${colors.error}15`, padding: "2px 7px", borderRadius: 4, fontWeight: 500 }}>
                Malestar: {(msg.sentiment_score * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: 10, color: colors.textMuted }}>Sesión: {msg.session_id}</span>
              <span style={{ fontSize: 10, color: msg.resolved ? colors.success : colors.error }}>
                {msg.resolved ? "✓ Resuelto" : "✗ Sin resolver"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline Chart ───────────────────────────────────────────────────────────
const CHART_FALLBACK: TrendData[] = [
  { month: "Dic", es: 142, pt: 58 },
  { month: "Ene", es: 167, pt: 71 },
  { month: "Feb", es: 189, pt: 84 },
  { month: "Mar", es: 203, pt: 97 },
  { month: "Abr", es: 178, pt: 88 },
  { month: "May", es: 221, pt: 103 },
];

function TimelineChart({ data }: { data: TrendData[] }) {
  const { colors } = useTheme();
  const allZero = data.length === 0 || data.every((d) => d.es === 0 && d.pt === 0);
  const chartData = allZero ? CHART_FALLBACK : data;

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
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
          Evolución de la fricción — últimos 6 meses
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
          {chartData.map((d) => {
            const maxVal = Math.max(...chartData.map((x) => Math.max(x.es, x.pt)), 1);
            const esHeight = (d.es / maxVal) * 100;
            const ptHeight = (d.pt / maxVal) * 100;

            return (
              <div key={d.month} style={{ flex: 1, position: "relative", height: "100%" }}>
                <div style={{ width: "100%", height: "100%", display: "flex", gap: 4, alignItems: "flex-end" }}>
                  <div
                    style={{
                      flex: 1,
                      height: `${esHeight}%`,
                      backgroundColor: "#1A8FE3",
                      borderRadius: "3px 3px 0 0",
                      minHeight: 4,
                      transition: "height 0.3s ease",
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: `${ptHeight}%`,
                      backgroundColor: colors.accent,
                      borderRadius: "3px 3px 0 0",
                      minHeight: 4,
                      transition: "height 0.3s ease",
                    }}
                  />
                </div>
                <span style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: colors.textMuted, whiteSpace: "nowrap" }}>
                  {d.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {allZero && !data.length && (
        <div style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Sin histórico aún. Ejecutá el pipeline completo para ver la evolución.
        </div>
      )}
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function FrustracionPage({ kpis, flows, trendData }: Props) {
  const { colors } = useTheme();
  const [selectedFlow, setSelectedFlow] = useState<FlowTableItem | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch("/api/actions");
      if (res.ok) {
        const aData = await res.json();
        if (aData && aData.length === 0) {
          setActions(buildSeedItems());
        } else {
          setActions(aData);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchActions();

    const handleRefresh = () => {
      fetchActions();
    };
    window.addEventListener("acciones-updated", handleRefresh);
    return () => {
      window.removeEventListener("acciones-updated", handleRefresh);
    };
  }, [fetchActions]);

  const getActionForFlow = (intentKey: string) => {
    const normKey = normalizeKey(intentKey);
    return actions.find((a) => {
      if (a.source_type !== "flow") return false;
      const normSource = normalizeKey(a.source_id);
      return normSource === normKey || normSource.includes(normKey) || normKey.includes(normSource);
    });
  };

  const activeFlows = flows.filter((f) => {
    const act = getActionForFlow(f.intentKey);
    if (!act) return true;
    return act.status !== "resolved" && !act.notes?.startsWith("[ARCHIVED]");
  });

  const resolvedFlows = flows.filter((f) => {
    const act = getActionForFlow(f.intentKey);
    if (!act) return false;
    return act.status === "resolved" || act.notes?.startsWith("[ARCHIVED]");
  });

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Frustración" />} mainClassName="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
        <Link href="/" style={{ color: colors.textSecondary, textDecoration: "none" }}>
          Dashboard
        </Link>
        <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
        <span style={{ color: colors.textPrimary }}>Frustración</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} color={colors.warning} />
        <h1 style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>
          Experiencia del cliente
        </h1>
      </div>
      <p style={{ color: colors.textSecondary, fontSize: 12, margin: 0 }}>
        Identificá dónde los clientes tienen fricción y qué los lleva a abandonar · datos en vivo
      </p>

      {/* KPI Cards */}
      <FrustracionKpiRow kpis={kpis} />

      {/* Flows Table + Side Panel */}
      {flows.length === 0 ? (
        <div style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, color: colors.textMuted, fontSize: 13 }}>
          Sin datos. Ejecuta el ETL primero desde la pestaña Corpus.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FlowsTable
              flows={activeFlows}
              onSelect={(flow) => setSelectedFlow(prev => prev?.intentKey === flow.intentKey ? null : flow)}
              selected={selectedFlow}
              actions={actions}
            />
          </div>
          {selectedFlow && activeFlows.some(af => af.intentKey === selectedFlow.intentKey) && (
            <FlowSidePanel
              flow={selectedFlow}
              onClose={() => setSelectedFlow(null)}
              actions={actions}
            />
          )}
        </div>
      )}

      {/* Historial de fricciones resueltas */}
      {resolvedFlows.length > 0 && (
        <div style={{ marginTop: 24, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
              <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>
                Historial de fricciones resueltas
              </span>
              <span style={{
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                fontSize: 10,
                fontWeight: 600,
                padding: "1px 7px",
                borderRadius: 8,
              }}>
                {resolvedFlows.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: colors.textMuted,
                marginLeft: "auto",
                transform: showHistory ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {showHistory && (
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FlowsTable
                  flows={resolvedFlows}
                  onSelect={(flow) => setSelectedFlow(prev => prev?.intentKey === flow.intentKey ? null : flow)}
                  selected={selectedFlow}
                  actions={actions}
                  isHistory={true}
                />
              </div>
              {selectedFlow && resolvedFlows.some(rf => rf.intentKey === selectedFlow.intentKey) && (
                <FlowSidePanel
                  flow={selectedFlow}
                  onClose={() => setSelectedFlow(null)}
                  actions={actions}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline Chart */}
      <TimelineChart data={trendData} />
    </DashboardShell>
  );
}
