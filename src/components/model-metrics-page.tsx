"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { AlertCircle, Flag, Info, Loader2, Database, History, RefreshCw } from "lucide-react";
import { useTheme } from "../context/theme-context";
import {
  formatIntentLabel,
  type ModelMetricsData,
  type RegionMetrics,
} from "@src/lib/model-metrics-types";

type LangFilter = "ALL" | "ES" | "PT";

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(3);
}

function deltaStr(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(3)}`;
}

function regionForFilter(
  byRegion: Record<string, RegionMetrics> | undefined,
  filter: LangFilter
): RegionMetrics | null {
  if (!byRegion) return null;
  if (filter === "ES") return byRegion.LATAM ?? null;
  if (filter === "PT") return byRegion.BRAZIL ?? null;
  return byRegion.ALL ?? null;
}

export function ModelMetricsPage({ data }: { data: ModelMetricsData }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [lang, setLang] = useState<LangFilter>("ALL");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationMessage, setEvaluationMessage] = useState("");
  const report = data.report;

  const handleRecalculate = async () => {
    setIsEvaluating(true);
    setEvaluationMessage("Iniciando evaluación...");
    try {
      const res = await fetch("/api/pipeline/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corpus: report?.corpus_path || "data/raw/data_conversa_ai.csv" }),
      });
      const resData = await res.json();
      if (resData.ok) {
        setEvaluationMessage("Ejecutando evaluación en la base de datos... Recargando en breve...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        router.refresh();
      } else {
        alert("Error al iniciar la evaluación: " + (resData.error || "desconocido"));
      }
    } catch (e) {
      alert("Error de conexión: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsEvaluating(false);
      setEvaluationMessage("");
    }
  };

  const region = useMemo(
    () => regionForFilter(report?.by_region, lang),
    [report?.by_region, lang]
  );

  const card: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const intentRows = useMemo(() => {
    if (!report?.per_intent_accuracy) return [];
    return Object.entries(report.per_intent_accuracy)
      .map(([intent, stats]) => ({
        intent: formatIntentLabel(intent),
        actual: stats.accuracy,
        n: stats.n,
      }))
      .sort((a, b) => a.actual - b.actual);
  }, [report?.per_intent_accuracy]);

  const breakdown = report?.sentiment_breakdown?.[lang === "PT" ? "PT" : "ES"];

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Métricas modelo" />} mainClassName="space-y-6">
      <nav className="flex items-center gap-1" style={{ fontSize: 13 }}>
        <Link href="/" style={{ color: colors.textSecondary, textDecoration: "none" }}>
          Dashboard
        </Link>
        <span style={{ color: colors.textSecondary, margin: "0 6px" }}>›</span>
        <span style={{ color: colors.textPrimary }}>Calidad del clasificador LLM</span>
      </nav>

      <div>
        <h1 style={{ color: colors.textPrimary, fontSize: 22, fontWeight: 700, margin: 0 }}>
          Calidad de los datos (validación PM)
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: "4px 0 0 0" }}>
          <strong>Para el equipo de Producto:</strong> Antes de confiar en las métricas del dashboard,
          verifica qué tan bien el LLM clasifica sentimientos e intenciones comparado con datos validados.
          Si el acuerdo es &lt;70%, los insights pueden estar sesgados.
          {report?.evaluated_at && (
            <> · Última evaluación: {new Date(report.evaluated_at).toLocaleString("es")}</>
          )}
          {data.totalMessages > 0 && <> · {data.totalMessages.toLocaleString()} mensajes en DB</>}
        </p>
      </div>

      {evaluationMessage && (
        <div
          role="status"
          style={{
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            border: `1px solid ${colors.accent}`,
            background: isDark ? "rgba(0,196,154,0.08)" : "rgba(0,168,130,0.06)",
            color: colors.textPrimary,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Loader2 size={16} className="animate-spin" style={{ color: colors.accent }} />
          <span>{evaluationMessage}</span>
        </div>
      )}

      {/* Cobertura de la Base de Datos */}
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Database size={18} color={colors.accent} />
          <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14 }}>
            Cobertura de Procesamiento de Agentes (Base de Datos)
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div style={{ padding: 12, backgroundColor: colors.background, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>Mensajes Totales</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
              {data.coverage.messagesTotal.toLocaleString()}
            </div>
          </div>
          <div style={{ padding: 12, backgroundColor: colors.background, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>Analizados con Sentimiento</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#00C49A" }}>
              {data.coverage.withSentiment.toLocaleString()}
              <span style={{ fontSize: 11, fontWeight: 400, color: colors.textSecondary, marginLeft: 6 }}>
                ({data.coverage.messagesTotal > 0 ? ((data.coverage.withSentiment / data.coverage.messagesTotal) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </div>
          <div style={{ padding: 12, backgroundColor: colors.background, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>Analizados con Intención</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>
              {data.coverage.withIntent.toLocaleString()}
              <span style={{ fontSize: 11, fontWeight: 400, color: colors.textSecondary, marginLeft: 6 }}>
                ({data.coverage.messagesTotal > 0 ? ((data.coverage.withIntent / data.coverage.messagesTotal) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </div>
        </div>
        {/* Barra de progreso visual */}
        {data.coverage.messagesTotal > 0 && (
          <div style={{ width: "100%", height: 6, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0", borderRadius: 3, overflow: "hidden", display: "flex" }}>
            <div style={{ height: "100%", width: `${(data.coverage.withSentiment / data.coverage.messagesTotal) * 100}%`, backgroundColor: "#00C49A" }} title="Sentimiento" />
            <div style={{ height: "100%", width: `${Math.max(0, (data.coverage.withIntent - data.coverage.withSentiment) / data.coverage.messagesTotal) * 100}%`, backgroundColor: "#3b82f6" }} title="Intención" />
          </div>
        )}
      </div>

      {!data.available && (
        <div
          style={{
            ...card,
            borderColor: colors.warning,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Info size={18} color={colors.warning} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, lineHeight: 1.5, color: colors.textPrimary }}>
            <strong>Sin validación de datos.</strong> {data.message}
            <p style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
              Esta pestaña muestra qué tan confiables son las métricas del dashboard. 
              Para activarla, el equipo de datos debe correr una evaluación con datos validados (ground truth).
              <br /><br />
              <strong>¿Por qué importa?</strong> Si el LLM acierta poco, los insights de Frustración e Intenciones pueden ser incorrectos.
            </p>
          </div>
        </div>
      )}

      {report?.coverage_pct != null && report.coverage_pct < 100 && (
        <div
          role="status"
          style={{
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            border: `1px solid ${colors.warning}`,
            background: isDark ? "rgba(245,166,35,0.08)" : "rgba(232,146,10,0.08)",
            color: colors.textPrimary,
          }}
        >
          Cobertura de labels del pipeline: <strong>{report.coverage_pct}%</strong> de filas
          evaluadas ({report.rows_with_labels ?? 0} / {report.rows_evaluated ?? 0}). Completá el análisis de emociones y solicitudes para ver métricas completas.
        </div>
      )}

      {report?.alerts?.map((alert) => (
        <div
          key={alert}
          style={{
            backgroundColor: isDark ? "rgba(245,166,35,0.08)" : "rgba(232,146,10,0.08)",
            border: `1px solid ${colors.warning}`,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <AlertCircle size={16} color={colors.warning} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ color: colors.warning, fontSize: 12, lineHeight: 1.5 }}>{alert}</div>
        </div>
      ))}

      {data.available && report && (
        <>
          <div style={card}>
            <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: 20 }}>
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                ¿Qué tan confiables son los datos del dashboard?
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                   type="button"
                   disabled={isEvaluating}
                   onClick={handleRecalculate}
                   style={{
                     fontSize: 11,
                     padding: "6px 14px",
                     borderRadius: 20,
                     cursor: isEvaluating ? "not-allowed" : "pointer",
                     backgroundColor: isEvaluating ? colors.border : colors.accent,
                     color: "#fff",
                     border: "none",
                     display: "flex",
                     alignItems: "center",
                     gap: 6,
                     fontWeight: 500,
                   }}
                 >
                   {isEvaluating ? (
                     <>
                       <Loader2 size={12} className="animate-spin" />
                       Evaluando...
                     </>
                   ) : (
                     <>
                       <RefreshCw size={12} />
                       Recalcular Calidad
                     </>
                   )}
                 </button>

                <div className="flex gap-1" style={{ borderLeft: `1px solid ${colors.border}`, paddingLeft: 12 }}>
                  {(["ALL", "ES", "PT"] as LangFilter[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setLang(tab)}
                      style={{
                        fontSize: 11,
                        padding: "4px 12px",
                        borderRadius: 20,
                        cursor: "pointer",
                        backgroundColor:
                          lang === tab ? "rgba(0,196,154,0.12)" : "transparent",
                        color: lang === tab ? colors.accent : colors.textSecondary,
                        border: `1px solid ${lang === tab ? colors.accent : colors.border}`,
                      }}
                    >
                      {tab === "ALL" ? "Todos" : tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: "El bot entiende el estado emocional",
                  value: region?.sentiment_agreement ?? report.sentiment_agreement,
                  delta: region?.sentiment_delta,
                  degraded:
                    (region?.sentiment_agreement ?? 1) < 0.7 ||
                    (region?.sentiment_delta ?? 0) < -0.05,
                },
                {
                  label: "El bot clasifica bien las solicitudes",
                  value: region?.intent_accuracy ?? report.intent_accuracy,
                  delta: region?.intent_delta,
                  degraded: (region?.intent_accuracy ?? 1) < 0.65,
                },
                {
                  label: "Solicitudes ambiguas (baja confianza)",
                  value: report.low_confidence_pct != null ? report.low_confidence_pct / 100 : null,
                  delta: null,
                  degraded: (report.low_confidence_pct ?? 0) > 15,
                  isPct: true,
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    backgroundColor: m.degraded
                      ? "rgba(255,107,107,0.03)"
                      : colors.background,
                    borderRadius: 8,
                    padding: 12,
                    border: m.degraded ? "1px solid #FF6B6B" : "none",
                  }}
                >
                  <div style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>
                    {m.label}
                    {region && lang !== "ALL" && (
                      <span style={{ opacity: 0.7 }}> · n={region.n}</span>
                    )}
                  </div>
                  <div
                    style={{
                      color: m.degraded ? "#FF6B6B" : colors.textPrimary,
                      fontSize: 24,
                      fontWeight: 600,
                    }}
                  >
                    {m.isPct
                      ? m.value != null
                        ? `${(m.value * 100).toFixed(1)}%`
                        : "—"
                      : pct(m.value as number)}
                  </div>
                  {m.delta != null && (
                    <div style={{ fontSize: 11, color: m.delta >= 0 ? "#00C49A" : "#FF6B6B", marginTop: 6 }}>
                      Δ vs período anterior: {deltaStr(m.delta)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div style={card}>
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Precisión por tipo de solicitud
              </div>
              {intentRows.length === 0 ? (
                <p style={{ fontSize: 12, color: colors.textSecondary }}>Sin datos por tipo de solicitud.</p>
              ) : (
                intentRows.map((row, i) => {
                  const critical = row.actual < 0.7;
                  return (
                    <div
                      key={row.intent}
                      className="grid grid-cols-3 gap-4"
                      style={{
                        padding: "10px 12px",
                        backgroundColor: i % 2 === 0 ? colors.card : colors.background,
                        borderRadius: 4,
                      }}
                    >
                      <span style={{ fontSize: 12, color: colors.textPrimary }}>{row.intent}</span>
                      <span style={{ fontSize: 12, textAlign: "right" }}>{row.actual.toFixed(3)}</span>
                      <span
                        style={{
                          fontSize: 12,
                          textAlign: "right",
                          color: critical ? "#FF6B6B" : colors.textSecondary,
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 4,
                          alignItems: "center",
                        }}
                      >
                        n={row.n}
                        {critical && <Flag size={11} color="#FF6B6B" />}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={card}>
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Historial de calidad (snapshots)
              </div>
              {data.history.length < 2 ? (
                <p style={{ fontSize: 12, color: colors.textSecondary }}>
                  Se mostrará tendencia tras varias evaluaciones mensuales en{" "}
                  el sistema de seguimiento.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.history.map((h) => (
                    <div
                      key={h.period}
                      className="flex justify-between text-sm"
                      style={{ color: colors.textPrimary }}
                    >
                      <span>{h.period}</span>
                      <span>
                        Emoción: {pct(h.sentiment_agreement)} · Solicitudes: {pct(h.intent_accuracy)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {breakdown && (
            <div style={card}>
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Acuerdo por etiqueta de sentimiento · {lang === "PT" ? "PT" : "ES"}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(breakdown).map(([label, stats]) => (
                  <div
                    key={label}
                    style={{
                      textAlign: "center",
                      padding: 12,
                      borderRadius: 8,
                      background: colors.background,
                    }}
                  >
                    <div style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 6 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: colors.accent }}>
                      {stats.agreement != null ? stats.agreement.toFixed(3) : "—"}
                    </div>
                    <div style={{ fontSize: 10, color: colors.textSecondary }}>n={stats.n}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Historial de Auditoría de Ingestas */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <History size={18} color={colors.accent} />
          <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Auditoría de Ingestas y Ejecuciones del Pipeline (Últimas 5)
          </div>
        </div>
        
        {data.runs.length === 0 ? (
          <p style={{ fontSize: 12, color: colors.textSecondary }}>No hay registros de ejecuciones del pipeline en la base de datos.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary, textAlign: "left" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>ID Run</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Archivo Corpus</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Inicio</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Fin / Duración</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "right" }}>Mensajes</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "right" }}>Sesiones</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "center" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run, i) => {
                  const isRunning = run.status === "running";
                  const isFailed = run.status === "failed";
                  
                  const statusBg = isRunning 
                    ? "rgba(59, 130, 246, 0.1)" 
                    : isFailed 
                      ? "rgba(239, 68, 68, 0.1)" 
                      : "rgba(16, 185, 129, 0.1)";
                      
                  const statusColor = isRunning 
                    ? "#3b82f6" 
                    : isFailed 
                      ? "#ef4444" 
                      : "#10b981";

                  const statusLabel = isRunning 
                    ? "Corriendo" 
                    : isFailed 
                      ? "Fallido" 
                      : "Completado";

                  const duration = run.started_at && run.completed_at
                    ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                    : "—";

                  return (
                    <tr key={run.id} style={{ borderBottom: `1px solid ${colors.border}`, backgroundColor: i % 2 === 0 ? "transparent" : isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: colors.textPrimary }}>#{run.id}</td>
                      <td style={{ padding: "10px 12px", color: colors.textPrimary }} title={run.corpus_file}>
                        {run.corpus_file ? run.corpus_file.split("/").pop() : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textSecondary }}>
                        {run.started_at ? new Date(run.started_at).toLocaleString("es") : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textSecondary }}>
                        {run.completed_at ? `${new Date(run.completed_at).toLocaleTimeString("es")} (${duration})` : isRunning ? "En progreso..." : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textPrimary, textAlign: "right" }}>
                        {run.total_messages?.toLocaleString() || 0}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textPrimary, textAlign: "right" }}>
                        {run.total_sessions?.toLocaleString() || 0}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ 
                          display: "inline-block", 
                          padding: "3px 8px", 
                          borderRadius: 12, 
                          fontSize: 10, 
                          fontWeight: 600, 
                          backgroundColor: statusBg, 
                          color: statusColor 
                        }}>
                          {statusLabel}
                        </span>
                        {run.error_message && (
                          <div style={{ color: "#ef4444", fontSize: 9, marginTop: 4, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={run.error_message}>
                            {run.error_message}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
