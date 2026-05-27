/**
 * Supabase Client — Conexión al backend PostgreSQL desde el Dashboard.
 *
 * Uso en componentes:
 *   import { supabase } from "@src/lib/supabase";
 *   const { data } = await supabase.from("sessions").select("*");
 *
 * Uso en Server Components (Next.js App Router):
 *   import { createServerSupabase } from "@src/lib/supabase";
 *   const sb = createServerSupabase();
 */
import { createClient } from "@supabase/supabase-js";

// ── Tipos de las tablas (referencia) ────────────────────────────────────────
// Basados en el CSV real: data_conversa_ai.csv

export interface Session {
  id: string; // SESS-14614
  usuario: string | null; // @miniKittyLuna
  region: "LATAM" | "BRAZIL" | "EUROPE" | null;
  total_turns: number;
  created_at: string;
  avg_frustration_score: number | null;
  max_frustration_score: number | null;
  has_escalation: boolean;
  has_abandonment: boolean;
  dominant_intent: string | null;
  resolution_rate: number | null;
  is_churn_risk: boolean;
}

export interface Message {
  id: number;
  session_id: string;
  turn_id: number;
  fecha: string | null;
  region: "LATAM" | "BRAZIL" | "EUROPE" | null;

  // Textos originales bilingües del CSV
  texto_espanol: string | null;
  texto_portugues: string | null;
  text_clean: string | null;

  // Datos originales del CSV
  intencion_original: string | null; // logistica_envio, problema_pago
  nivel_frustracion: number | null; // 0, 1, 2
  es_churn_risk: boolean;

  // Campos del Sentiment Agent
  sentiment_label: "frustrado" | "neutro" | "satisfecho" | null;
  sentiment_score: number | null;
  escalation: boolean;
  abandonment_risk: boolean;

  // Campos del Intent Agent
  intent_label: string | null;
  intent_confidence: number | null;
  resolved: boolean | null;

  qdrant_point_id: string | null;
}

export interface MetricsSnapshot {
  id: number;
  period: string;
  created_at: string;
  metrics_json: Record<string, unknown>;
}

export interface PipelineRun {
  id: number;
  started_at: string;
  completed_at: string | null;
  corpus_file: string;
  total_messages: number;
  total_sessions: number;
  status: "running" | "completed" | "failed";
  error_message: string | null;
}

export interface UserStory {
  id: number;
  story_id: string;
  period: string;
  priority: "P1" | "P2" | "P3";
  severity: "crítico" | "alto" | "medio";
  intent: string;
  title: string;
  user_story: string;
  acceptance_criteria: string | null;
  success_metric: string | null;
  affected_sessions: number;
  current_unresolved_pct: number;
  current_avg_frustration: number;
  status: "backlog" | "in_progress" | "done" | "dismissed";
  created_at: string;
}

// ── Tipo de la base de datos ────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      sessions: { Row: Session };
      messages: { Row: Message };
      metrics_snapshots: { Row: MetricsSnapshot };
      pipeline_runs: { Row: PipelineRun };
      user_stories: { Row: UserStory };
    };
  };
}

// ── Cliente singleton para el browser ───────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ── Factory para Server Components ──────────────────────────────────────────

export function createServerSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
