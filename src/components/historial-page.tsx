"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { useTheme } from "../context/theme-context";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PipelineRunItem } from "../lib/api";

// ─── Main Table ───────────────────────────────────────────────────────────────
function HistorialTable({ runs }: { runs: PipelineRunItem[] }) {
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    overflow: "hidden",
  };

  if (runs.length === 0) {
    return (
      <div style={{ ...card, padding: 24 }}>
        <div style={{ color: colors.textMuted, fontSize: 13 }}>
          No hay ejecuciones aún. Iniciá el pipeline desde la pestaña Pipeline datos.
        </div>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "en curso…";
    const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const getStatusBg = (status: string) => {
    if (status === "success") return "rgba(0,196,154,0.13)";
    if (status === "warning") return "rgba(245,166,35,0.13)";
    return "rgba(255,107,107,0.13)";
  };

  const getStatusColor = (status: string) => {
    if (status === "success") return "#00C49A";
    if (status === "warning") return "#F5A623";
    return "#FF6B6B";
  };

  return (
    <div style={card}>
      {/* Table Header */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1fr 0.8fr 60px",
          padding: "12px 16px",
          backgroundColor: colors.card,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Archivo
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Fecha
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Mensajes
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Duración
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Estado
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Calidad análisis
        </div>
        <div />
      </div>

      {/* Table Rows */}
      {runs.map((run, idx) => {
        const isExpanded = expandedId === run.id;
        const exec = {
          id: run.id,
          file: run.corpus_file.split("/").pop() ?? run.corpus_file,
          date: formatDate(run.started_at),
          messages: run.total_messages > 999
            ? (run.total_messages / 1000).toFixed(1) + "k"
            : run.total_messages.toString(),
          duration: formatDuration(run.started_at, run.completed_at),
          status: run.status === "completed" ? "success" : run.status === "running" ? "warning" : "error",
          statusLabel: run.status === "completed" ? "exitoso" : run.status === "running" ? "en curso" : "fallido",
          errorMsg: run.error_message,
        };
        const rowBg = isExpanded ? colors.background : colors.card;
        return (
          <div key={run.id}>
            {/* Main Row */}
            <div
              className="grid gap-4 cursor-pointer transition-colors"
              style={{
                gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1fr 0.8fr 60px",
                padding: "14px 16px",
                backgroundColor: rowBg,
                borderBottom: isExpanded ? "none" : idx < runs.length - 1 ? `1px solid ${colors.border}` : "none",
              }}
              onClick={() => setExpandedId(isExpanded ? null : run.id)}
              onMouseEnter={(e) => {
                if (!isExpanded) {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(26,143,227,0.03)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isExpanded) {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = rowBg;
                }
              }}
            >
              <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: isExpanded ? 600 : 400 }}>
                {exec.file}
              </div>
              <div style={{ color: colors.textSecondary, fontSize: 12 }}>{exec.date}</div>
              <div style={{ color: colors.textSecondary, fontSize: 12 }}>{exec.messages}</div>
              <div style={{ color: colors.textSecondary, fontSize: 12 }}>{exec.duration}</div>
              <div>
                <span
                  style={{
                    backgroundColor: getStatusBg(exec.status),
                    color: getStatusColor(exec.status),
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "3px 8px",
                    borderRadius: 12,
                  }}
                >
                  {exec.statusLabel}
                </span>
              </div>
              <div style={{ color: colors.textMuted, fontSize: 12 }}>
                —
              </div>
              <div className="flex items-center justify-center">
                {isExpanded ? (
                  <div className="flex items-center gap-1" style={{ color: colors.textSecondary, fontSize: 11 }}>
                    <ChevronUp size={14} />
                  </div>
                ) : (
                  <div className="flex items-center gap-1" style={{ color: colors.textSecondary, fontSize: 11 }}>
                    <ChevronDown size={14} />
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div
                style={{
                  backgroundColor: colors.background,
                  padding: "14px 16px",
                  borderBottom: idx < runs.length - 1 ? `1px solid ${colors.border}` : "none",
                }}
              >
                <div className="flex flex-wrap gap-2">
                  <div style={{ backgroundColor: colors.card, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: colors.textSecondary }}>
                    Mensajes: {run.total_messages.toLocaleString("es")}
                  </div>
                  <div style={{ backgroundColor: colors.card, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: colors.textSecondary }}>
                    Sesiones: {run.total_sessions.toLocaleString("es")}
                  </div>
                  {run.completed_at && (
                    <div style={{ backgroundColor: colors.card, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: colors.textSecondary }}>
                      Fin: {formatDate(run.completed_at)}
                    </div>
                  )}
                  {run.error_message && (
                    <div style={{ backgroundColor: "rgba(255,107,107,0.1)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#FF6B6B", border: "1px solid #FF6B6B" }}>
                      {run.error_message}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function HistorialPage({ runs }: { runs: PipelineRunItem[] }) {
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Historial" />} mainClassName="space-y-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
            <Link
              href="/"
              style={{ color: colors.textSecondary, textDecoration: "none" }}
              className="hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
            <span style={{ color: colors.textPrimary }}>Historial</span>
          </nav>

          {/* Page Header */}
          <div>
            <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
              Historial de ejecuciones
            </h1>
            <p style={{ color: colors.textSecondary, fontSize: 11, margin: "4px 0 0 0" }}>
              {runs.length} ejecuciones registradas
            </p>
          </div>

          {/* Table */}
          <HistorialTable runs={runs} />
    </DashboardShell>
  );
}
