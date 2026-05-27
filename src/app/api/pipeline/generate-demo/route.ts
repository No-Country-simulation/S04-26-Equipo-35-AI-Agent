import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";
export const maxDuration = 30;

const AGENTES_DIR = path.join(process.cwd(), "Agentes");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const size: number = Number(body.size) || 2000;
    const outFile = `data/raw/demo_corpus_${Date.now()}.csv`;
    const absOut = path.join(AGENTES_DIR, outFile);

    await fs.mkdir(path.join(AGENTES_DIR, "data", "raw"), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "uv",
        ["run", "python", "scripts/generate_demo_corpus.py", "--size", String(size), "--out", outFile],
        { cwd: AGENTES_DIR, stdio: ["ignore", "pipe", "pipe"] }
      );
      let stderr = "";
      child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`generate_demo_corpus.py exited ${code}: ${stderr}`));
      });
    });

    const stat = await fs.stat(absOut);
    return NextResponse.json({
      ok: true,
      corpusFile: outFile,
      sizeBytes: stat.size,
      message: `Corpus demo generado (${size} msgs aprox.)`,
    });
  } catch (e) {
    console.error("generate-demo:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error generando corpus demo" },
      { status: 500 }
    );
  }
}
