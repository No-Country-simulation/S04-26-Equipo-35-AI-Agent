import { ReportesPage } from "@src/components/reportes-page";
import { fetchGlobalKPIs, fetchFlowsTableData, fetchUnresolvedIntentsData } from "@src/lib/api";
import { fetchBusinessInsights } from "@src/lib/report-insights";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [kpis, flows, unresolvedIntents, businessInsights] = await Promise.all([
    fetchGlobalKPIs(),
    fetchFlowsTableData(),
    fetchUnresolvedIntentsData(),
    fetchBusinessInsights(),
  ]);

  return (
    <ReportesPage
      kpis={kpis}
      flows={flows}
      unresolvedIntents={unresolvedIntents}
      businessInsights={businessInsights}
    />
  );
}
