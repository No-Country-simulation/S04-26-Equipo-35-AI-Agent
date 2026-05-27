export type RegionMetrics = {
  lang: string;
  n: number;
  intent_accuracy: number | null;
  sentiment_agreement: number | null;
  sentiment_delta?: number;
  intent_delta?: number;
};

export type ModelEvaluationReport = {
  evaluated_at?: string;
  corpus_path?: string;
  source?: string;
  rows_evaluated?: number;
  rows_with_labels?: number;
  coverage_pct?: number;
  intent_accuracy?: number;
  sentiment_agreement?: number;
  low_confidence_pct?: number;
  per_intent_accuracy?: Record<string, { accuracy: number; n: number }>;
  by_region?: Record<string, RegionMetrics>;
  sentiment_breakdown?: Record<
    string,
    Record<string, { agreement: number | null; n: number }>
  >;
  alerts?: string[];
  previous?: {
    period?: string;
    intent_accuracy?: number;
    sentiment_agreement?: number;
  };
  error?: string;
};

export type ModelMetricsHistoryPoint = {
  period: string;
  intent_accuracy: number | null;
  sentiment_agreement: number | null;
};

export type PipelineRun = {
  id: number;
  started_at: string | null;
  completed_at: string | null;
  corpus_file: string;
  total_messages: number;
  total_sessions: number;
  status: "running" | "completed" | "failed";
  error_message: string | null;
};

export type ModelMetricsData = {
  available: boolean;
  message?: string;
  report: ModelEvaluationReport | null;
  history: ModelMetricsHistoryPoint[];
  totalMessages: number;
  coverage: {
    messagesTotal: number;
    withSentiment: number;
    withIntent: number;
  };
  runs: PipelineRun[];
};

export function formatIntentLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
