"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Zap,
  AlertTriangle,
  Target,
  TrendingUp,
  User,
  Trash2,
  CheckCircle2,
  Loader2,
  Kanban,
  Sparkles,
} from "lucide-react";
import { ActionHub } from "./action-hub";
import type { UserStory } from "../lib/api";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { useTheme } from "../context/theme-context";
import {
  buildSeedItems,
  dispatchAccionesUpdate,
} from "../lib/action-seeds";
import type { ActionItem, Severity, Status } from "../lib/action-seeds";
import { JiraExportModal, SlackNotifyModal } from "./ui/integracion-modal";
import { ValidadorImpacto } from "./validador-impacto";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "detected", label: "Detectado", color: "#6366f1" },
  { id: "analyzing", label: "Analizando", color: "#f59e0b" },
  { id: "in_progress", label: "En desarrollo", color: "#3b82f6" },
  { id: "resolved", label: "Resuelto", color: "#22c55e" },
];

const SEV_COLOR: Record<Severity, { bg: string; text: string; label: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", text: "#f87171", label: "Crítico" },
  high: { bg: "rgba(245,158,11,0.15)", text: "#fbbf24", label: "Alto" },
  medium: { bg: "rgba(99,102,241,0.15)", text: "#818cf8", label: "Medio" },
  low: { bg: "rgba(161,161,170,0.12)", text: "#a1a1aa", label: "Bajo" },
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEV_COLOR[severity];
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 4,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  );
}

function ImpactBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#6366f1";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 10, color: "#a1a1aa", minWidth: 24, textAlign: "right" }}>{pct}</span>
    </div>
  );
}

// ─── Card Component ───────────────────────────────────────────────────────────

const PREDEFINED_TEAMS = [
  "Diseño Conversacional / Bot UX",
  "Ingeniería Frontend / UX",
  "Ingeniería Backend / API",
  "Finanzas y Facturación",
  "Operaciones de Soporte (L2)",
];

