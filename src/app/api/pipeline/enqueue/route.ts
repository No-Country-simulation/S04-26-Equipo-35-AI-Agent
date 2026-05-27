import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";
import { supabase } from "@src/lib/supabaseClient";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 30;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";
const QUEUE_NAME = "jobs:pending";
const AGENTES_DIR = path.join(process.cwd(), "Agentes");

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

type PipelineStage = "etl" | "sentiment" | "intent" | "embeddings" | "analyst" | "full";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let stages: PipelineStage[] = ["etl", "sentiment", "intent", "analyst"];
    let corpusRelative = "data/raw/data_conversa_ai.csv";
    let uploadedFile: File | null = null;
    let smartRecommendations = true;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      uploadedFile = formData.get("file") as File | null;
      
      const stageField = formData.get("stage");
      if (typeof stageField === "string" && stageField) {
        if (stageField === "full") {
          stages = ["etl", "sentiment", "intent", "analyst"];
        } else {
          stages = [stageField as PipelineStage];
        }
      }
      
      const corpusField = formData.get("corpus");
      if (typeof corpusField === "string" && corpusField) {
        corpusRelative = corpusField;
      }
      
      smartRecommendations = formData.get("smartRecommendations") !== "false";
    } else {
      const body = await req.json();
      
      if (body.stage === "full") {
        stages = ["etl", "sentiment", "intent", "analyst"];
      } else if (body.stage) {
        stages = [body.stage as PipelineStage];
      }
      
      corpusRelative = body.corpus ?? corpusRelative;
      smartRecommendations = body.smartRecommendations !== false;
    }

    // Guardar archivo subido si existe
    if (uploadedFile && uploadedFile instanceof File) {
      if (!uploadedFile.name.endsWith(".csv")) {
        return NextResponse.json(
          { error: "Solo se aceptan archivos .csv" },
          { status: 400 }
        );
      }
      
      const rawDir = path.join(AGENTES_DIR, "data", "raw");
      await fs.mkdir(rawDir, { recursive: true });
      
      const timestamp = Date.now();
      const filename = `upload_${timestamp}.csv`;
      const corpusPath = path.join(rawDir, filename);
      const buffer = Buffer.from(await uploadedFile.arrayBuffer());
      await fs.writeFile(corpusPath, buffer);
      
      corpusRelative = `data/raw/${filename}`;
    }

    // Verificar que el corpus existe
    const absCorpus = path.join(AGENTES_DIR, corpusRelative);
    try {
      await fs.access(absCorpus);
    } catch {
      return NextResponse.json(
        { error: `Corpus no encontrado: ${corpusRelative}` },
        { status: 400 }
      );
    }

    // Generar ID único para el job
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Crear job
    const job = {
      id: jobId,
      corpus: absCorpus,
      corpusRelative,
      stages,
      smartRecommendations,
      status: "queued",
      retries: 0,
      createdAt: new Date().toISOString(),
    };

    // Conectar a Redis y encolar
    const redis = await getRedis();
    
    // Guardar estado inicial del job (Redis solo acepta strings)
    await redis.hSet(`job:${jobId}`, {
      id: jobId,
      corpus: absCorpus,
      corpusRelative,
      stages: JSON.stringify(stages),
      smartRecommendations: String(smartRecommendations),
      status: "queued",
      retries: "0",
      createdAt: new Date().toISOString(),
      progress: "0",
      message: "En cola, esperando worker...",
    });
    
    // Agregar a la cola
    await redis.lPush(QUEUE_NAME, JSON.stringify(job));

    // Registrar en Supabase para historial
    await supabase.from("pipeline_runs").insert({
      corpus_file: corpusRelative,
      status: "queued",
      job_id: jobId,
    });

    // Obtener posición en cola
    const queueLength = await redis.lLen(QUEUE_NAME);

    return NextResponse.json({
      ok: true,
      jobId,
      status: "queued",
      position: queueLength,
      corpusFile: corpusRelative,
      stages,
      message: `Job encolado. Posición: ${queueLength}`,
    });

  } catch (e) {
    console.error("pipeline/enqueue:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al encolar job" },
      { status: 500 }
    );
  }
}

// GET: Listar jobs en cola y procesando
export async function GET() {
  try {
    const redis = await getRedis();
    
    // Obtener jobs pendientes
    const pending = await redis.lRange(QUEUE_NAME, 0, -1);
    const processing = await redis.lRange("jobs:processing", 0, -1);
    const completed = await redis.lRange("jobs:completed", 0, 9); // últimos 10
    
    // Parsear y obtener info adicional de jobs en proceso
    const processingJobs = await Promise.all(
      processing.map(async (jobStr: string) => {
        const job = JSON.parse(jobStr);
        const status = await redis.hGetAll(`job:${job.id}`);
        return { ...job, status };
      })
    );

    return NextResponse.json({
      queue: {
        pending: pending.length,
        processing: processing.length,
        completed: completed.length,
      },
      jobs: {
        pending: pending.map((j: string) => JSON.parse(j)),
        processing: processingJobs,
        completed: completed.map((j: string) => JSON.parse(j)),
      },
    });

  } catch (e) {
    console.error("pipeline/enqueue GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al obtener jobs" },
      { status: 500 }
    );
  }
}
