import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

const AGENTES_DIR = path.join(process.cwd(), "Agentes");
const DEFAULT_CORPUS = "data/raw/data_conversa_ai.csv";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const corpus = (body.corpus as string) ?? DEFAULT_CORPUS;
    const logPath = path.join(
      AGENTES_DIR,
      "data",
      "processed",
      `evaluate_${Date.now()}.log`
    );
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    const logFd = await fs.open(logPath, "a");

    const child = spawn(
      "uv",
      [
        "run",
        "python",
        "-m",
        "src.cli",
        "evaluate",
        "--corpus",
        corpus,
        "--from-db",
      ],
      {
        cwd: AGENTES_DIR,
        detached: true,
        stdio: ["ignore", logFd.fd, logFd.fd],
        env: { ...process.env },
      }
    );
    child.unref();
    await logFd.close();

    return NextResponse.json({
      ok: true,
      message: "Evaluación de calidad iniciada",
      corpus,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
