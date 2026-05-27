import { FrustracionPage } from "@src/components/frustracion-page";
import {
  fetchGlobalKPIs,
  fetchFlowsTableData,
  fetchTrendData,
} from "@src/lib/api";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [kpis, flows, trendData] = await Promise.all([
    fetchGlobalKPIs(),
    fetchFlowsTableData(),
    fetchTrendData(),
  ]);
  return <FrustracionPage kpis={kpis} flows={flows} trendData={trendData} />;
}
