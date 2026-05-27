import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";

export const runtime = "nodejs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const redis = await getRedis();
    
    // Obtener estado del job
    const jobData = await redis.hGetAll(`job:${id}`);
    
    if (!jobData || Object.keys(jobData).length === 0) {
      return NextResponse.json(
        { error: "Job no encontrado" },
        { status: 404 }
      );
    }

    // Parsear campos JSON
    const stages = jobData.stages ? JSON.parse(jobData.stages) : [];
    const stats = jobData.stats ? JSON.parse(jobData.stats) : null;
    
    // Calcular posición en cola si está pendiente
    let position = null;
    if (jobData.status === "queued") {
      const pending = await redis.lRange("jobs:pending", 0, -1);
      const index = pending.findIndex(j => JSON.parse(j).id === id);
      position = index >= 0 ? index + 1 : null;
    }

    return NextResponse.json({
      jobId: id,
      status: jobData.status,
      stage: jobData.current_stage || jobData.stage,
      progress: parseInt(jobData.progress || "0"),
      message: jobData.message || "Procesando...",
      position,
      corpusFile: jobData.corpusRelative,
      stages,
      stats,
      createdAt: jobData.createdAt,
      updatedAt: jobData.updated_at,
      completedAt: jobData.completed_at || null,
      error: jobData.error || null,
    });

  } catch (e) {
    console.error("pipeline/job:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al obtener job" },
      { status: 500 }
    );
  }
}

// DELETE: Cancelar job (si está en cola)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const redis = await getRedis();
    
    // Verificar si existe
    const jobData = await redis.hGetAll(`job:${id}`);
    if (!jobData || Object.keys(jobData).length === 0) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }
    
    // Solo se puede cancelar si está en cola (no si está procesando)
    if (jobData.status !== "queued") {
      return NextResponse.json(
        { error: `No se puede cancelar un job en estado: ${jobData.status}` },
        { status: 400 }
      );
    }
    
    // Remover de la cola
    const pending = await redis.lRange("jobs:pending", 0, -1);
    const jobToRemove = pending.find(j => {
      try {
        return JSON.parse(j).id === id;
      } catch {
        return false;
      }
    });
    
    if (jobToRemove) {
      await redis.lRem("jobs:pending", 0, jobToRemove);
    }
    
    // Actualizar estado
    await redis.hSet(`job:${id}`, {
      status: "cancelled",
      message: "Cancelado por usuario",
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      jobId: id,
      status: "cancelled",
      message: "Job cancelado exitosamente",
    });

  } catch (e) {
    console.error("pipeline/job DELETE:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al cancelar job" },
      { status: 500 }
    );
  }
}
