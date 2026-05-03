import { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { useTheme } from "../context/theme-context";
import { ChevronDown, ChevronUp } from "lucide-react";

type ExecutionRow = {
  id: number;
  file: string;
  date: string;
  messages: string;
  duration: string;
  status: "success" | "warning" | "error";
  statusLabel: string;
  f1Score: string | null;
  details?: {
    stats: Array<{ label: string; value: string; isWarning?: boolean }>;
    logs: Array<{ time: string; message: string; color: string }>;
  };
};

// ─── Main Table ───────────────────────────────────────────────────────────────
function HistorialTable() {
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<number>(1);

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    overflow: "hidden",
  };

  const executions: ExecutionRow[] = [
    {
      id: 1,
      file: "corpus_abril_2025.csv",
      date: "01 abr 2025 · 09:12",
      messages: "2.13M",
      duration: "9m 42s",
      status: "warning",
      statusLabel: "advertencia",
      f1Score: "0.847",
      details: {
        stats: [
          { label: "ES", value: "1.40M" },
          { label: "PT", value: "734k" },
          { label: "Errores no críticos", value: "842" },
          { label: "F1 intención", value: "0.791" },
          { label: "F1 sentim. PT", value: "0.762 ⚑", isWarning: true },
        ],
        logs: [
          { time: "09:12:01", message: "✓ Validación — 2.134.872 filas · 0 errores críticos", color: colors.accent },
          { time: "09:12:34", message: "✓ Limpieza — ES: 1.4M · PT: 734k", color: colors.accent },
          { time: "09:13:10", message: "⚑ 842 mensajes con encoding inusual — normalizados", color: colors.warning },
          { time: "09:14:02", message: "✓ Embeddings completados", color: colors.accent },
          { time: "09:17:44", message: "✓ Clasificación completada", color: colors.accent },
          { time: "09:21:54", message: "✓ Agregación completada · pipeline finalizado", color: colors.accent },
        ],
      },
    },
    {
      id: 2,
      file: "corpus_marzo_2025.csv",
      date: "02 mar 2025",
      messages: "1.98M",
      duration: "8m 19s",
      status: "success",
      statusLabel: "exitoso",
      f1Score: "0.835",
    },
    {
      id: 3,
      file: "corpus_febrero_2025.csv",
      date: "01 feb 2025",
      messages: "2.04M",
      duration: "8m 55s",
      status: "success",
      statusLabel: "exitoso",
      f1Score: "0.841",
    },
    {
      id: 4,
      file: "corpus_enero_2025.csv",
      date: "03 ene 2025",
      messages: "1.87M",
      duration: "7m 48s",
      status: "success",
      statusLabel: "exitoso",
      f1Score: "0.839",
    },
    {
      id: 5,
      file: "corpus_dic_2024_v2.csv",
      date: "05 dic 2024",
      messages: "2.21M",
      duration: "10m 02s",
      status: "success",
      statusLabel: "exitoso",
      f1Score: "0.830",
    },
    {
      id: 6,
      file: "corpus_dic_2024_v1.csv",
      date: "01 dic 2024",
      messages: "—",
      duration: "1m 12s",
      status: "error",
      statusLabel: "fallido",
      f1Score: null,
    },
  ];

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

  const getF1Color = (status: string) => {
    if (status === "warning") return "#F5A623";
    return "#00C49A";
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
          F1 sentim.
        </div>
        <div />
      </div>

      {/* Table Rows */}
      {executions.map((exec, idx) => {
        const isExpanded = expandedId === exec.id;
        const rowBg = isExpanded ? colors.background : colors.card;
        return (
          <div key={exec.id}>
            {/* Main Row */}
            <div
              className="grid gap-4 cursor-pointer transition-colors"
              style={{
                gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1fr 0.8fr 60px",
                padding: "14px 16px",
                backgroundColor: rowBg,
                borderBottom: isExpanded ? "none" : idx < executions.length - 1 ? `1px solid ${colors.border}` : "none",
              }}
              onClick={() => setExpandedId(isExpanded ? 0 : exec.id)}
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
              <div style={{ color: exec.f1Score ? getF1Color(exec.status) : colors.textSecondary, fontSize: 12 }}>
                {exec.f1Score || "—"}
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
            {isExpanded && exec.details && (
              <div
                style={{
                  backgroundColor: colors.background,
                  padding: "14px 16px",
                  borderBottom: idx < executions.length - 1 ? `1px solid ${colors.border}` : "none",
                }}
              >
                {/* Stats pills */}
                <div className="flex flex-wrap gap-2" style={{ marginBottom: 10 }}>
                  {exec.details.stats.map((stat, i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11,
                        color: stat.isWarning ? colors.warning : colors.textSecondary,
                        border: stat.isWarning ? "1px solid #F5A623" : "none",
                      }}
                    >
                      {stat.label}: {stat.value}
                    </div>
                  ))}
                </div>

                {/* Log box */}
                <div
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 8,
                    padding: 12,
                    fontFamily: "monospace",
                  }}
                >
                  {exec.details.logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: i < exec.details!.logs.length - 1 ? 6 : 0 }}>
                      <span style={{ color: colors.textSecondary, fontSize: 11 }}>{log.time}</span>
                      <span style={{ color: colors.textSecondary, fontSize: 11 }}> · </span>
                      <span style={{ color: log.color, fontSize: 11 }}>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination() {
  const { colors } = useTheme();

  return (
    <div className="flex items-center justify-between">
      <div style={{ color: colors.textSecondary, fontSize: 12 }}>
        Mostrando 6 de 12 ejecuciones
      </div>
      <div className="flex gap-2">
        <button
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            border: `1px solid ${colors.textSecondary}`,
            borderRadius: 6,
            padding: "6px 12px",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
        >
          ← Anterior
        </button>
        <button
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            border: `1px solid ${colors.textSecondary}`,
            borderRadius: 6,
            padding: "6px 12px",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function HistorialPage() {
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
          <div className="flex items-start justify-between">
            <div>
              <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
                Historial de ejecuciones
              </h1>
              <p style={{ color: colors.textSecondary, fontSize: 11, margin: "4px 0 0 0" }}>
                12 ejecuciones en los últimos 6 meses
              </p>
            </div>
            <select
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                border: `1px solid ${colors.textSecondary}`,
                borderRadius: 6,
                padding: "6px 12px",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
            >
              <option>Todos los estados</option>
              <option>Exitoso</option>
              <option>Advertencia</option>
              <option>Fallido</option>
            </select>
          </div>

          {/* Table */}
          <HistorialTable />

          {/* Pagination */}
          <Pagination />
    </DashboardShell>
  );
}
