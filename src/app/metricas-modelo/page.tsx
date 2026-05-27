import { ModelMetricsPage } from "@src/components/model-metrics-page";
import { fetchModelMetrics } from "@src/lib/model-metrics";

export default async function Page() {
  const data = await fetchModelMetrics();
  return <ModelMetricsPage data={data} />;
}
