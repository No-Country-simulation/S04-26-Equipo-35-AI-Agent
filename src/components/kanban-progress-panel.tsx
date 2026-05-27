"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTheme } from "../context/theme-context";
import {
  buildSeedItems,
  ACCIONES_UPDATED_EVENT,
} from "../lib/action-seeds";
import type { ActionItem, Status, Severity } from "../lib/action-seeds";

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "detected",    label: "Detectado",     color: "#6366f1" },
  { id: "analyzing",   label: "Analizando",    color: "#f59e0b" },
  { id: "in_progress", label: "En desarrollo", color: "#3b82f6" },
  { id: "resolved",    label: "Resuelto",      color: "#22c55e" },
];

const SEV: Record<Severity, string> = {
  critical: "#f87171",
  high:     "#fbbf24",
  medium:   "#818cf8",
  low:      "#52525b",
};

export function KanbanProgressPanel() {
  const { colors } = useTheme();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(() => {
    fetch("/api/actions")
      .then((r) => r.json())
      .then((d: ActionItem[]) => {
        const real = Array.isArray(d) ? d.filter((i) => !i.is_suggestion) : [];
        setItems(real.length > 0 ? real : buildSeedItems());
      })
      .catch(() => setItems(buildSeedItems()))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 4000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ items?: ActionItem[]; refresh?: boolean }>).detail;
      if (detail?.items) setItems(detail.items);
      else if (detail?.refresh) fetchItems();
    };
    window.addEventListener(ACCIONES_UPDATED_EVENT, handler);
    return () => window.removeEventListener(ACCIONES_UPDATED_EVENT, handler);
  }, []);

  const byStatus = (s: Status) => items.filter((i) => i.status === s);
  const inProgress = byStatus("in_progress").slice(0, 3);
  const total = items.length;
  const resolved = byStatus("resolved").length;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <section
      style={{
        backgroundColor: colors.card,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 8 }}>
        <div>
          <h2 style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600, margin: 0 }}>
            Estado del plan de acción
          </h2>
          <p style={{ color: colors.textMuted, fontSize: 11, margin: "3px 0 0" }}>
            Progreso del equipo en tiempo real
          </p>
        </div>
        <Link
          href="/acciones"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "#818cf8",
            fontSize: 11,
            fontWeight: 500,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Ver board completo <ArrowRight size={11} />
        </Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: colors.textMuted, fontSize: 12, padding: "12px 0" }}>
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          Cargando…
        </div>
      ) : total === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 12, padding: "12px 0" }}>
          Sin acciones registradas. <Link href="/acciones" style={{ color: "#818cf8", textDecoration: "none" }}>Crear la primera</Link>
        </div>
      ) : (
        <>
          {/* Column counters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {COLUMNS.map((col) => {
              const count = byStatus(col.id).length;
              return (
                <div
                  key={col.id}
                  style={{
                    background: `${col.color}0d`,
                    border: `1px solid ${col.color}25`,
                    borderRadius: 8,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ color: col.color, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{count}</div>
                  <div style={{ color: colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: 500 }}>{col.label}</div>
                </div>
              );
            })}
          </div>

          {/* Overall progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ color: colors.textMuted, fontSize: 11 }}>Progreso general</span>
              <span style={{ color: colors.success, fontSize: 11, fontWeight: 600 }}>{pct}% resuelto</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #6366f1, #22c55e)",
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>

          {/* In-progress items */}
          {inProgress.length > 0 && (
            <div>
              <div style={{ color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                En desarrollo ahora
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {inProgress.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      background: "rgba(59,130,246,0.06)",
                      border: "1px solid rgba(59,130,246,0.15)",
                      borderRadius: 7,
                    }}
                  >
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: SEV[item.severity],
                      boxShadow: `0 0 5px ${SEV[item.severity]}`,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      color: colors.textPrimary,
                      fontSize: 12,
                      fontWeight: 500,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {item.title}
                    </span>
                    {item.assignee && (
                      <span style={{ color: colors.textMuted, fontSize: 10, flexShrink: 0 }}>
                        {item.assignee}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
