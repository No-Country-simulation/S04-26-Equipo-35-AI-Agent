"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Copy, Check, Send, Loader2 } from "lucide-react";
import { useTheme } from "../../context/theme-context";
import type { ActionItem } from "../../lib/action-seeds";

/* ────────────────────────────────────────────────────────
   Shared overlay + modal styling helpers
   ──────────────────────────────────────────────────────── */

function overlayStyle(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };
}

function modalBoxStyle(borderColor: string): React.CSSProperties {
  return {
    background: "#131316",
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    padding: 24,
    maxWidth: 560,
    width: "92vw",
    position: "relative",
    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  };
}

function btnBase(bg: string, hoverBg?: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: bg,
    color: "#fff",
    transition: "background 0.2s",
  };
}

const severityEmoji: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

/* ────────────────────────────────────────────────────────
   JiraExportModal
   ──────────────────────────────────────────────────────── */

export function JiraExportModal({
  item,
  onClose,
}: {
  item: ActionItem;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ticketResult, setTicketResult] = useState<{ ticket_id: string; url: string } | null>(null);

  const jiraDescription = [
    "h2. Problema Detectado",
    item.description,
    "",
    "h2. Severidad",
    `${item.severity} — Impacto: ${item.impact_score}`,
    "",
    "h2. Equipo Asignado",
    item.assignee || "Sin asignar",
    "",
    "h2. Solución Propuesta",
    item.notes || "Pendiente de definir",
  ].join("\n");

  const markdown = [
    `**Proyecto:** CONV`,
    `**Tipo:** Story`,
    `**Título:** ${item.title}`,
    "",
    "---",
    "",
    jiraDescription,
  ].join("\n");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API may be blocked */
    }
  }, [markdown]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/integrations/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionItemId: item.id,
          title: item.title,
          description: item.description,
          severity: item.severity,
          assignee: item.assignee,
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTicketResult({ ticket_id: data.ticket_id, url: data.url });
      } else {
        alert("Error al conectar con el servidor MCP de Jira");
      }
    } catch (err) {
      alert("Error al conectar con el servidor MCP de Jira");
    } finally {
      setExporting(false);
    }
  }, [item]);

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: colors.textMuted,
    marginBottom: 4,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 14,
  };

  return (
    <div style={overlayStyle()} onClick={onClose}>
      <div
        style={modalBoxStyle(colors.border)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: colors.textPrimary,
            }}
          >
            Exportar a Jira
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: colors.textMuted,
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {ticketResult ? (
          <div style={{ marginBottom: 20, padding: 12, background: "rgba(34,197,94,0.1)", border: `1px solid ${colors.success}`, borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: colors.success, fontWeight: 600, display: "block", marginBottom: 4 }}>
              ✓ Ticket creado exitosamente en Jira (MCP)
            </span>
            <a href={ticketResult.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: colors.accent, textDecoration: "underline", fontWeight: 600 }}>
              Ver Ticket: {ticketResult.ticket_id}
            </a>
          </div>
        ) : null}

        {/* Ticket fields */}
        <div style={labelStyle}>Proyecto</div>
        <div style={valueStyle}>CONV</div>

        <div style={labelStyle}>Tipo de Issue</div>
        <div style={valueStyle}>Story</div>

        <div style={labelStyle}>Título</div>
        <div style={valueStyle}>{item.title}</div>

        {/* Description preview */}
        <div style={labelStyle}>Descripción</div>
        <pre
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: 14,
            fontSize: 12,
            lineHeight: 1.6,
            color: colors.textSecondary,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
            marginBottom: 20,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {jiraDescription}
        </pre>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              ...btnBase("transparent"),
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
            }}
          >
            Cerrar
          </button>

          <button
            onClick={handleCopy}
            style={{
              ...btnBase(copied ? colors.success : colors.accent),
            }}
          >
            {copied ? (
              <>
                <Check size={14} /> ✓ Copiado!
              </>
            ) : (
              <>
                <Copy size={14} /> Copiar Markdown
              </>
            )}
          </button>

          {!ticketResult && (
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                ...btnBase(exporting ? colors.accent : colors.success),
                opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? (
                <>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Creando...
                </>
              ) : (
                <>
                  <Send size={14} /> Exportar vía MCP
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   SlackNotifyModal
   ──────────────────────────────────────────────────────── */

export function SlackNotifyModal({
  item,
  onClose,
}: {
  item: ActionItem;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  type Phase = "preview" | "sending" | "sent";
  const [phase, setPhase] = useState<Phase>("preview");
  const [resultMsg, setResultMsg] = useState("");

  const emoji = severityEmoji[item.severity] || "⚪";

  const slackMessage = [
    "🚨 *Nueva acción de producto — ConversaAI*",
    "",
    `*${item.title}*`,
    `Severidad: ${emoji} ${item.severity}`,
    `Impacto: ${item.impact_score}/1.0`,
    `Asignado a: ${item.assignee || "Sin asignar"}`,
    "",
    `> ${item.description}`,
    "",
    `Canal: #cx-alerts-producto`,
  ].join("\n");

  const handleSend = useCallback(async () => {
    setPhase("sending");
    try {
      const res = await fetch("/api/integrations/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "#cx-alerts-producto",
          message: slackMessage
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPhase("sent");
        setResultMsg(data.message || "Mensaje enviado con éxito al canal #cx-alerts-producto.");
      } else {
        setPhase("preview");
        alert("Error al enviar mensaje vía Slack MCP");
      }
    } catch {
      setPhase("preview");
      alert("Error de red al conectar con Slack MCP");
    }
  }, [slackMessage]);

  // Auto-close after success
  useEffect(() => {
    if (phase === "sent") {
      const timer = setTimeout(onClose, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, onClose]);

  return (
    <div style={overlayStyle()} onClick={onClose}>
      <div
        style={modalBoxStyle(colors.border)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: colors.textPrimary,
            }}
          >
            Notificación Slack
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: colors.textMuted,
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Slack-style message bubble */}
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderLeft: `3px solid ${colors.success}`,
            borderRadius: "0 8px 8px 0",
            padding: 16,
            marginBottom: 20,
            whiteSpace: "pre-wrap",
            fontSize: 13,
            lineHeight: 1.7,
            color: colors.textSecondary,
            wordBreak: "break-word",
          }}
        >
          {slackMessage}
        </div>

        {/* Status / Actions */}
        {phase === "sent" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: colors.success,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Check size={16} />
            {resultMsg}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              disabled={phase === "sending"}
              style={{
                ...btnBase("transparent"),
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                opacity: phase === "sending" ? 0.5 : 1,
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleSend}
              disabled={phase === "sending"}
              style={{
                ...btnBase(phase === "sending" ? colors.accent : colors.success),
                opacity: phase === "sending" ? 0.8 : 1,
              }}
            >
              {phase === "sending" ? (
                <>
                  <Loader2
                    size={14}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  Enviando…
                </>
              ) : (
                <>
                  <Send size={14} /> Enviar vía MCP
                </>
              )}
            </button>
          </div>
        )}

        {/* Spinner keyframes (injected inline for portability) */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
