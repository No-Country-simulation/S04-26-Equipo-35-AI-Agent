"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../context/theme-context";
import {
  ChevronDown,
  ChevronUp,
  MessageSquareWarning,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
} from "lucide-react";
import type { UserStory, VoiceOfCustomerMessage } from "../lib/api";
import { fetchVoiceOfCustomer } from "../lib/api";

// ─── Voice of Customer Modal ──────────────────────────────────────────────────

function VoiceOfCustomerModal({
  intent,
  onClose,
}: {
  intent: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<VoiceOfCustomerMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVoiceOfCustomer(intent).then((data) => {
      setMessages(data);
      setLoading(false);
    });
  }, [intent]);

  const readableIntent = intent.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          width: "90%",
          maxWidth: 640,
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquareWarning size={18} style={{ color: colors.error }} />
            <div>
              <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>
                Voz del Cliente — {readableIntent}
              </div>
              <div style={{ color: colors.textMuted, fontSize: 11 }}>
                Mensajes reales del cliente
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: colors.textMuted,
              cursor: "pointer",
              fontSize: 18,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: 20, flex: 1 }}>
          {loading ? (
            <div style={{ color: colors.textMuted, textAlign: "center", padding: 40 }}>
              Cargando mensajes...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ color: colors.textMuted, textAlign: "center", padding: 40 }}>
              No se encontraron mensajes frustrados para esta intención.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.session_id}-${msg.turn_id}-${idx}`}
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 14,
                    borderLeft: `3px solid ${
                      msg.sentiment_score > 0.7
                        ? colors.error
                        : msg.sentiment_score > 0.4
                        ? colors.warning
                        : colors.textMuted
                    }`,
                  }}
                >
                  {/* Message text */}
                  <div
                    style={{
                      color: colors.textPrimary,
                      fontSize: 13,
                      lineHeight: 1.5,
                      marginBottom: 8,
                      fontStyle: "italic",
                    }}
                  >
                    &ldquo;{msg.text_clean || msg.texto_espanol || msg.texto_portugues}&rdquo;
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: colors.error,
                        backgroundColor: `${colors.error}15`,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      Malestar: {(msg.sentiment_score * 100).toFixed(0)}%
                    </span>
                    <span style={{ fontSize: 10, color: colors.textMuted }}>
                      Sesión: {msg.session_id}
                    </span>
                    <span style={{ fontSize: 10, color: colors.textMuted }}>
                      Región: {msg.region}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: msg.resolved ? colors.success : colors.error,
                      }}
                    >
                      {msg.resolved ? "✓ Resuelto" : "✗ Sin resolver"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function storyImpactScore(story: UserStory): number {
  return (
    (story.current_unresolved_pct / 100) *
    story.affected_sessions *
    Math.max(story.current_avg_frustration, 0.1)
  );
}

function openCopilotWithIntent(intent: string) {
  const readable = intent.replace(/_/g, " ");
  window.dispatchEvent(
    new CustomEvent("conversaai-open-copilot", {
      detail: {
        message: `Analiza el flujo "${readable}": IRR, ejemplos de conversaciones frustradas y 2 acciones P1 concretas.`,
      },
    })
  );
}

// ─── Single Story Card ────────────────────────────────────────────────────────

async function patchStoryStatus(id: number, status: string) {
  await fetch(`/api/stories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

