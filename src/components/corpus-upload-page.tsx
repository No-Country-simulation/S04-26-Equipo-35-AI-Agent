"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import {
  Upload,
  FileText,
  CheckCircle,
  Database,
  Brain,
  Target,
  BarChart3,
  RefreshCw,
  Sparkles,
  Activity,
  Clock,
  Layers,
  Zap,
} from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── Live Status Panel ────────────────────────────────────────────────────────
const STAGES = [
  { key: "etl",        label: "ETL",           icon: Database,    desc: "Carga a BD" },
  { key: "sentiment",  label: "Sentimiento",   icon: Brain,       desc: "Clasificación LLM" },
  { key: "intent",     label: "Intención",     icon: Target,      desc: "Detección LLM" },
  { key: "embeddings", label: "Embeddings",    icon: Zap,         desc: "Vectores Qdrant" },
  { key: "analyst",    label: "Analyst",       icon: BarChart3,   desc: "Métricas" },
  { key: "completed",  label: "Listo",         icon: CheckCircle, desc: "Pipeline completo" },
];

function LiveStatusPanel({
  pipelineState, checkpointStage, dbStats, stageLabel, progress: progressProp,
  lastRefresh, corpusInUse, colors, isDark, onRefresh, queuePosition, currentJobId,
}: {
  pipelineState: string; checkpointStage: string;
  dbStats: { messagesTotal: number; withSentiment: number; withIntent: number };
  stageLabel: string; progress: number; lastRefresh: Date | null;
  corpusInUse: string; colors: Record<string, string>; isDark: boolean;
  onRefresh: () => void;
  queuePosition: number | null;
  currentJobId: string | null;
}) {
  const currentIdx = STAGES.findIndex((s) => s.key === checkpointStage);
  const isRunning = pipelineState === "processing";
  const isCompleted = checkpointStage === "completed" && !isRunning;

  // Calculate REAL progress based on DB counts, not fixed percentages
  let realProgress = progressProp;
  if (isRunning) {
    if (checkpointStage === "etl") {
      realProgress = 25;
    } else if (checkpointStage === "sentiment") {
      // Progress: 30% to 60% based on sentiment coverage
      const base = 30;
      const targetMessages = Math.max(dbStats.messagesTotal, 1);
      realProgress = base + Math.round((dbStats.withSentiment / targetMessages) * 30);
    } else if (checkpointStage === "intent") {
      // Progress: 60% to 90% based on intent coverage (relative to sentiment)
      const base = 60;
      const targetMessages = Math.max(dbStats.withSentiment, 1);
      realProgress = base + Math.round((dbStats.withIntent / targetMessages) * 30);
    } else if (checkpointStage === "analyst") {
      realProgress = 95;
    }
  } else if (isCompleted) {
    realProgress = 100;
  }
  // Clamp to max 99 while running (100 only when truly completed)
  if (isRunning && realProgress >= 100) realProgress = 99;

  const sentPct = dbStats.messagesTotal > 0 ? Math.round((dbStats.withSentiment / dbStats.messagesTotal) * 100) : 0;
  const intentPct = dbStats.messagesTotal > 0 ? Math.round((dbStats.withIntent / dbStats.messagesTotal) * 100) : 0;

  return (
    <div style={{ marginTop: 20, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={13} color={isRunning ? colors.accent : colors.textMuted} />
          <span style={{ fontSize: 11, fontWeight: 700, color: colors.textPrimary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Estado del pipeline
          </span>
          {isRunning && (
            <span style={{ fontSize: 10, color: colors.accent, backgroundColor: `${colors.accent}18`, border: `1px solid ${colors.accent}40`, borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
              EN CURSO
            </span>
          )}
          {isRunning && queuePosition !== null && queuePosition > 0 && (
            <span style={{ fontSize: 10, color: colors.warning, backgroundColor: `${colors.warning}18`, border: `1px solid ${colors.warning}40`, borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
              Cola: #{queuePosition}
            </span>
          )}
        </div>
        <button onClick={onRefresh} title="Actualizar" style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
          <RefreshCw size={11} /> Actualizar
        </button>
      </div>

      {/* Stage Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {STAGES.map((stage, idx) => {
          const done = currentIdx > idx || checkpointStage === "completed";
          const active = stage.key === checkpointStage && isRunning;
          const Icon = stage.icon;
          const stateColor = done ? colors.success : active ? colors.accent : colors.textMuted;

          return (
            <div key={stage.key} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8,
              backgroundColor: active ? `${colors.accent}10` : done ? `${colors.success}08` : "transparent",
              border: `1px solid ${active ? colors.accent + "40" : done ? colors.success + "25" : colors.border + "60"}`,
            }}>
              <Icon size={13} color={stateColor} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? colors.accent : done ? colors.textPrimary : colors.textMuted }}>
                  {stage.label}
                </span>
                <span style={{ fontSize: 10, color: colors.textMuted, marginLeft: 6 }}>{stage.desc}</span>
              </div>
              {done && <CheckCircle size={12} color={colors.success} />}
              {active && (
                <span style={{ fontSize: 10, color: colors.accent, fontWeight: 600, animation: "pulse 1.5s infinite" }}>
                  {stageLabel || "procesando…"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar — solo si está corriendo */}
      {isRunning && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 5, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${realProgress}%`, backgroundColor: colors.accent, borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            <span style={{ color: colors.textMuted, fontSize: 10 }}>{stageLabel || "Procesando…"}</span>
            <span style={{ color: colors.accent, fontSize: 10, fontWeight: 700 }}>{realProgress}%</span>
          </div>
        </div>
      )}

      {/* DB Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { label: "Mensajes en BD", value: dbStats.messagesTotal.toLocaleString(), icon: Layers, color: colors.textPrimary },
          { label: "Con sentimiento", value: `${dbStats.withSentiment.toLocaleString()} (${sentPct}%)`, icon: Brain, color: sentPct === 100 ? colors.success : colors.accent },
          { label: "Con intención", value: `${dbStats.withIntent.toLocaleString()} (${intentPct}%)`, icon: Target, color: intentPct === 100 ? colors.success : colors.accent },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", borderRadius: 8, padding: "8px 10px", border: `1px solid ${colors.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <Icon size={10} color={color} />
              <span style={{ fontSize: 9, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Corpus + timestamp */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        <span style={{ fontSize: 10, color: colors.textMuted }}>
          <Layers size={9} style={{ display: "inline", marginRight: 3 }} />
          {corpusInUse.split("/").pop()}
        </span>
        {lastRefresh && (
          <span style={{ fontSize: 10, color: colors.textMuted, display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={9} />
            Actualizado {lastRefresh.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}

export function CorpusUploadPage() {
  const { colors, isDark } = useTheme();
  
  // States
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [pipelineState, setPipelineState] = useState<
    "idle" | "processing" | "completed" | "failed" | "rate_limited"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [checkpointStage, setCheckpointStage] = useState("etl");
  const [corpusInUse, setCorpusInUse] = useState("data/raw/data_conversa_ai.csv");
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [demoSize, setDemoSize] = useState(2000);
  const [demoMsg, setDemoMsg] = useState("");
  const [dbStats, setDbStats] = useState({
    messagesTotal: 0,
    withSentiment: 0,
    withIntent: 0,
  });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const activeJobRef = React.useRef<string | null>(null);
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Historial de corpus ingestados ────────────────────────────────────────
  type RunRow = {
    id: number;
    corpus_name: string;
    corpus_file: string;
    status: string;
    total_messages: number | null;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
  };
  const [historyRuns, setHistoryRuns] = React.useState<RunRow[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/pipeline/history?limit=15");
      const json = await res.json();
      setHistoryRuns(json.runs ?? []);
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  React.useEffect(() => { fetchHistory(); }, []);

  // ── Estado completo de la ingesta (cards + barra de etapas) ───────────────
  type PipelineFullStatus = {
    stage: string;
    status: string;
    corpusFile: string | null;
    db: { messagesTotal: number; withSentiment: number; withIntent: number };
    qdrant: { collection: string; points: number };
    run: { started_at?: string; status?: string; corpus_file?: string } | null;
  };
  const [pipelineFull, setPipelineFull] = React.useState<PipelineFullStatus | null>(null);
  const [loadingFull, setLoadingFull] = React.useState(true);

  const fetchFullStatus = async () => {
    try {
      const res = await fetch("/api/pipeline/status");
      const json = await res.json() as PipelineFullStatus;
      setPipelineFull(json);
    } catch { /* ignore */ } finally {
      setLoadingFull(false);
    }
  };

  React.useEffect(() => { fetchFullStatus(); }, []);

  const sanitizeError = (raw: string): { isRateLimit: boolean; msg: string } => {
    const isRateLimit =
      raw.includes("rate_limited") ||
      raw.includes("RateLimitError") ||
      raw.includes("Rate limit") ||
      raw.includes("tokens per day") ||
      raw.includes("TPD") ||
      raw.includes("429");
    if (isRateLimit) {
      return { isRateLimit: true, msg: "Cuota diaria de Groq agotada. Reanuda la misma etapa mañana (el progreso está guardado)." };
    }
    const clean = raw.split("\n")[0].slice(0, 200);
    return { isRateLimit: false, msg: clean || "El pipeline falló" };
  };

  const refreshStatus = async () => {
    try {
      const res = await fetch("/api/pipeline/status");
      const json = await res.json();
      // Solo actualizar stage/pipelineState si NO hay un job activo en polling
      if (!activeJobRef.current && json.stage) setCheckpointStage(json.stage);
      if (json.corpusFile) setCorpusInUse(json.corpusFile);
      if (json.db) setDbStats(json.db);
      setLastRefresh(new Date());
      if (!activeJobRef.current) {
        const status = json.status as string;
        if (status === "completed" || json.stage === "completed") {
          setPipelineState("completed");
          setProgress(100);
        } else if (status === "failed") {
          const errText = (json.run?.error_message ?? "") as string;
          const { isRateLimit, msg } = sanitizeError(errText);
          setPipelineState(isRateLimit ? "rate_limited" : "failed");
          setErrorMsg(msg);
        } else if (status === "running") {
          setPipelineState("processing");
        }
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 8000);
    return () => clearInterval(id);
  }, []);

  // Parse first few lines of CSV for preview
  const parseCSVPreview = (uploadedFile: File) => {
    const reader = new FileReader();
    // Read only the first 64KB for immediate preview
    const slice = uploadedFile.slice(0, 64 * 1024);
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length > 0) {
        // Simple comma split (good enough for quick preview)
        const headers = lines[0].split(",").map((h) => h.trim());
        const rows = lines.slice(1, 6).map((line) => line.split(",").map((c) => c.trim()));
        setPreviewData({ headers, rows });
      }
    };
    reader.readAsText(slice);
  };

  const handleFile = (selectedFile: File) => {
    if (selectedFile.name.endsWith(".csv") || selectedFile.name.endsWith(".json")) {
      setFile(selectedFile);
      setPipelineState("idle");
      setProgress(0);
      parseCSVPreview(selectedFile);
    } else {
      alert("Por favor, sube un archivo CSV o JSON.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const pollProgress = () => {
    const poll = setInterval(async () => {
      try {
        const statusRes = await fetch("/api/pipeline/status");
        const statusJson = await statusRes.json();
        const stage = statusJson.stage as string;
        const status = statusJson.status as string;

        const stageMap: Record<string, { pct: number; label: string }> = {
          etl: { pct: 20, label: "Limpieza ETL…" },
          sentiment: { pct: 45, label: "Clasificando sentimiento…" },
          intent: { pct: 70, label: "Detectando intenciones…" },
          analyst: { pct: 90, label: "Generando insights…" },
          completed: { pct: 100, label: "Completado" },
        };
        const info = stageMap[stage] ?? { pct: 15, label: "Procesando…" };
        setProgress(info.pct);
        setStageLabel(info.label);

        if (status === "completed" && stage === "completed") {
          clearInterval(poll);
          setPipelineState("completed");
          setProgress(100);
        } else if (status === "completed" && stage !== "completed") {
          clearInterval(poll);
          setPipelineState("idle");
          setProgress(info.pct);
          setStageLabel(`Etapa lista. Siguiente: ${stage}`);
          refreshStatus();
        } else if (status === "failed") {
          clearInterval(poll);
          const errText = (statusJson.run?.error_message ?? "") as string;
          const { isRateLimit: rl, msg } = sanitizeError(errText);
          setPipelineState(rl ? "rate_limited" : "failed");
          setErrorMsg(msg);
        }
      } catch {
        /* sigue polling */
      }
    }, 4000);
    setTimeout(() => clearInterval(poll), 7200000);
  };

  const launchStage = async (
    stage: "etl" | "sentiment" | "intent" | "embeddings" | "analyst" | "full"
  ) => {
    setPipelineState("processing");
    setProgress(5);
    setErrorMsg("");
    setStageLabel("Encolando job…");
    setCurrentJobId(null);
    setQueuePosition(null);
    // Cancelar poll anterior si existe
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      let enqueueRes: Response;
      if (file && (stage === "etl" || stage === "full")) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("stage", stage === "full" ? "etl" : stage);
        formData.append("smartRecommendations", "true");
        enqueueRes = await fetch("/api/pipeline/enqueue", { 
          method: "POST", 
          body: formData 
        });
      } else {
        enqueueRes = await fetch("/api/pipeline/enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage,
            corpus: corpusInUse,
            smartRecommendations: true,
          }),
        });
      }
      
      const enqueueJson = await enqueueRes.json();
      if (!enqueueRes.ok) {
        throw new Error(enqueueJson.error || "No se pudo encolar el job");
      }
      
      // Guardar job ID para polling
      setCurrentJobId(enqueueJson.jobId);
      setQueuePosition(enqueueJson.position);
      setStageLabel(`En cola (posición ${enqueueJson.position}) - esperando worker...`);
      
      // Iniciar polling del job
      pollJobProgress(enqueueJson.jobId);
      
    } catch (e) {
      setPipelineState("failed");
      setErrorMsg(e instanceof Error ? e.message : "Error desconocido");
    }
  };

  const pollJobProgress = (jobId: string) => {
    activeJobRef.current = jobId;
    const poll = setInterval(async () => {
      if (activeJobRef.current !== jobId) {
        clearInterval(poll);
        return;
      }
      try {
        const res = await fetch(`/api/pipeline/job/${jobId}`);
        const data = await res.json();
        
        if (!res.ok) {
          clearInterval(poll);
          activeJobRef.current = null;
          setPipelineState("failed");
          setErrorMsg(data.error || "Error consultando job");
          return;
        }

        // Actualizar estado
        setProgress(data.progress);
        setStageLabel(data.message);
        setCurrentJobId(jobId);
        setQueuePosition(data.position);
        if (data.stage) setCheckpointStage(data.stage);

        // Si está en cola, mostrar posición
        if (data.status === "queued" && data.position != null) {
          setStageLabel(`En cola — posición ${data.position} — esperando worker...`);
          setProgress(3);
        } else if (data.status === "queued") {
          setStageLabel("En cola — esperando worker...");
          setProgress(3);
        }

        // Estados finales
        if (data.status === "completed") {
          clearInterval(poll);
          pollIntervalRef.current = null;
          // Mantener activeJobRef con el jobId completado para que refreshStatus no sobreescriba
          setPipelineState("completed");
          setProgress(100);
          const stagesArr: string[] = data.stages ?? [];
          const lastStage = stagesArr[stagesArr.length - 1] ?? data.stage ?? "etl";
          const nextMsg: Record<string, string> = {
            etl: "ETL completado ✓ — ahora lanzá Sentimiento",
            sentiment: "Sentimiento completado ✓ — ahora lanzá Intención",
            intent: "Intención completada ✓ — ahora lanzá Analyst",
            analyst: "Pipeline completo ✓",
          };
          setStageLabel(nextMsg[lastStage] ?? "Etapa completada ✓");
          setQueuePosition(null);
          refreshStatus();
        } else if (data.status === "failed") {
          clearInterval(poll);
          pollIntervalRef.current = null;
          activeJobRef.current = null;
          const { isRateLimit: rl, msg } = sanitizeError(data.error || "");
          setPipelineState(rl ? "rate_limited" : "failed");
          setErrorMsg(msg || data.message);
          setQueuePosition(null);
        }
      } catch {
        // Sigue intentando
      }
    }, 2000);
    pollIntervalRef.current = poll;
    
    setTimeout(() => {
      clearInterval(poll);
      pollIntervalRef.current = null;
      activeJobRef.current = null;
    }, 7200000);
  };

  const generateDemo = async () => {
    setGeneratingDemo(true);
    setDemoMsg("Generando corpus demo…");
    try {
      const res = await fetch("/api/pipeline/generate-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: demoSize }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setCorpusInUse(json.corpusFile);
      setDemoMsg(`✓ Corpus listo: ${json.corpusFile} (${(json.sizeBytes / 1024).toFixed(0)} KB). Ahora lanza Sentimiento.`);
    } catch (e) {
      setDemoMsg(e instanceof Error ? e.message : "Error generando demo");
    } finally {
      setGeneratingDemo(false);
    }
  };

  const runEvaluate = async () => {
    setErrorMsg("");
    await fetch("/api/pipeline/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corpus: corpusInUse }),
    });
    setStageLabel("Evaluación de calidad en curso…");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Pipeline datos" />} mainClassName="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1" style={{ fontSize: 13 }}>
        <Link
          href="/"
          style={{ color: colors.textSecondary, textDecoration: "none" }}
          className="hover:text-white transition-colors"
        >
          Dashboard
        </Link>
        <span style={{ color: colors.textSecondary, margin: "0 6px" }}>›</span>
        <span style={{ color: colors.textPrimary }}>Pipeline de análisis</span>
      </nav>

      {/* Page Header */}
      <div>
        <h1 style={{ color: colors.textPrimary, fontSize: 24, fontWeight: 700, margin: 0 }}>
          Pipeline de ingesta de datos
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: 14, margin: "6px 0 0 0" }}>
          Carga corpus de conversaciones y ejecuta el pipeline de análisis por etapas.
        </p>
        <p style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
          Checkpoint: <strong style={{ color: colors.accent }}>{checkpointStage}</strong> · Sentimiento:{" "}
          {dbStats.withSentiment.toLocaleString()} · Intención:{" "}
          {dbStats.withIntent.toLocaleString()} · Total:{" "}
          {dbStats.messagesTotal.toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Uploader */}
        <div className="xl:col-span-1 space-y-6">
          <div
            style={{
              backgroundColor: colors.card,
              backdropFilter: "blur(12px)",
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              padding: 24,
            }}
          >
            <h2 style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Database size={18} color={colors.accent} />
              Cargar corpus CSV
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 16, lineHeight: 1.4 }}>
              Sube un archivo CSV con conversaciones de clientes para procesar. 
              El formato debe incluir: session_id, usuario, fecha, region, intencion, nivel_frustracion, texto_espanol, texto_portugues.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              accept=".csv,.json"
              style={{ display: "none" }}
            />

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundColor: isDragging ? (isDark ? "rgba(16,185,129,0.1)" : "rgba(13,148,136,0.05)") : colors.background,
                border: `2px dashed ${isDragging ? colors.accent : colors.border}`,
                borderRadius: 12,
                padding: "40px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              className="hover:opacity-80"
            >
              <Upload size={32} color={isDragging ? colors.accent : colors.textMuted} style={{ marginBottom: 12 }} />
              <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>
                Arrastra tu archivo aquí
              </div>
              <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                o haz clic para seleccionar (CSV, JSON)
              </div>
            </div>

            {file && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <FileText size={24} color={colors.accent} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {file.name}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {formatBytes(file.size)} · Listo para procesar
                  </div>
                </div>
                {pipelineState === "completed" && <CheckCircle size={18} color={colors.success} />}
              </div>
            )}
          </div>

          {/* ── Action Panel ─────────────────────────────────────────────── */}
          <div
            style={{
              backgroundColor: colors.card,
              backdropFilter: "blur(12px)",
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              padding: 24,
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Brain size={16} color={colors.accent} />
                Ejecutar pipeline
              </h2>
              <p style={{ color: colors.textMuted, fontSize: 11, margin: "4px 0 0 0" }}>
                Corpus activo: <code style={{ color: colors.accent, fontSize: 10, background: isDark ? "rgba(0,196,154,0.1)" : "rgba(0,168,130,0.08)", padding: "1px 5px", borderRadius: 4 }}>{corpusInUse.split("/").pop()}</code>
              </p>
            </div>

            {/* ── Separador: ETAPAS INDIVIDUALES ─────────────────────────── */}
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, marginBottom: 10 }}>
              Etapas individuales
            </div>

            {/* Paso 1 — ETL (botón primario grande) */}
            <button
              type="button"
              onClick={() => launchStage("etl")}
              disabled={pipelineState === "processing"}
              style={{
                width: "100%",
                marginBottom: 6,
                padding: "12px 16px",
                borderRadius: 10,
                border: `1.5px solid ${colors.accent}`,
                background: isDark
                  ? "linear-gradient(135deg, rgba(0,196,154,0.22) 0%, rgba(0,196,154,0.10) 100%)"
                  : "linear-gradient(135deg, rgba(0,168,130,0.15) 0%, rgba(0,168,130,0.06) 100%)",
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: 700,
                cursor: pipelineState === "processing" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: pipelineState === "processing" ? 0.55 : 1,
                transition: "opacity 0.2s, transform 0.15s",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, backgroundColor: colors.accent, color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>1</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>Cargar y Preprocesar Corpus</div>
                <div style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1, fontWeight: 400 }}>ETL · Detecta idioma, normaliza y guarda en BD</div>
              </div>
              <Database size={14} color={colors.accent} style={{ flexShrink: 0 }} />
            </button>

            {/* Pasos 2–5 como tarjetas compactas */}
            {(
              [
                { step: 2, stage: "sentiment" as const,  label: "Clasificar Sentimiento",       sub: "LLM · Positivo / Negativo / Neutro",        icon: Brain,    accent: colors.accent },
                { step: 3, stage: "intent" as const,     label: "Clasificar Intención",          sub: "LLM · Detecta necesidad + estado resolución", icon: Target,   accent: colors.accent },
                { step: 4, stage: "embeddings" as const, label: "Vectorizar a Qdrant",           sub: "Cohere · Genera embeddings 1024-dim",         icon: Zap,      accent: "#a78bfa" },
                { step: 5, stage: "analyst" as const,    label: "Generar Reporte y Métricas",    sub: "KPIs · User Stories · Insights",             icon: BarChart3, accent: "#60a5fa" },
              ] as const
            ).map(({ step, stage, label, sub, icon: Icon, accent }) => (
              <button
                key={stage}
                type="button"
                onClick={() => launchStage(stage)}
                disabled={pipelineState === "processing"}
                style={{
                  width: "100%",
                  marginBottom: 6,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                  color: colors.textPrimary,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: pipelineState === "processing" ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: pipelineState === "processing" ? 0.55 : 1,
                  transition: "opacity 0.2s",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", color: accent, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{step}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, color: colors.textPrimary }}>{label}</div>
                  <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 1, fontWeight: 400 }}>{sub}</div>
                </div>
                <Icon size={13} color={accent} style={{ flexShrink: 0 }} />
              </button>
            ))}

            {/* ── Separador: ACCIONES ESPECIALES ─────────────────────────── */}
            <div style={{ height: 1, backgroundColor: colors.border, margin: "14px 0 12px" }} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, marginBottom: 10 }}>
              Acciones especiales
            </div>

            {/* Retomar ingesta */}
            <button
              type="button"
              onClick={() => launchStage("full")}
              disabled={pipelineState === "processing"}
              style={{
                width: "100%",
                marginBottom: 6,
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${isDark ? "rgba(245,166,35,0.35)" : "rgba(245,166,35,0.5)"}`,
                background: isDark ? "rgba(245,166,35,0.07)" : "rgba(245,166,35,0.05)",
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: 600,
                cursor: pipelineState === "processing" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: pipelineState === "processing" ? 0.55 : 1,
                transition: "opacity 0.2s",
                textAlign: "left",
              }}
            >
              <RefreshCw size={13} color="#f5a623" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>Retomar ingesta completa</div>
                <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>Ejecuta todas las etapas desde el principio</div>
              </div>
            </button>

            {/* Evaluate */}
            <button
              type="button"
              onClick={runEvaluate}
              disabled={pipelineState === "processing"}
              style={{
                width: "100%",
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: 500,
                cursor: pipelineState === "processing" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: pipelineState === "processing" ? 0.5 : 1,
              }}
            >
              <Sparkles size={12} color={colors.textMuted} />
              Actualizar métricas del modelo (evaluate)
            </button>

            {errorMsg && (
              <div style={{ color: colors.error, fontSize: 11, marginTop: 12, padding: "8px 12px", borderRadius: 8, backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {errorMsg}
              </div>
            )}

            {/* Live Status Panel */}
            <LiveStatusPanel
              pipelineState={pipelineState}
              checkpointStage={checkpointStage}
              dbStats={dbStats}
              stageLabel={stageLabel}
              progress={progress}
              lastRefresh={lastRefresh}
              corpusInUse={corpusInUse}
              colors={colors}
              isDark={isDark}
              onRefresh={refreshStatus}
              queuePosition={queuePosition}
              currentJobId={currentJobId}
            />
          </div>
        </div>

        {/* Right Column: Data Preview */}
        <div className="xl:col-span-2">
          <div
            style={{
              backgroundColor: colors.card,
              backdropFilter: "blur(12px)",
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              padding: 24,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 600 }}>
                Vista Previa de Datos
              </h2>
              {file && (
                <span style={{ color: colors.textSecondary, fontSize: 12, backgroundColor: colors.background, padding: "4px 10px", borderRadius: 12 }}>
                  Mostrando primeras {previewData?.rows?.length || 0} filas
                </span>
              )}
            </div>

            {!file ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textMuted, fontSize: 13, minHeight: 300, border: `1px dashed ${colors.border}`, borderRadius: 8 }}>
                Sube un archivo para ver la vista previa.
              </div>
            ) : !previewData ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 13, minHeight: 300 }}>
                Analizando archivo...
              </div>
            ) : (
              <div style={{ overflowX: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                      {previewData.headers.map((h, i) => (
                        <th key={i} style={{ textAlign: "left", padding: "12px 16px", color: colors.textSecondary, fontWeight: 600, whiteSpace: "nowrap", backgroundColor: colors.background }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} style={{ borderBottom: `1px solid ${colors.border}` }} className="hover:bg-slate-800/30">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} style={{ padding: "12px 16px", color: colors.textPrimary, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Estado completo de la ingesta ──────────────────────────────── */}
      <div
        style={{
          backgroundColor: colors.card,
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={16} color={colors.accent} />
            <h2 style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>
              Estado de la ingesta
            </h2>
          </div>
          <button
            onClick={fetchFullStatus}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
          >
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>

        {loadingFull ? (
          <p style={{ color: colors.textMuted, fontSize: 12 }}>Cargando estado…</p>
        ) : !pipelineFull ? (
          <p style={{ color: colors.textMuted, fontSize: 12 }}>Sin datos de pipeline.</p>
        ) : (() => {
          const { db, qdrant, stage, status, corpusFile, run } = pipelineFull;
          const STAGE_ORDER = ["etl", "sentiment", "intent", "embeddings", "analyst", "completed"];
          const currentIdx = STAGE_ORDER.indexOf(stage);
          const isCompleted = stage === "completed";
          const isFailed = status === "failed";

          const pct = (count: number, total: number) =>
            total > 0 ? Math.round((count / total) * 100) : 0;

          const statCards = [
            {
              label: "Mensajes en BD",
              value: db.messagesTotal.toLocaleString("es-AR"),
              sub: "total cargados",
              color: colors.textPrimary,
              filled: db.messagesTotal,
              total: db.messagesTotal,
            },
            {
              label: "Con sentimiento",
              value: db.withSentiment.toLocaleString("es-AR"),
              sub: `${pct(db.withSentiment, db.messagesTotal)}% clasificados`,
              color: db.withSentiment === db.messagesTotal && db.messagesTotal > 0 ? "#22c55e" : colors.accent,
              filled: db.withSentiment,
              total: db.messagesTotal,
            },
            {
              label: "Con intención",
              value: db.withIntent.toLocaleString("es-AR"),
              sub: `${pct(db.withIntent, db.messagesTotal)}% enriquecidos`,
              color: db.withIntent === db.messagesTotal && db.messagesTotal > 0 ? "#22c55e" : colors.accent,
              filled: db.withIntent,
              total: db.messagesTotal,
            },
            {
              label: "Vectores Qdrant",
              value: qdrant.points.toLocaleString("es-AR"),
              sub: qdrant.collection,
              color: qdrant.points > 0 ? "#22c55e" : colors.textMuted,
              filled: qdrant.points,
              total: Math.max(qdrant.points, db.messagesTotal),
            },
          ];

          return (
            <>
              {/* Cards métricas */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                {statCards.map(({ label, value, sub, color, filled, total }) => (
                  <div
                    key={label}
                    style={{
                      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                      borderRadius: 10,
                      padding: "12px 14px",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div style={{ fontSize: 9, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                    <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 8 }}>{sub}</div>
                    {/* Mini progress bar */}
                    <div style={{ height: 3, borderRadius: 2, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${total > 0 ? Math.round((filled / total) * 100) : 0}%`,
                          backgroundColor: color,
                          borderRadius: 2,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Banner estado actual */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8, marginBottom: 16,
                  backgroundColor: isCompleted ? "rgba(34,197,94,0.07)" : isFailed ? "rgba(239,68,68,0.07)" : "rgba(245,166,35,0.07)",
                  border: `1px solid ${isCompleted ? "rgba(34,197,94,0.25)" : isFailed ? "rgba(239,68,68,0.25)" : "rgba(245,166,35,0.25)"}`,
                }}
              >
                {isCompleted
                  ? <CheckCircle size={14} color="#22c55e" />
                  : isFailed
                    ? <Sparkles size={14} color="#ef4444" />
                    : <Activity size={14} color="#f5a623" style={{ animation: "spin 2s linear infinite" }} />
                }
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.textPrimary }}>
                    {isCompleted ? "Pipeline completado" : isFailed ? "Pipeline fallido" : `En progreso — etapa: `}
                    {!isCompleted && !isFailed && (
                      <code style={{ color: colors.accent, fontSize: 11 }}>{stage}</code>
                    )}
                  </span>
                  {corpusFile && (
                    <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 8 }}>
                      — <code style={{ fontSize: 10 }}>{corpusFile.split("/").pop()}</code>
                    </span>
                  )}
                </div>
                {run?.started_at && (
                  <span style={{ fontSize: 10, color: colors.textMuted, display: "flex", alignItems: "center", gap: 3 }}>
                    <Clock size={9} />
                    {new Date(run.started_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              {/* Barra de etapas */}
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                {["etl", "sentiment", "intent", "embeddings", "analyst"].map((s, idx, arr) => {
                  const thisIdx = STAGE_ORDER.indexOf(s);
                  const done = isCompleted || currentIdx > thisIdx;
                  const active = stage === s && !isCompleted && !isFailed;
                  return (
                    <React.Fragment key={s}>
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 11px", borderRadius: 6,
                          backgroundColor: done ? "rgba(34,197,94,0.1)" : active ? `${colors.accent}18` : isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9",
                          border: `1px solid ${done ? "rgba(34,197,94,0.3)" : active ? colors.accent + "50" : colors.border}`,
                          fontSize: 11,
                          color: done ? "#22c55e" : active ? colors.accent : colors.textMuted,
                          fontWeight: done || active ? 600 : 400,
                          transition: "all 0.3s ease",
                        }}
                      >
                        {done
                          ? <CheckCircle size={10} color="#22c55e" />
                          : active
                            ? <Sparkles size={10} color={colors.accent} />
                            : <Clock size={10} />
                        }
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </div>
                      {idx < arr.length - 1 && (
                        <span style={{ color: done ? "#22c55e" : colors.border, fontSize: 12, fontWeight: done ? 700 : 400 }}>›</span>
                      )}
                    </React.Fragment>
                  );
                })}
                {/* Completed badge */}
                <span style={{ color: colors.border, fontSize: 12 }}>›</span>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 11px", borderRadius: 6,
                    backgroundColor: isCompleted ? "rgba(34,197,94,0.15)" : isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9",
                    border: `1px solid ${isCompleted ? "rgba(34,197,94,0.4)" : colors.border}`,
                    fontSize: 11,
                    color: isCompleted ? "#22c55e" : colors.textMuted,
                    fontWeight: isCompleted ? 700 : 400,
                  }}
                >
                  <CheckCircle size={10} color={isCompleted ? "#22c55e" : colors.textMuted} />
                  Listo
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Historial de corpus ingestados ───────────────────────────── */}
      <div
        style={{
          backgroundColor: colors.card,
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={16} color={colors.accent} />
            <h2 style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>
              Historial de corpus ingestados
            </h2>
          </div>
          <button
            onClick={fetchHistory}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
          >
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>

        {loadingHistory ? (
          <p style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Cargando historial…</p>
        ) : historyRuns.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin corridas registradas.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  {["Corpus", "Estado", "Mensajes", "Iniciado", "Finalizado", "Duración"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: colors.textMuted, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyRuns.map((run, i) => {
                  const started = run.started_at ? new Date(run.started_at) : null;
                  const completed = run.completed_at ? new Date(run.completed_at) : null;
                  const durationMs = started && completed ? completed.getTime() - started.getTime() : null;
                  const durationStr = durationMs !== null
                    ? durationMs > 60000
                      ? `${Math.round(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`
                      : `${Math.round(durationMs / 1000)}s`
                    : "—";

                  const statusColor = run.status === "completed" ? "#22c55e"
                    : run.status === "failed" ? "#ef4444"
                    : run.status === "running" ? colors.accent
                    : colors.textMuted;
                  const statusBg = run.status === "completed" ? "rgba(34,197,94,0.1)"
                    : run.status === "failed" ? "rgba(239,68,68,0.1)"
                    : run.status === "running" ? `${colors.accent}15`
                    : isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9";
                  const statusLabel = run.status === "completed" ? "Completado"
                    : run.status === "failed" ? "Fallido"
                    : run.status === "running" ? "En curso"
                    : run.status === "queued" ? "En cola"
                    : run.status ?? "—";

                  return (
                    <tr
                      key={run.id}
                      style={{ borderBottom: i < historyRuns.length - 1 ? `1px solid ${colors.border}` : "none" }}
                    >
                      <td style={{ padding: "10px 12px", color: colors.textPrimary, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span title={run.corpus_file}>
                          {run.corpus_name}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ backgroundColor: statusBg, color: statusColor, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
                          {statusLabel}
                        </span>
                        {run.error_message && (
                          <span title={run.error_message} style={{ marginLeft: 6, color: "#ef4444", fontSize: 10, cursor: "help" }}>⚠️</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                        {run.total_messages != null ? run.total_messages.toLocaleString("es-AR") : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textMuted, whiteSpace: "nowrap" }}>
                        {started ? started.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textMuted, whiteSpace: "nowrap" }}>
                        {completed ? completed.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: colors.textMuted, fontVariantNumeric: "tabular-nums" }}>
                        {durationStr}
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

