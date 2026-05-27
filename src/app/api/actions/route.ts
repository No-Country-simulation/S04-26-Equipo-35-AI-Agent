import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("action_items")
      .select("*")
      .order("impact_score", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = getSupabase();

    const { data, error } = await sb
      .from("action_items")
      .insert({
        title: body.title,
        description: body.description ?? "",
        source_type: body.source_type ?? "manual",
        source_id: body.source_id ?? null,
        severity: body.severity ?? "medium",
        impact_score: body.impact_score ?? 0,
        status: body.status ?? "detected",
        assignee: body.assignee ?? null,
        notes: body.notes ?? null,
        is_suggestion: body.is_suggestion ?? false,
        corpus_run_id: body.corpus_run_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
