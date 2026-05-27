import { NextResponse } from "next/server";
import { supabase } from "@src/lib/supabaseClient";

export const runtime = "nodejs";

/**
 * GET /api/pipeline/history
 * Devuelve los últimos N runs del pipeline desde Supabase (tabla pipeline_runs).
 * Incluye corpus_file, status, total_messages, started_at, completed_at.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  const { data, error } = await supabase
    .from("pipeline_runs")
    .select("id, corpus_file, status, total_messages, total_sessions, started_at, completed_at, error_message")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Normalizar el corpus_file para mostrar solo el nombre del archivo
  const runs = (data ?? []).map((run) => ({
    ...run,
    corpus_name: run.corpus_file
      ? run.corpus_file.split("/").pop() ?? run.corpus_file
      : "—",
  }));

  return NextResponse.json({ runs, total: runs.length });
}
