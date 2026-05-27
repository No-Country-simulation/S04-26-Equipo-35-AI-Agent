"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { Target, X, Download, MessageSquare, Plus, CheckCircle2, ChevronRight, ExternalLink, ChevronDown } from "lucide-react";
import { dispatchAccionesRefresh, buildSeedItems, type ActionItem } from "../lib/action-seeds";
import { useTheme } from "../context/theme-context";
import type { IntentTableItem, VoiceOfCustomerMessage, TrendData } from "../lib/api";
import { fetchVoiceOfCustomer } from "../lib/api";

function normalizeKey(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, ""); // remove spaces, underscores, hyphens
}

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
      label: "SOLICITUDES SIN ATENDER",
      value: totalUnresolved.toString(),
      delta: "Oportunidades de mejora",
      deltaColor: colors.error,
    },
    {
      label: "CLIENTES AFECTADOS",
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
      label: "URGENTES",
      value: criticalCount.toString(),
      delta: "requieren atención inmediata",
      deltaColor: colors.error,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = { critical: "#FF6B6B", high: "#F5A623", medium: "#6B93A8", low: "#6B93A8" };
const SEV_LABEL: Record<string, string> = { critical: "crítico", high: "alto", medium: "medio", low: "bajo" };

// ─── Intents Table ───────────────────────────────────────────────────────────
function IntentsTable({
  intents,
  selected,
  onSelect,
  actions = [],
  isHistory = false,
}: {
  intents: IntentTableItem[];
  selected: IntentTableItem | null;
  onSelect: (i: IntentTableItem) => void;
  actions?: ActionItem[];
  isHistory?: boolean;
}) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<string>("all");

  if (!intents || intents.length === 0) {
    return (
      <div style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, border: `1px solid ${colors.border}` }}>
        <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
          {isHistory ? "No hay solicitudes resueltas en el historial." : "No hay solicitudes sin atender."}
        </div>
      </div>
    );
  }

  const filtered = filter === "all" ? intents : intents.filter((i) => i.severity === filter);

  const exportCSV = () => {
    const header = ["Intención", "Sesiones", "Frustración %", "Resolución %", "Severidad"];
    const rows = filtered.map((i) => [i.name, i.messages, i.frustration, i.resolution, SEV_LABEL[i.severity]]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "intenciones.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filterOpts = [
    { key: "all", label: "Todas", color: colors.textMuted },
    { key: "critical", label: "Crítico", color: "#FF6B6B" },
    { key: "high", label: "Alto", color: "#F5A623" },
    { key: "medium", label: "Medio", color: "#6B93A8" },
  ];

  return (
    <div style={{ backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, padding: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div style={{ color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {isHistory ? "Historial de solicitudes atendidas" : "Solicitudes sin atender"} · {filtered.length} resultados
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {filterOpts.map((opt) => (
            <button key={opt.key} onClick={() => setFilter(opt.key)} style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
              border: filter === opt.key ? `1px solid ${opt.color}` : `1px solid ${colors.border}`,
              backgroundColor: filter === opt.key ? `${opt.color}15` : "transparent",
              color: filter === opt.key ? opt.color : colors.textMuted,
              fontWeight: filter === opt.key ? 600 : 400,
            }}>{opt.label}</button>
          ))}
          <button onClick={exportCSV} style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 10px",
            borderRadius: 20, cursor: "pointer", border: `1px solid ${colors.border}`,
            backgroundColor: "transparent", color: colors.textMuted,
          }}>
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 24px", gap: 8, padding: "6px 12px", borderBottom: `1px solid ${colors.border}`, marginBottom: 4 }}>
        {["Solicitud del cliente", "Clientes", "Urgencia", "Impacto", ""].map((h) => (
          <div key={h} style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textAlign: h === "Intención" ? "left" : "center" }}>{h}</div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 24 }}>Sin solicitudes para este filtro.</div>
      ) : filtered.map((intent, i) => {
        const isSelected = selected?.intentKey === intent.intentKey;
        const sevColor = SEV_COLOR[intent.severity] ?? colors.textMuted;
        const act = actions.find((a) => a.source_type === "intent" && a.source_id === intent.intentKey);

        return (
          <button key={intent.intentKey} onClick={() => onSelect(intent)} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 24px", gap: 8,
            padding: "10px 12px", borderRadius: 6, width: "100%", textAlign: "left",
            backgroundColor: isSelected ? `${colors.accent}15` : i % 2 === 0 ? colors.card : colors.background,
            border: isSelected ? `1px solid ${colors.accent}40` : "1px solid transparent",
            cursor: "pointer", alignItems: "center", transition: "all 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
              <div style={{ color: isSelected ? colors.accent : colors.textPrimary, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {intent.name}
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
            <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>{intent.messages}</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                <div style={{ height: "100%", width: `${intent.frustration}%`, backgroundColor: sevColor, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: sevColor }}>{intent.frustration}%</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ backgroundColor: `${sevColor}18`, color: sevColor, fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 12, border: `1px solid ${sevColor}40` }}>
                {SEV_LABEL[intent.severity]}
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
function IntentSidePanel({
  intent,
  onClose,
  actions = [],
}: {
  intent: IntentTableItem;
  onClose: () => void;
  actions: ActionItem[];
}) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<VoiceOfCustomerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdLocal, setCreatedLocal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setCreatedLocal(false);
    fetchVoiceOfCustomer(intent.intentKey).then((data) => {
      setMessages(data);
      setLoading(false);
    });
  }, [intent.intentKey]);

  const existingAction = actions.find((a) => a.source_type === "intent" && a.source_id === intent.intentKey);
  const hasAction = !!existingAction || createdLocal;

  const createStory = async () => {
    setCreating(true);
    const sevMap: Record<string, string> = { critical: "critical", high: "high", medium: "medium", low: "low" };
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Resolver solicitud: ${intent.name}`,
          description: `${intent.messages} clientes afectados con ${intent.frustration}% de urgencia sin atender.`,
          source_type: "intent",
          source_id: intent.intentKey,
          severity: sevMap[intent.severity] ?? "medium",
          impact_score: intent.frustration / 100,
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

  const sevColor = SEV_COLOR[intent.severity] ?? colors.textMuted;

  return (
    <div style={{ width: 360, flexShrink: 0, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, display: "flex", flexDirection: "column", maxHeight: "72vh", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <MessageSquare size={14} style={{ color: sevColor }} />
            {intent.name}
          </div>
          <div style={{ color: colors.textMuted, fontSize: 11 }}>
            {intent.messages} clientes · Urgencia: <span style={{ color: sevColor, fontWeight: 600 }}>{intent.frustration}%</span>
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
            onClick={createStory}
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
          Lo que dicen los clientes
        </div>
        {loading ? (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 24, fontSize: 12 }}>Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 24, fontSize: 12, fontStyle: "italic" }}>
            Sin mensajes registrados para esta solicitud aún.
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
const SOLICITUDES_FALLBACK: TrendData[] = [
  { month: "Dic", es: 89,  pt: 31 },
  { month: "Ene", es: 104, pt: 38 },
  { month: "Feb", es: 121, pt: 44 },
  { month: "Mar", es: 138, pt: 52 },
  { month: "Abr", es: 112, pt: 41 },
  { month: "May", es: 149, pt: 57 },
];

function SolicitudesTimelineChart({ data }: { data: TrendData[] }) {
  const { colors } = useTheme();
  const allZero = data.length === 0 || data.every((d) => d.es === 0 && d.pt === 0);
  const chartData = allZero ? SOLICITUDES_FALLBACK : data;

  return (
    <div style={{
      backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`,
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", padding: 16,
    }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div style={{ color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Evolución de solicitudes sin atender — últimos 6 meses
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#1A8FE3", flexShrink: 0 }} />
            <span style={{ color: colors.textMuted, fontSize: 11 }}>ES</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: colors.accent, flexShrink: 0 }} />
            <span style={{ color: colors.textMuted, fontSize: 11 }}>PT</span>
          </div>
        </div>
      </div>
      <div style={{ position: "relative", height: 200 }}>
        <div style={{ position: "absolute", left: -35, top: 0, bottom: 25, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {[75, 50, 25, 0].map((val) => (
            <div key={val} style={{ color: colors.textMuted, fontSize: 10 }}>{val}%</div>
          ))}
        </div>
        <div style={{ position: "absolute", inset: "0 0 25px 0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ borderTop: `1px solid ${colors.textMuted}20` }} />
          ))}
        </div>
        <div style={{ position: "absolute", inset: "0 0 25px 0", display: "flex", alignItems: "flex-end", gap: 16 }}>
          {chartData.map((d) => {
            const maxVal = Math.max(...chartData.map((x) => Math.max(x.es, x.pt)), 1);
            const esH = (d.es / maxVal) * 100;
            const ptH = (d.pt / maxVal) * 100;
            return (
              <div key={d.month} style={{ flex: 1, position: "relative", height: "100%" }}>
                <div style={{ width: "100%", height: "100%", display: "flex", gap: 4, alignItems: "flex-end" }}>
                  <div style={{ flex: 1, height: `${esH}%`, backgroundColor: "#1A8FE3", borderRadius: "3px 3px 0 0", minHeight: 4, transition: "height 0.3s ease" }} />
                  <div style={{ flex: 1, height: `${ptH}%`, backgroundColor: colors.accent, borderRadius: "3px 3px 0 0", minHeight: 4, transition: "height 0.3s ease" }} />
                </div>
                <span style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: colors.textMuted, whiteSpace: "nowrap" }}>
                  {d.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────────
export function IntencionesPage({ data, trendData }: { data: IntentTableItem[]; trendData: TrendData[] }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<IntentTableItem | null>(null);
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

  const getActionForIntent = (intentKey: string) => {
    const normKey = normalizeKey(intentKey);
    return actions.find((a) => {
      if (a.source_type !== "intent") return false;
      const normSource = normalizeKey(a.source_id);
      return normSource === normKey || normSource.includes(normKey) || normKey.includes(normSource);
    });
  };

  const activeIntents = data.filter((item) => {
    const act = getActionForIntent(item.intentKey);
    if (!act) return true;
    return act.status !== "resolved" && !act.notes?.startsWith("[ARCHIVED]");
  });

  const resolvedIntents = data.filter((item) => {
    const act = getActionForIntent(item.intentKey);
    if (!act) return false;
    return act.status === "resolved" || act.notes?.startsWith("[ARCHIVED]");
  });

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Solicitudes" />} mainClassName="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
        <Link href="/" style={{ color: colors.textSecondary, textDecoration: "none" }}>Dashboard</Link>
        <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
        <span style={{ color: colors.textPrimary }}>Solicitudes</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Target size={20} color={colors.accent} />
        <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
          Solicitudes sin atender
        </h1>
      </div>
      <p style={{ color: colors.textSecondary, fontSize: 11, margin: 0 }}>
        ¿Qué piden los clientes que no están recibiendo? Creá una acción directamente desde aquí · datos en vivo
      </p>

      {/* KPI Cards */}
      <IntencionesKpiRow data={activeIntents} />

      {/* Table + Panel */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <IntentsTable
            intents={activeIntents}
            selected={selected}
            onSelect={(i) => setSelected((prev) => prev?.intentKey === i.intentKey ? null : i)}
            actions={actions}
          />
        </div>
        {selected && activeIntents.some(ai => ai.intentKey === selected.intentKey) && (
          <IntentSidePanel intent={selected} onClose={() => setSelected(null)} actions={actions} />
        )}
      </div>

      {/* Historial de solicitudes atendidas */}
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
              Historial de solicitudes atendidas (Resueltas)
            </span>
            <span style={{
              background: "rgba(34,197,94,0.15)",
              color: "#22c55e",
              fontSize: 10,
              fontWeight: 600,
              padding: "1px 7px",
              borderRadius: 8,
            }}>
              {resolvedIntents.length}
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
              <IntentsTable
                intents={resolvedIntents}
                selected={selected}
                onSelect={(i) => setSelected((prev) => prev?.intentKey === i.intentKey ? null : i)}
                actions={actions}
                isHistory={true}
              />
            </div>
            {selected && resolvedIntents.some(ri => ri.intentKey === selected.intentKey) && (
              <IntentSidePanel intent={selected} onClose={() => setSelected(null)} actions={actions} />
            )}
          </div>
        )}
      </div>

      {/* Timeline Chart */}
      <div style={{ paddingLeft: 40 }}>
        <SolicitudesTimelineChart data={trendData} />
      </div>
    </DashboardShell>
  );
}
