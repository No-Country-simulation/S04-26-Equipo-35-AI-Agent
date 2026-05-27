import { HistorialPage } from "@src/components/historial-page";
import { fetchPipelineRuns } from "@src/lib/api";

export const dynamic = "force-dynamic";

export default async function Page() {
  const runs = await fetchPipelineRuns(20);
  return <HistorialPage runs={runs} />;
}
