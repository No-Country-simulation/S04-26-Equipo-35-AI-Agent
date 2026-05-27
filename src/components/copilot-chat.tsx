"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "@src/context/theme-context";
import {
  extractSessionIds,
  renderCopilotMarkdown,
} from "@src/lib/copilot-format";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  ChevronDown,
} from "lucide-react";

function getMessageText(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

const SUGGESTED_PROMPTS = [
  "¿Cuáles son los 3 puntos de fricción más urgentes este mes?",
  "Mostráme clientes frustrados con reembolsos",
  "¿Qué solicitud tiene peor resolución y por qué?",
  "¿Qué fricción impacta más a los clientes ahora?",
];

function SessionEvidenceChips({
  sessionIds,
  accent,
  borderColor,
  isDark,
}: {
  sessionIds: string[];
  accent: string;
  borderColor: string;
  isDark: boolean;
}) {
  if (sessionIds.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 8,
      }}
      aria-label="Sesiones citadas (clic para copiar)"
    >
      {sessionIds.map((id) => (
        <button
          key={id}
          type="button"
          title={`Copiar session_id: ${id}`}
          onClick={() => void navigator.clipboard?.writeText(id)}
          className="copilot-chip"
          style={{
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            padding: "3px 8px",
            borderRadius: 6,
            border: `1px solid ${borderColor}`,
            background: isDark
              ? "rgba(0,196,154,0.08)"
              : "rgba(0,168,130,0.06)",
            color: accent,
            cursor: "pointer",
          }}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

export function CopilotChat() {
  const { colors, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "streaming" || status === "submitted";

  const closePanel = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setIsOpen(true);
      const msg = detail?.message;
      if (msg) {
        setTimeout(() => sendMessage({ text: msg }), 300);
      }
    };
    window.addEventListener("conversaai-open-copilot", handler);
    return () => window.removeEventListener("conversaai-open-copilot", handler);
  }, [sendMessage]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closePanel]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(prompt: string) {
    setInput("");
    sendMessage({ text: prompt });
  }

  const panelBg = isDark ? colors.navbar : "rgba(255, 255, 255, 0.98)";
  const bubbleBg = isDark ? colors.card : "#F0F4F8";
  const userBubbleBg = isDark
    ? "linear-gradient(135deg, #00C49A 0%, #009E7A 100%)"
    : "linear-gradient(135deg, #00A882 0%, #007A5E 100%)";
  const borderColor = isDark ? colors.border : "rgba(226, 232, 240, 0.9)";
  const inputBg = isDark ? colors.card : "#FFFFFF";

  if (!isOpen) {
    return (
      <button
        id="copilot-fab"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir Copiloto Analítico"
        aria-haspopup="dialog"
        className="copilot-fab"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "linear-gradient(135deg, #00C49A 0%, #009E7A 100%)",
          boxShadow:
            "0 4px 20px rgba(0, 196, 154, 0.4), 0 0 40px rgba(0, 196, 154, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        <Sparkles size={24} color="#fff" aria-hidden />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      id="copilot-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-title"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        width: 420,
        maxWidth: "calc(100vw - 24px)",
        height: 580,
        maxHeight: "calc(100dvh - 24px)",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: panelBg,
        border: `1px solid ${borderColor}`,
        boxShadow: isDark
          ? "0 8px 40px rgba(0, 0, 0, 0.6), 0 0 80px rgba(0, 196, 154, 0.08)"
          : "0 8px 40px rgba(0, 0, 0, 0.15), 0 0 60px rgba(0, 168, 130, 0.06)",
        fontFamily: "Inter, sans-serif",
        animation: "copilot-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: isDark
            ? "linear-gradient(135deg, rgba(0,196,154,0.12) 0%, rgba(10,24,40,0.95) 100%)"
            : "linear-gradient(135deg, rgba(0,168,130,0.08) 0%, rgba(255,255,255,0.98) 100%)",
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #00C49A 0%, #009E7A 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden
          >
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <div
              id="copilot-title"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: colors.textPrimary,
                lineHeight: 1.2,
              }}
            >
              Copiloto Analítico
            </div>
            <div
              style={{
                fontSize: 11,
                color: colors.accent,
                fontWeight: 500,
              }}
            >
              ConversaAI · En línea
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={closePanel}
          aria-label="Cerrar copiloto"
          className="copilot-icon-btn"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: colors.textSecondary,
            padding: 4,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {messages.length > 0 && (
        <div
          style={{
            padding: "8px 12px",
            borderBottom: `1px solid ${borderColor}`,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            flexShrink: 0,
          }}
          aria-label="Sugerencias rápidas"
        >
          {SUGGESTED_PROMPTS.slice(0, 2).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSuggestion(prompt)}
              className="copilot-suggestion-pill"
              style={{
                flexShrink: 0,
                fontSize: 10,
                padding: "4px 10px",
                borderRadius: 20,
                border: `1px solid ${borderColor}`,
                background: isDark ? colors.card : "#f1f5f9",
                color: colors.textSecondary,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {prompt.length > 42 ? `${prompt.slice(0, 40)}…` : prompt}
            </button>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 16,
              textAlign: "center",
              padding: "0 16px",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: isDark
                  ? "linear-gradient(135deg, rgba(0,196,154,0.15), rgba(0,196,154,0.05))"
                  : "linear-gradient(135deg, rgba(0,168,130,0.12), rgba(0,168,130,0.04))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden
            >
              <MessageCircle size={28} color={colors.accent} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  marginBottom: 6,
                }}
              >
                ¡Hola! Soy tu Copiloto Analítico
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                Analizá tendencias, fricción y solicitudes de tus clientes. Citamos conversaciones reales como evidencia.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                width: "100%",
                marginTop: 4,
              }}
            >
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSuggestion(prompt)}
                  className="copilot-suggestion"
                  style={{
                    background: isDark
                      ? "rgba(22,45,71,0.5)"
                      : "rgba(240,244,248,0.8)",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: colors.textPrimary,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ marginRight: 8 }} aria-hidden>
                    →
                  </span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === "user";
          const text = getMessageText(
            m.parts as Array<{ type: string; text?: string }>
          );
          if (!text) return null;
          const sessionIds =
            !isUser ? extractSessionIds(text) : [];

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                animation: "copilot-fade-in 0.25s ease",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: isUser
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                  background: isUser ? userBubbleBg : bubbleBg,
                  color: isUser ? "#fff" : colors.textPrimary,
                  fontSize: 13,
                  lineHeight: 1.55,
                  border: isUser ? "none" : `1px solid ${borderColor}`,
                  wordBreak: "break-word",
                }}
                dangerouslySetInnerHTML={
                  isUser
                    ? { __html: text.replace(/\n/g, "<br/>") }
                    : { __html: renderCopilotMarkdown(text) }
                }
              />
              {!isUser && (
                <SessionEvidenceChips
                  sessionIds={sessionIds}
                  accent={colors.accent}
                  borderColor={borderColor}
                  isDark={isDark}
                />
              )}
            </div>
          );
        })}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: "14px 14px 14px 4px",
                  background: bubbleBg,
                  border: `1px solid ${borderColor}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: colors.textSecondary,
                  fontSize: 12,
                }}
                aria-busy="true"
              >
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: colors.accent }}
                  aria-hidden
                />
                Analizando datos…
              </div>
            </div>
          )}
      </div>

      {messages.length > 3 && (
        <button
          type="button"
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="copilot-scroll-pill"
          style={{
            position: "absolute",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: colors.accent,
            color: "#fff",
            border: "none",
            borderRadius: 20,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            opacity: 0.9,
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          <ChevronDown size={12} aria-hidden /> Recientes
        </button>
      )}

      <div
        style={{
          padding: "10px 14px 14px",
          borderTop: `1px solid ${borderColor}`,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          background: isDark ? "rgba(10,24,40,0.6)" : "rgba(248,250,251,0.8)",
        }}
      >
        <label htmlFor="copilot-input" className="sr-only">
          Mensaje para el copiloto
        </label>
        <textarea
          id="copilot-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregúntale algo al copiloto…"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: `1px solid ${borderColor}`,
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            fontFamily: "inherit",
            color: colors.textPrimary,
            background: inputBg,
            outline: "none",
            lineHeight: 1.4,
            maxHeight: 100,
            minHeight: 40,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          aria-label="Enviar mensaje"
          className="copilot-send-btn"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: "none",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            background:
              isLoading || !input.trim()
                ? isDark
                  ? "rgba(30,54,84,0.5)"
                  : "#E2E8F0"
                : "linear-gradient(135deg, #00C49A 0%, #009E7A 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Send
            size={16}
            color={isLoading || !input.trim() ? colors.textMuted : "#fff"}
            aria-hidden
          />
        </button>
      </div>

      <style>{`
        @keyframes copilot-slide-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes copilot-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        #copilot-panel ::-webkit-scrollbar { width: 5px; }
        #copilot-panel ::-webkit-scrollbar-thumb {
          background: rgba(139,168,196,0.35);
          border-radius: 10px;
        }
        .copilot-fab:focus-visible,
        .copilot-icon-btn:focus-visible,
        .copilot-send-btn:focus-visible,
        .copilot-suggestion:focus-visible,
        .copilot-suggestion-pill:focus-visible,
        .copilot-chip:focus-visible,
        .copilot-scroll-pill:focus-visible,
        #copilot-input:focus-visible {
          outline: 2px solid #00C49A;
          outline-offset: 2px;
        }
        .copilot-session-ref {
          font-family: ui-monospace, monospace;
          font-size: 0.9em;
          color: #00A882;
          background: rgba(0,196,154,0.1);
          padding: 0 4px;
          border-radius: 4px;
        }
        .dark .copilot-session-ref { color: #34d399; }
        .copilot-inline-code {
          background: rgba(0,196,154,.12);
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 0.85em;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          border: 0;
        }
        @media (max-width: 480px) {
          #copilot-panel {
            right: 12px !important;
            bottom: 12px !important;
            width: calc(100vw - 24px) !important;
            height: calc(100dvh - 24px) !important;
          }
          .copilot-fab {
            right: 16px !important;
            bottom: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
