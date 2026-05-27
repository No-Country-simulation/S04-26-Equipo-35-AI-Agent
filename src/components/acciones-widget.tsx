"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kanban, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import { useTheme } from "../context/theme-context";

type Severity = "critical" | "high" | "medium" | "low";
type Status = "detected" | "analyzing" | "in_progress" | "resolved";

interface ActionItem {
  id: string;
  title: string;
  severity: Severity;
  status: Status;
  assignee: string | null;
  impact_score: number;
  is_suggestion: boolean;
}

const SEV: Record<Severity, { color: string; label: string }> = {
  critical: { color: "#f87171", label: "Crítico" },
  high:     { color: "#fbbf24", label: "Alto" },
  medium:   { color: "#818cf8", label: "Medio" },
  low:      { color: "#52525b", label: "Bajo" },
};

const STATUS_LABEL: Record<Status, string> = {
  detected:    "Detectado",
  analyzing:   "Analizando",
  in_progress: "En desarrollo",
  resolved:    "Resuelto",
};

export function AccionesWidget() {
  const { colors } = useTheme();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/actions")
      .then((r) => r.json())
      .then((data: ActionItem[]) => {
        const board = (Array.isArray(data) ? data : [])
          .filter((i) => !i.is_suggestion && i.status !== "resolved")
          .slice(0, 3);
        setItems(board);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        backgroundColor: colors.card,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: "rgba(99,102,241,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Kanban size={13} style={{ color: "#818cf8" }} />
          </div>
          <div>
            <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>Acciones pendientes</div>
            <div style={{ color: colors.textMuted, fontSize: 11 }}>Tareas activas del equipo</div>
          </div>
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
          }}
        >
          Ver board <ArrowRight size={11} />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: colors.textMuted, fontSize: 12, padding: "8px 0" }}>
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", padding: "16px 0" }}>
          <AlertTriangle size={16} style={{ margin: "0 auto 6px", display: "block", color: colors.textMuted }} />
          No hay acciones pendientes.{" "}
          <Link href="/acciones" style={{ color: "#818cf8", textDecoration: "none" }}>
            Crear la primera
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => {
            const sev = SEV[item.severity];
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 7,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${colors.border}`,
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: sev.color,
                    boxShadow: `0 0 5px ${sev.color}`,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    color: colors.textPrimary,
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {item.title}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10,
                    color: colors.textMuted,
                    background: "rgba(255,255,255,0.05)",
                    padding: "2px 7px",
                    borderRadius: 4,
                  }}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
              </div>
            );
          })}

          <Link
            href="/acciones"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              marginTop: 4,
              padding: "6px 0",
              borderRadius: 7,
              border: `1px solid rgba(99,102,241,0.25)`,
              background: "rgba(99,102,241,0.06)",
              color: "#818cf8",
              fontSize: 11.5,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Ver todas las acciones <ArrowRight size={11} />
          </Link>
        </div>
      )}
    </div>
  );
}