function ActionCard({
  item,
  index,
  onDelete,
  onUpdate,
  onArchive,
  onEdit,
}: {
  item: ActionItem;
  index: number;
  onDelete: (id: string) => void;
  onUpdate: (id: string, changes: Partial<ActionItem>) => void;
  onArchive?: (id: string) => void;
  onEdit: (item: ActionItem) => void;
}) {
  const { colors } = useTheme();
  const [editAssignee, setEditAssignee] = useState(false);
  const [assigneeValue, setAssigneeValue] = useState(item.assignee ?? "");
  const [isCustomAssignee, setIsCustomAssignee] = useState(false);

  useEffect(() => {
    setAssigneeValue(item.assignee ?? "");
  }, [item.assignee]);

  const sourceIcon =
    item.source_type === "intent" ? <Target size={10} /> :
    item.source_type === "flow" ? <TrendingUp size={10} /> :
    <Zap size={10} />;

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(item)}
          style={{
            ...provided.draggableProps.style,
            backgroundColor: snapshot.isDragging
              ? "rgba(99,102,241,0.15)"
              : "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${snapshot.isDragging ? "rgba(99,102,241,0.5)" : colors.border}`,
            borderRadius: 10,
            padding: 12,
            marginBottom: 8,
            cursor: "pointer",
            boxShadow: snapshot.isDragging
              ? "0 8px 24px rgba(0,0,0,0.5)"
              : "0 1px 3px rgba(0,0,0,0.3)",
            transition: snapshot.isDragging ? "none" : "box-shadow 0.15s",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
            <span style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
              {item.title}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, padding: 2, flexShrink: 0 }}
            >
              <Trash2 size={11} />
            </button>
          </div>

          {/* Description */}
          {item.description && (
            <p style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.5, margin: "0 0 8px" }}>
              {item.description.length > 90 ? item.description.slice(0, 90) + "…" : item.description}
            </p>
          )}

          {/* Impact bar */}
          <div style={{ marginBottom: 8 }}>
            <ImpactBar score={item.impact_score} />
          </div>

          {/* Footer row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <SeverityBadge severity={item.severity} />
              {item.source_id && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, color: colors.textMuted, fontSize: 10 }}>
                  {sourceIcon} {item.source_id}
                </span>
              )}
            </div>

            {editAssignee ? (
              isCustomAssignee ? (
                <input
                  autoFocus
                  value={assigneeValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setAssigneeValue(e.target.value)}
                  onBlur={() => {
                    setIsCustomAssignee(false);
                    setEditAssignee(false);
                    onUpdate(item.id, { assignee: assigneeValue || null });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setIsCustomAssignee(false);
                      setEditAssignee(false);
                      onUpdate(item.id, { assignee: assigneeValue || null });
                    }
                  }}
                  placeholder="Equipo..."
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 4,
                    color: colors.textPrimary,
                    fontSize: 10,
                    padding: "2px 6px",
                    width: 90,
                    outline: "none",
                  }}
                />
              ) : (
                <select
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  value={PREDEFINED_TEAMS.includes(assigneeValue) ? assigneeValue : assigneeValue ? "custom" : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "custom") {
                      setIsCustomAssignee(true);
                    } else if (val === "cancel") {
                      setEditAssignee(false);
                    } else {
                      setAssigneeValue(val);
                      onUpdate(item.id, { assignee: val || null });
                      setEditAssignee(false);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      if (!isCustomAssignee) {
                        setEditAssignee(false);
                      }
                    }, 150);
                  }}
                  style={{
                    background: "#131316",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 4,
                    color: colors.textPrimary,
                    fontSize: 10,
                    padding: "2px 6px",
                    width: 100,
                    outline: "none",
                  }}
                >
                  <option value="" disabled>Seleccionar...</option>
                  {PREDEFINED_TEAMS.map((team) => (
                    <option key={team} value={team} style={{ background: "#131316" }}>
                      {team.length > 15 ? team.slice(0, 15) + "..." : team}
                    </option>
                  ))}
                  <option value="custom" style={{ background: "#131316" }}>Personalizado...</option>
                  <option value="cancel" style={{ background: "#131316" }}>✕ Cancelar</option>
                </select>
              )
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {item.status === "resolved" && onArchive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(item.id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.25)",
                      borderRadius: 4,
                      color: "#22c55e",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 6px",
                      cursor: "pointer",
                    }}
                  >
                    <CheckCircle2 size={10} /> Archivar
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditAssignee(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: item.assignee ? colors.textSecondary : colors.textMuted,
                    fontSize: 10,
                    padding: 0,
                  }}
                >
                  <User size={10} />
                  {item.assignee ?? "Asignar"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Column Component ─────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  items,
  onDelete,
  onUpdate,
  onArchive,
  onEdit,
}: {
  col: (typeof COLUMNS)[number];
  items: ActionItem[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, changes: Partial<ActionItem>) => void;
  onArchive?: (id: string) => void;
  onEdit: (item: ActionItem) => void;
}) {
  const { colors } = useTheme();

  return (
    <div style={{ flex: 1, minWidth: 220, maxWidth: 320, display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Column header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          marginBottom: 8,
          borderRadius: 8,
          background: `${col.color}10`,
          border: `1px solid ${col.color}25`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
          <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>{col.label}</span>
        </div>
        <span
          style={{
            background: `${col.color}20`,
            color: col.color,
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 7px",
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flex: 1,
              minHeight: 120,
              padding: "4px 0",
              borderRadius: 8,
              background: snapshot.isDraggingOver ? `${col.color}08` : "transparent",
              transition: "background 0.15s",
            }}
          >
            {items.map((item, index) => (
              <ActionCard
                key={item.id}
                item={item}
                index={index}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onArchive={onArchive}
                onEdit={onEdit}
              />
            ))}
            {provided.placeholder}
            {items.length === 0 && !snapshot.isDraggingOver && (
              <div
                style={{
                  height: 80,
                  border: `1px dashed ${colors.border}`,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                  fontSize: 11,
                }}
              >
                Sin tarjetas
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─── New Card Modal ───────────────────────────────────────────────────────────

function NewCardModal({ onClose, onCreate }: { onClose: () => void; onCreate: (item: Partial<ActionItem>) => void }) {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#131316",
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          padding: 24,
          width: 420,
          maxWidth: "90vw",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>Nueva tarjeta</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Título *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Mejorar flujo de onboarding"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                borderRadius: 7,
                color: colors.textPrimary,
                fontSize: 13,
                padding: "8px 10px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Contexto del problema…"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                borderRadius: 7,
                color: colors.textPrimary,
                fontSize: 12,
                padding: "8px 10px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Severidad</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    borderRadius: 6,
                    border: `1px solid ${severity === s ? SEV_COLOR[s].text : colors.border}`,
                    background: severity === s ? SEV_COLOR[s].bg : "transparent",
                    color: severity === s ? SEV_COLOR[s].text : colors.textMuted,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {SEV_COLOR[s].label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              if (!title.trim()) return;
              onCreate({ title: title.trim(), description, severity, source_type: "manual", status: "detected", is_suggestion: false, impact_score: 0 });
              onClose();
            }}
            style={{
              marginTop: 4,
              padding: "9px 0",
              borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            Crear tarjeta
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Card Modal ───────────────────────────────────────────────────────────

function EditCardModal({
  item,
  onClose,
  onUpdate,
}: {
  item: ActionItem;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<ActionItem>) => void;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [severity, setSeverity] = useState<Severity>(item.severity);
  const [assignee, setAssignee] = useState(item.assignee ?? "");
  const [isCustomAssignee, setIsCustomAssignee] = useState(false);
  const [customAssigneeVal, setCustomAssigneeVal] = useState("");

  const [showJira, setShowJira] = useState(false);
  const [showSlack, setShowSlack] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#131316",
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          padding: 24,
          width: 500,
          maxWidth: "90vw",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>Editar Tarjeta</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Mejorar flujo de onboarding"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                borderRadius: 7,
                color: colors.textPrimary,
                fontSize: 13,
                padding: "8px 10px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Descripción / Problema Detectado</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Contexto del problema…"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                borderRadius: 7,
                color: colors.textPrimary,
                fontSize: 12,
                padding: "8px 10px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Solución Propuesta</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Escribe la solución propuesta para que el equipo receptor la resuelva..."
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                borderRadius: 7,
                color: colors.textPrimary,
                fontSize: 12,
                padding: "8px 10px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Equipo Responsable</label>
              {isCustomAssignee ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    value={customAssigneeVal}
                    onChange={(e) => setCustomAssigneeVal(e.target.value)}
                    placeholder="Nombre del equipo..."
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${colors.border}`,
                      borderRadius: 7,
                      color: colors.textPrimary,
                      fontSize: 12,
                      padding: "6px 8px",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customAssigneeVal.trim()) {
                        setAssignee(customAssigneeVal.trim());
                      }
                      setIsCustomAssignee(false);
                    }}
                    style={{
                      background: colors.accent,
                      border: "none",
                      color: "#fff",
                      borderRadius: 6,
                      fontSize: 11,
                      padding: "0 8px",
                      cursor: "pointer",
                    }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <select
                  value={PREDEFINED_TEAMS.includes(assignee) ? assignee : assignee ? "custom" : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "custom") {
                      setIsCustomAssignee(true);
                      setCustomAssigneeVal("");
                    } else {
                      setAssignee(val);
                    }
                  }}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 7,
                    color: colors.textPrimary,
                    fontSize: 12,
                    padding: "7px 8px",
                    outline: "none",
                  }}
                >
                  <option value="">Sin Asignar</option>
                  {PREDEFINED_TEAMS.map((t) => (
                    <option key={t} value={t} style={{ background: "#131316" }}>{t}</option>
                  ))}
                  <option value="custom" style={{ background: "#131316" }}>Personalizado...</option>
                </select>
              )}
            </div>

            <div>
              <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 5 }}>Severidad</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 7,
                  color: colors.textPrimary,
                  fontSize: 12,
                  padding: "7px 8px",
                  outline: "none",
                }}
              >
                {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
                  <option key={s} value={s} style={{ background: "#131316" }}>{SEV_COLOR[s].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Integrations Section */}
          <div style={{ marginTop: 8, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
            <label style={{ color: colors.textMuted, fontSize: 11, display: "block", marginBottom: 6 }}>Exportación e Integraciones</label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowJira(true)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 0",
                  borderRadius: 8,
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  color: "#818cf8",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <Zap size={14} /> Exportar a Jira
              </button>
              <button
                type="button"
                onClick={() => setShowSlack(true)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 0",
                  borderRadius: 8,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  color: "#22c55e",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={14} /> Notificar por Slack
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "transparent",
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!title.trim()) return;
                onUpdate(item.id, {
                  title: title.trim(),
                  description: description.trim(),
                  notes: notes.trim() || null,
                  severity,
                  assignee: assignee.trim() || null,
                });
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 12.5,
                border: "none",
                cursor: "pointer",
                opacity: title.trim() ? 1 : 0.5,
              }}
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      {/* Integration overlays */}
      {showJira && (
        <JiraExportModal
          item={{
            ...item,
            title,
            description,
            notes,
            severity,
            assignee: assignee || null,
          }}
          onClose={() => setShowJira(false)}
        />
      )}

      {showSlack && (
        <SlackNotifyModal
          item={{
            ...item,
            title,
            description,
            notes,
            severity,
            assignee: assignee || null,
          }}
          onClose={() => setShowSlack(false)}
        />
      )}
    </div>
  );
}

