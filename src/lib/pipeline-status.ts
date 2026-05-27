import { supabase } from "./supabaseClient";
import fs from "fs/promises";
import path from "path";

export type PipelineStatus = {
  status: string;
  stage: string;
  corpusFile: string | null;
};

const CHECKPOINT_PATH = path.join(
  process.cwd(),
  "Agentes",
  "data",
  "raw",
  "ingestion_checkpoint.json"
);

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  let stage = "idle";
  let corpusFile: string | null = null;

  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, "utf-8");
    const cp = JSON.parse(raw) as { stage?: string; corpus_path?: string };
    stage = cp.stage ?? "idle";
    corpusFile = cp.corpus_path ? path.basename(cp.corpus_path) : null;
  } catch {
    // sin checkpoint local
  }

  const { data: runs } = await supabase
    .from("pipeline_runs")
    .select("status, corpus_file")
    .order("started_at", { ascending: false })
    .limit(1);

  const latest = runs?.[0];
  const status =
    latest?.status === "running"
      ? "running"
      : latest?.status === "failed"
        ? "failed"
        : stage === "completed"
          ? "completed"
          : stage !== "idle"
            ? "partial"
            : "idle";

  if (!corpusFile && latest?.corpus_file) {
    corpusFile = String(latest.corpus_file);
  }

  return { status, stage, corpusFile };
}
