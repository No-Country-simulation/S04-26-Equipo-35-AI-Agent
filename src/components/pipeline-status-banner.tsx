import Link from "next/link";
import { fetchPipelineStatus } from "@src/lib/pipeline-status";

export async function PipelineStatusBanner() {
  const status = await fetchPipelineStatus();

  if (status.stage === "completed") return null;

  const isRunning = status.status === "running";
  const corpusLabel = status.corpusFile?.includes("test_mini")
    ? "demo (mini)"
    : status.corpusFile?.includes("data_conversa_ai")
      ? "corpus completo"
      : "corpus";

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
    >
      <strong>Datos en modo parcial.</strong>{" "}
      {isRunning ? (
        <>Pipeline en ejecución ({status.stage}).</>
      ) : (
        <>
          Última etapa: <code className="text-xs">{status.stage}</code> — {corpusLabel}.
          El dashboard usa sesiones del ETL; sentiment/analyst completos al terminar la
          ingesta.
        </>
      )}{" "}
      <Link href="/corpus/cargar" className="font-medium underline">
        Ver progreso
      </Link>
    </div>
  );
}