// ─── Suggestions Panel ────────────────────────────────────────────────────────

function SuggestionsPanel({
  items,
  onAccept,
  onDismiss,
}: {
  items: ActionItem[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        width: collapsed ? 40 : 280,
        flexShrink: 0,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "width 0.2s ease",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: collapsed ? "12px 8px" : "12px 14px",
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} style={{ color: "#f59e0b" }} />
            <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>Sugerencias</span>
            <span style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8 }}>
              {items.length}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, padding: 2 }}
        >
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Items */}
      {!collapsed && (
        <div style={{ overflowY: "auto", flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div style={{ color: colors.textPrimary, fontSize: 11.5, fontWeight: 500, marginBottom: 4 }}>{item.title}</div>
              <SeverityBadge severity={item.severity} />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  onClick={() => onAccept(item.id)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "4px 0",
                    borderRadius: 5,
                    background: "rgba(99,102,241,0.15)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    color: "#818cf8",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <CheckCircle2 size={10} /> Aceptar
                </button>
                <button
                  onClick={() => onDismiss(item.id)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 5,
                    background: "transparent",
                    border: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AccionesPage() {
  const { colors } = useTheme();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [usingSeed, setUsingSeed] = useState(false);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [showStories, setShowStories] = useState(false);
  const [showArchivedHistory, setShowArchivedHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      const [actionsRes, storiesRes] = await Promise.all([
        fetch("/api/actions"),
        fetch("/api/stories"),
      ]);
      if (storiesRes.ok) {
        const sData = await storiesRes.json();
        setUserStories(Array.isArray(sData) ? sData : []);
      }
      if (!actionsRes.ok) throw new Error("API error");
      const data: ActionItem[] = await actionsRes.json();
      if (data.length === 0) {
        setUsingSeed(true);
        setItems(buildSeedItems());
      } else {
        setUsingSeed(false);
        setItems(data.map((item) => ({ ...item, id: String(item.id) })));
      }
    } catch {
      setUsingSeed(true);
      setItems(buildSeedItems());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    dispatchAccionesUpdate(items.filter((i) => !i.is_suggestion));
  }, [items]);

  const isArchived = (item: ActionItem) => item.notes?.startsWith("[ARCHIVED]") || false;

  const boardItems = items.filter((i) => !i.is_suggestion && !isArchived(i));
  const archivedItems = items.filter((i) => !i.is_suggestion && isArchived(i));
  const suggestions = items.filter((i) => i.is_suggestion);

  const itemsByStatus = (status: Status) => boardItems.filter((i) => i.status === status);

  const handleArchive = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const currentNotes = item.notes || "";
    const updatedNotes = currentNotes.startsWith("[ARCHIVED]")
      ? currentNotes
      : `[ARCHIVED] ${currentNotes}`.trim();
    await handleUpdate(id, { notes: updatedNotes });
  };

  const handleUnarchive = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const currentNotes = item.notes || "";
    const updatedNotes = currentNotes.replace(/^\[ARCHIVED\]\s*/, "");
    await handleUpdate(id, { notes: updatedNotes || null });
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as Status;

    setItems((prev) =>
      prev.map((item) =>
        item.id === draggableId ? { ...item, status: newStatus } : item
      )
    );

    if (!usingSeed) {
      await fetch(`/api/actions/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (!usingSeed) {
      await fetch(`/api/actions/${id}`, { method: "DELETE" });
    }
  };

  const handleUpdate = async (id: string, changes: Partial<ActionItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
    if (!usingSeed) {
      await fetch(`/api/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
    }
  };

  const handleCreate = async (newItem: Partial<ActionItem>) => {
    if (usingSeed) {
      const fakeItem: ActionItem = {
        id: `seed-${Date.now()}`,
        title: newItem.title ?? "",
        description: newItem.description ?? "",
        source_type: "manual",
        source_id: null,
        severity: newItem.severity ?? "medium",
        impact_score: 0,
        status: "detected",
        assignee: null,
        notes: null,
        is_suggestion: false,
        corpus_run_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setItems((prev) => [...prev, fakeItem]);
      return;
    }
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    if (res.ok) {
      const created: ActionItem = await res.json();
      setItems((prev) => [...prev, { ...created, id: String(created.id) }]);
    }
  };

  const handleAcceptSuggestion = async (id: string) => {
    await handleUpdate(id, { is_suggestion: false, status: "detected" });
  };

  const handleDismissSuggestion = async (id: string) => {
    await handleDelete(id);
  };

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Acciones" />}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(99,102,241,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Kanban size={16} style={{ color: "#818cf8" }} />
          </div>
          <div>
            <h1 style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 600, margin: 0 }}>Plan de acción</h1>
            <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>
              {usingSeed ? "Datos de ejemplo — corrí el Analyst para ver problemas reales" : `${boardItems.length} tarjetas activas`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
          }}
        >
          <Plus size={14} />
          Nueva tarjeta
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: colors.textMuted }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
          Cargando…
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minHeight: 0 }}>
          {/* Kanban board */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <DragDropContext onDragEnd={handleDragEnd}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    col={col}
                    items={itemsByStatus(col.id)}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onArchive={handleArchive}
                    onEdit={setEditingItem}
                  />
                ))}
              </div>
            </DragDropContext>
          </div>

          {/* Suggestions panel */}
          <SuggestionsPanel
            items={suggestions}
            onAccept={handleAcceptSuggestion}
            onDismiss={handleDismissSuggestion}
          />
        </div>
      )}

      {/* User Stories section (AI-generated from Analyst) */}
      {userStories.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowStories(!showStories)}
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
              <Sparkles size={14} style={{ color: "#818cf8" }} />
              <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>
                Historias de usuario generadas por IA
              </span>
              <span style={{
                background: "rgba(99,102,241,0.15)",
                color: "#818cf8",
                fontSize: 10,
                fontWeight: 600,
                padding: "1px 7px",
                borderRadius: 8,
              }}>
                {userStories.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: colors.textMuted,
                marginLeft: "auto",
                transform: showStories ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
          {showStories && <ActionHub stories={userStories} />}
        </div>
      )}

      {/* Validación de Impacto */}
      <div style={{ marginTop: 24 }}>
        <ValidadorImpacto />
      </div>

      {/* Historial de acciones archivadas / resueltas */}
      <div style={{ marginTop: 24, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
        <button
          onClick={() => setShowArchivedHistory(!showArchivedHistory)}
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
              Historial de acciones archivadas / resueltas
            </span>
            <span style={{
              background: "rgba(34,197,94,0.15)",
              color: "#22c55e",
              fontSize: 10,
              fontWeight: 600,
              padding: "1px 7px",
              borderRadius: 8,
            }}>
              {archivedItems.length}
            </span>
          </div>
          <ChevronDown
            size={14}
            style={{
              color: colors.textMuted,
              marginLeft: "auto",
              transform: showArchivedHistory ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {showArchivedHistory && (
          <div>
            {archivedItems.length === 0 ? (
              <div style={{
                color: colors.textMuted,
                fontSize: 12.5,
                padding: "20px 0",
                textAlign: "center",
                border: `1px dashed ${colors.border}`,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.01)"
              }}>
                No hay acciones archivadas aún. Mueve una tarjeta a "Resuelto" y haz clic en "Archivar".
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {archivedItems.map((item) => {
                  const displayNotes = item.notes?.replace(/^\[ARCHIVED\]\s*/, "") || "";
                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.03)",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>
                            {item.title}
                          </span>
                          <span style={{
                            backgroundColor: "rgba(34,197,94,0.15)",
                            color: "#22c55e",
                            fontSize: 9.5,
                            fontWeight: 600,
                            padding: "1px 5px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                          }}>
                            Resuelto
                          </span>
                        </div>
                        <p style={{ color: colors.textMuted, fontSize: 11.5, margin: "0 0 6px" }}>
                          {item.description}
                        </p>
                        {displayNotes && (
                          <div style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            backgroundColor: "rgba(255,255,255,0.02)",
                            padding: "4px 8px",
                            borderRadius: 4,
                            borderLeft: `2px solid ${colors.accent}`,
                            display: "inline-block",
                          }}>
                            <strong>Nota de resolución:</strong> {displayNotes}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => handleUnarchive(item.id)}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: colors.accent,
                            backgroundColor: "transparent",
                            border: `1px solid ${colors.accent}40`,
                            borderRadius: 6,
                            padding: "4px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Desarchivar
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "none",
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            color: colors.textMuted,
                            padding: 5,
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showNewModal && (
        <NewCardModal onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
      )}

      {editingItem && (
        <EditCardModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdate={async (id, changes) => {
            await handleUpdate(id, changes);
            setEditingItem(null);
          }}
        />
      )}
    </DashboardShell>
  );
}
