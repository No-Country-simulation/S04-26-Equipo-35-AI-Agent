import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@src/lib/supabaseClient";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { intentKey, name, sessionCount, frustration } = body as {
    intentKey: string;
    name: string;
    sessionCount: number;
    frustration: number;
  };

  if (!intentKey || !name) {
    return NextResponse.json({ error: "intentKey y name son requeridos" }, { status: 400 });
  }

  const period = new Date().toISOString().slice(0, 7);
  const storyId = `US-${period}-${intentKey.toUpperCase().replace(/_/g, "-")}`;

  const severity: "crítico" | "alto" | "medio" =
    frustration >= 75 ? "crítico" : frustration >= 50 ? "alto" : "medio";
  const priority: "P1" | "P2" | "P3" =
    frustration >= 75 ? "P1" : frustration >= 50 ? "P2" : "P3";

  const newStory = {
    story_id: storyId,
    period,
    priority,
    severity,
    intent: intentKey,
    title: `Resolver intención sin atender: ${name}`,
    user_story: `Como cliente con intención "${name}", quiero que el asistente pueda resolver mi consulta sin necesidad de escalar a un agente humano.`,
    acceptance_criteria: `El asistente resuelve el ${Math.round((1 - frustration / 100) * 100 + 20)}% de las sesiones con intención "${name}" sin escalamiento.`,
    success_metric: `IRR de "${name}" supera 70% en el siguiente período.`,
    affected_sessions: sessionCount,
    current_unresolved_pct: 100,
    current_avg_frustration: frustration / 100,
    status: "backlog",
  };

  const { data, error } = await supabase
    .from("user_stories")
    .upsert(newStory, { onConflict: "story_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, story: data }, { status: 201 });
}