function StoryCard({
  story,
  onStatusChange,
}: {
  story: UserStory;
  onStatusChange: (id: number, status: UserStory["status"]) => void;
}) {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [saving, setSaving] = useState(false);

  const priorityConfig = {
    P1: {
      label: "P1 — Crítico",
      bg: isDark ? "rgba(255,92,92,0.12)" : "rgba(255,107,107,0.13)",
      color: colors.error,
      border: `1px solid ${colors.error}30`,
      icon: "🔴",
    },
    P2: {
      label: "P2 — Alto",
      bg: isDark ? "rgba(245,166,35,0.12)" : "rgba(245,166,35,0.13)",
      color: colors.warning,
      border: `1px solid ${colors.warning}30`,
      icon: "🟡",
    },
    P3: {
      label: "P3 — Medio",
      bg: isDark ? "rgba(107,147,168,0.08)" : "rgba(107,147,168,0.1)",
      color: colors.textSecondary,
      border: `1px solid ${colors.textMuted}30`,
      icon: "🔵",
    },
  };

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    backlog: { icon: <Clock size={12} />, label: "Backlog", color: colors.textMuted },
    in_progress: { icon: <Clock size={12} />, label: "En progreso", color: colors.warning },
    done: { icon: <CheckCircle2 size={12} />, label: "Completado", color: colors.success },
    dismissed: { icon: <XCircle size={12} />, label: "Descartado", color: colors.textMuted },
  };

  const config = priorityConfig[story.priority];
  const statusCfg = statusConfig[story.status] || statusConfig.backlog;
  const readableIntent = story.intent.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <>
      <div
        id={`story-${story.intent}`}
        style={{
          backgroundColor: config.bg,
          border: config.border,
          borderRadius: 12,
          padding: 16,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: config.color,
                  backgroundColor: `${config.color}20`,
                  padding: "2px 8px",
                  borderRadius: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {config.label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: statusCfg.color,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {statusCfg.icon} {statusCfg.label}
              </span>
            </div>
            <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {config.icon} {story.title}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
              {story.user_story}
            </div>
          </div>
          <div style={{ color: colors.textMuted, marginLeft: 8, flexShrink: 0 }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 11 }}>
            <span style={{ color: colors.textMuted }}>Sesiones: </span>
            <span style={{ color: colors.textPrimary, fontWeight: 600 }}>
              {story.affected_sessions}
            </span>
          </div>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: colors.textMuted }}>Sin resolver: </span>
            <span style={{ color: colors.error, fontWeight: 600 }}>
              {story.current_unresolved_pct}%
            </span>
          </div>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: colors.textMuted }}>Frustración: </span>
            <span style={{ color: colors.warning, fontWeight: 600 }}>
              {story.current_avg_frustration.toFixed(2)}
            </span>
          </div>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: colors.textMuted }}>Impacto: </span>
            <span style={{ color: colors.accent, fontWeight: 600 }}>
              {storyImpactScore(story).toFixed(1)}
            </span>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: `1px solid ${colors.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Acceptance Criteria */}
            <div>
              <div
                style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Criterios de Aceptación
              </div>
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 1.5,
                  backgroundColor: colors.background,
                  padding: 10,
                  borderRadius: 6,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {story.acceptance_criteria}
              </div>
            </div>

            {/* Success Metric */}
            <div>
              <div
                style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Métrica de Éxito
              </div>
              <div style={{ color: colors.accent, fontSize: 12, lineHeight: 1.5 }}>
                {story.success_metric}
              </div>
            </div>

            {/* Status change buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              {(
                [
                  { s: "backlog" as const, label: "📋 Backlog", color: colors.textMuted },
                  { s: "in_progress" as const, label: "🔄 En progreso", color: colors.warning },
                  { s: "done" as const, label: "✅ Resuelto", color: colors.success },
                  { s: "dismissed" as const, label: "🚫 Descartar", color: colors.error },
                ] as { s: UserStory["status"]; label: string; color: string }[]
              ).map(({ s, label, color }) => (
                <button
                  key={s}
                  type="button"
                  disabled={saving || story.status === s}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSaving(true);
                    onStatusChange(story.id, s);
                    await patchStoryStatus(story.id, s);
                    setSaving(false);
                  }}
                  style={{
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: story.status === s ? `1px solid ${color}` : `1px solid ${colors.border}`,
                    backgroundColor: story.status === s ? `${color}20` : "transparent",
                    color: story.status === s ? color : colors.textMuted,
                    cursor: story.status === s ? "default" : "pointer",
                    fontWeight: story.status === s ? 600 : 400,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVoice(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: colors.accent,
                  backgroundColor: `${colors.accent}15`,
                  border: `1px solid ${colors.accent}30`,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <MessageSquareWarning size={14} />
                Ver quejas reales
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openCopilotWithIntent(story.intent);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: colors.textPrimary,
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={14} style={{ color: colors.accent }} />
                Preguntar al copiloto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Voice of Customer Modal */}
      {showVoice && (
        <VoiceOfCustomerModal intent={story.intent} onClose={() => setShowVoice(false)} />
      )}
    </>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  title,
  color,
  stories,
  onStatusChange,
  emptyLabel,
}: {
  title: string;
  color: string;
  stories: UserStory[];
  onStatusChange: (id: number, status: UserStory["status"]) => void;
  emptyLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: colors.background,
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
        <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>{title}</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: colors.textMuted,
            backgroundColor: `${color}20`,
            padding: "1px 7px",
            borderRadius: 10,
            fontWeight: 600,
          }}
        >
          {stories.length}
        </span>
      </div>
      {stories.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
          {emptyLabel}
        </div>
      ) : (
        stories.map((s) => (
          <StoryCard key={s.story_id} story={s} onStatusChange={onStatusChange} />
        ))
      )}
    </div>
  );
}

// ─── Action Hub (Main Component) ──────────────────────────────────────────────

export function ActionHub({ stories: initialStories }: { stories: UserStory[] }) {
  const { colors } = useTheme();
  const [stories, setStories] = useState<UserStory[]>(initialStories);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const handleStatusChange = (id: number, status: UserStory["status"]) => {
    setStories((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  useEffect(() => {
    const highlight = (hash: string) => {
      const el = document.getElementById(hash.replace("#", ""));
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "outline 0.2s";
      el.style.outline = `2px solid #10b981`;
      el.style.outlineOffset = "3px";
      el.style.borderRadius = "12px";
      setTimeout(() => { el.style.outline = "none"; }, 2500);
    };
    if (window.location.hash) highlight(window.location.hash);
    const handler = () => highlight(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const sorted = [...stories].sort((a, b) => storyImpactScore(b) - storyImpactScore(a));
  const backlog = sorted.filter((s) => s.status === "backlog");
  const inProgress = sorted.filter((s) => s.status === "in_progress");
  const done = sorted.filter((s) => s.status === "done" || s.status === "dismissed");

  return (
    <div
      id="action-hub"
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              color: colors.textMuted,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            HISTORIAS DE USUARIO GENERADAS POR IA
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 12 }}>
            {stories.length} tareas · {inProgress.length} en progreso · {done.length} cerradas
          </div>
        </div>
        {/* View toggle */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["kanban", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 6,
                border: view === v ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                backgroundColor: view === v ? `${colors.accent}15` : "transparent",
                color: view === v ? colors.accent : colors.textMuted,
                cursor: "pointer",
                fontWeight: view === v ? 600 : 400,
              }}
            >
              {v === "kanban" ? "⬛ Kanban" : "☰ Lista"}
            </button>
          ))}
        </div>
      </div>

      {stories.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 32 }}>
          No hay user stories disponibles. Ejecuta el pipeline de análisis para generarlas.
        </div>
      ) : view === "kanban" ? (
        /* ── Kanban board ── */
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", overflowX: "auto" }}>
          <KanbanColumn
            title="Backlog"
            color={colors.textMuted}
            stories={backlog}
            onStatusChange={handleStatusChange}
            emptyLabel="Sin tareas pendientes"
          />
          <KanbanColumn
            title="En progreso"
            color={colors.warning}
            stories={inProgress}
            onStatusChange={handleStatusChange}
            emptyLabel="Arrastrá una tarea aquí"
          />
          <KanbanColumn
            title="Cerradas"
            color={colors.success}
            stories={done}
            onStatusChange={handleStatusChange}
            emptyLabel="Ninguna tarea cerrada aún"
          />
        </div>
      ) : (
        /* ── List view ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((story) => (
            <StoryCard key={story.story_id} story={story} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
