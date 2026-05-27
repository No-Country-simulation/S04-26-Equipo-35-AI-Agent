import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { supabase } from "@src/lib/supabaseClient";

export const runtime = "nodejs";
export const maxDuration = 60;

const AGENTES_DIR = path.join(process.cwd(), "Agentes");
const DEFAULT_CORPUS = "data/raw/data_conversa_ai.csv";
const CHECKPOINT_PATH = path.join(AGENTES_DIR, "data", "raw", "ingestion_checkpoint.json");

type PipelineStage = "etl" | "sentiment" | "intent" | "analyst" | "full";

async function readCheckpoint(): Promise<{ stage: string; corpus_path: string }> {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { stage: "etl", corpus_path: "" };
  }
}

async function writeCheckpoint(stage: string, corpusRelative: string) {
  const abs = path.join(AGENTES_DIR, corpusRelative);
  await fs.mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true });
  await fs.writeFile(
    CHECKPOINT_PATH,
    JSON.stringify({ stage, corpus_path: abs }, null, 2),
    "utf-8"
  );
}

function buildSpawnArgs(opts: {
  corpusRelative: string;
  stage: PipelineStage;
  skipEtl: boolean;
  smartRecommendations: boolean;
}): string[] {
  const args = [
    "run",
    "python",
    "-m",
    "src.cli",
    "ingest",
    "--corpus",
    opts.corpusRelative,
    "--use-db",
  ];

  if (opts.smartRecommendations) {
    args.push("--smart-recommendations");
  }

  const skipEtl =
    opts.skipEtl || (opts.stage !== "etl" && opts.stage !== "full");
  if (skipEtl) {
    args.push("--skip-etl");
  }

  if (opts.stage !== "full" && opts.stage !== "etl") {
    args.push("--from-stage", opts.stage);
  }

  return args;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let stage: PipelineStage = "full";
    let corpusRelative = DEFAULT_CORPUS;
    let skipEtl = false;
    let smartRecommendations = true;
    let uploadedFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      uploadedFile = formData.get("file") as File | null;
      const stageField = formData.get("stage");
      if (typeof stageField === "string" && stageField) {
        stage = stageField as PipelineStage;
      }
      const corpusField = formData.get("corpus");
      if (typeof corpusField === "string" && corpusField) {
        corpusRelative = corpusField;
      }
      skipEtl = formData.get("skipEtl") === "true";
      smartRecommendations = formData.get("smartRecommendations") !== "false";
    } else {
      const body = await req.json();
      stage = (body.stage as PipelineStage) ?? "full";
      corpusRelative = body.corpus ?? DEFAULT_CORPUS;
      skipEtl = Boolean(body.skipEtl);
      smartRecommendations = body.smartRecommendations !== false;
    }

    if (uploadedFile && uploadedFile instanceof File) {
      if (!uploadedFile.name.endsWith(".csv")) {
        return NextResponse.json({ error: "Solo se aceptan archivos .csv" }, { status: 400 });
      }
      const rawDir = path.join(AGENTES_DIR, "data", "raw");
      await fs.mkdir(rawDir, { recursive: true });
      const timestamp = Date.now();
      const filename = `upload_${timestamp}.csv`;
      const corpusPath = path.join(rawDir, filename);
      const buffer = Buffer.from(await uploadedFile.arrayBuffer());
      await fs.writeFile(corpusPath, buffer);
      corpusRelative = `data/raw/${filename}`;
      if (stage === "full") {
        stage = "etl";
      }
    } else {
      const cp = await readCheckpoint();
      if (cp.corpus_path) {
        const idx = cp.corpus_path.indexOf("data/raw/");
        corpusRelative =
          idx >= 0 ? cp.corpus_path.slice(idx) : corpusRelative || DEFAULT_CORPUS;
      }
    }

    const absCorpus = path.join(AGENTES_DIR, corpusRelative);
    try {
      await fs.access(absCorpus);
    } catch {
      return NextResponse.json(
        { error: `Corpus no encontrado: ${corpusRelative}` },
        { status: 400 }
      );
    }

    if (stage !== "full" && stage !== "etl") {
      await writeCheckpoint(stage, corpusRelative);
    }

    const { data: runRow, error: insertError } = await supabase
      .from("pipeline_runs")
      .insert({
        corpus_file: corpusRelative,
        status: "running",
        total_messages: 0,
      })
      .select("id")
      .single();

    if (insertError) {
      console.warn("pipeline_runs insert:", insertError.message);
    }

    const timestamp = Date.now();
    const logPath = path.join(AGENTES_DIR, "data", "processed", `pipeline_${timestamp}.log`);
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    const logFd = await fs.open(logPath, "a");

    const spawnArgs = buildSpawnArgs({
      corpusRelative,
      stage,
      skipEtl,
      smartRecommendations,
    });

    const child = spawn("uv", spawnArgs, {
      cwd: AGENTES_DIR,
      detached: true,
      stdio: ["ignore", logFd.fd, logFd.fd],
      env: { ...process.env },
    });
    child.unref();
    await logFd.close();

    return NextResponse.json({
      ok: true,
      runId: runRow?.id ?? null,
      corpusFile: corpusRelative,
      stage,
      skipEtl: skipEtl || stage !== "etl",
      logFile: `data/processed/pipeline_${timestamp}.log`,
      message: `Pipeline iniciado (${stage})`,
    });
  } catch (e) {
    console.error("pipeline/start:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al iniciar pipeline" },
      { status: 500 }
    );
  }
}
