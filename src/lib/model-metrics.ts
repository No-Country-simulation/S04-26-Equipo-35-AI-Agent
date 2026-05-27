import { supabase } from "./supabaseClient";
import fs from "fs/promises";
import path from "path";
import type {
  ModelEvaluationReport,
  ModelMetricsData,
  ModelMetricsHistoryPoint,
  PipelineRun,
} from "./model-metrics-types";

export type {
  ModelEvaluationReport,
  ModelMetricsData,
  ModelMetricsHistoryPoint,
  RegionMetrics,
  PipelineRun,
} from "./model-metrics-types";
export { formatIntentLabel } from "./model-metrics-types";

const REPORT_PATH = path.join(
  process.cwd(),
  "Agentes",
  "data",
  "processed",
  "evaluation_report.json"
);

async function loadReportFromFile(): Promise<ModelEvaluationReport | null> {
  try {
    const raw = await fs.readFile(REPORT_PATH, "utf-8");
    return JSON.parse(raw) as ModelEvaluationReport;
  } catch {
    return null;
  }
}

async function loadReportFromSupabase(): Promise<ModelEvaluationReport | null> {
  const { data, error } = await supabase
    .from("metrics_snapshots")
    .select("metrics_json, period, created_at")
    .order("period", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  const ev = (data[0].metrics_json as Record<string, unknown>)?.model_evaluation;
  return (ev as ModelEvaluationReport) ?? null;
}

async function loadHistory(): Promise<ModelMetricsHistoryPoint[]> {
  const { data } = await supabase
    .from("metrics_snapshots")
    .select("period, metrics_json")
    .order("period", { ascending: true })
    .limit(12);

  const points: ModelMetricsHistoryPoint[] = [];
  for (const row of data ?? []) {
    const ev = (row.metrics_json as Record<string, unknown>)?.model_evaluation as
      | ModelEvaluationReport
      | undefined;
    if (ev?.intent_accuracy != null || ev?.sentiment_agreement != null) {
      points.push({
        period: row.period,
        intent_accuracy: ev.intent_accuracy ?? null,
        sentiment_agreement: ev.sentiment_agreement ?? null,
      });
    }
  }
  return points;
}

export async function fetchModelMetrics(): Promise<ModelMetricsData> {
  const { count: totalCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true });

  const { count: sentimentCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .not("sentiment_label", "is", null);

  const { count: intentCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .not("intent_label", "is", null);

  const { data: runsData } = await supabase
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5);

  const runs: PipelineRun[] = (runsData ?? []).map((r) => ({
    id: r.id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    corpus_file: r.corpus_file,
    total_messages: r.total_messages ?? 0,
    total_sessions: r.total_sessions ?? 0,
    status: r.status,
    error_message: r.error_message,
  }));

  const coverage = {
    messagesTotal: totalCount ?? 0,
    withSentiment: sentimentCount ?? 0,
    withIntent: intentCount ?? 0,
  };

  let report = await loadReportFromSupabase();
  if (!report || report.error) {
    report = await loadReportFromFile();
  }

  const history = await loadHistory();

  if (!report || report.error) {
    return {
      available: false,
      message:
        report?.error ??
        "Ejecuta la evaluación con el CLI (--from-db) tras tener labels en Supabase.",
      report: null,
      history,
      totalMessages: totalCount ?? 0,
      coverage,
      runs,
    };
  }

  const hasMetrics =
    (report.rows_with_labels ?? 0) > 0 &&
    (report.coverage_pct ?? 0) > 0 &&
    report.intent_accuracy != null;

  return {
    available: hasMetrics,
    message: hasMetrics
      ? undefined
      : "Hay evaluación guardada pero sin labels del pipeline aún (termina sentiment/intent).",
    report,
    history,
    totalMessages: totalCount ?? 0,
    coverage,
    runs,
  };
}
