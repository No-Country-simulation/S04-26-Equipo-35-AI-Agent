import { NextResponse } from "next/server";
import { supabase } from "@src/lib/supabaseClient";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const CHECKPOINT = path.join(process.cwd(), "Agentes", "data", "raw", "ingestion_checkpoint.json");
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? "conversaai_messages";

async function getQdrantPoints(): Promise<number> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 0;
    const json = await res.json() as { result?: { points_count?: number } };
    return json?.result?.points_count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const { data: runs, error } = await supabase
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const latest = runs?.[0] ?? null;

  let checkpoint: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(CHECKPOINT, "utf-8");
    checkpoint = JSON.parse(raw);
  } catch {
    checkpoint = null;
  }

  const stage = (checkpoint?.stage as string) ?? "idle";
  const derivedStatus =
    latest?.status === "running"
      ? stage === "completed"
        ? "completed"
        : "running"
      : latest?.status ?? "idle";

  // Supabase counts + Qdrant points (all in parallel)
  const [totalRes, sentRes, intentRes, qdrantPoints] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }).not("sentiment_label", "is", null),
    supabase.from("messages").select("id", { count: "exact", head: true }).not("intent_label", "is", null),
    getQdrantPoints(),
  ]);

  const corpusPath = (checkpoint?.corpus_path as string) ?? "";
  const corpusFile =
    corpusPath.indexOf("data/raw/") >= 0
      ? corpusPath.slice(corpusPath.indexOf("data/raw/"))
      : null;

  return NextResponse.json({
    run: latest,
    checkpoint,
    status: derivedStatus,
    stage,
    corpusFile,
    db: {
      messagesTotal: totalRes.count ?? 0,
      withSentiment: sentRes.count ?? 0,
      withIntent: intentRes.count ?? 0,
    },
    qdrant: {
      collection: QDRANT_COLLECTION,
      points: qdrantPoints,
    },
  });
}
