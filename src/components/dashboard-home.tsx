import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { PageHeader } from "./page-header";
import { KpiRow } from "./kpi-row";
import { FrustrationFlows } from "./frustration-flows";
import { TopIntents } from "./top-intents";
import { TrendChart } from "./trend-chart";
import { fetchGlobalKPIs, fetchTopIntents, fetchFrustrationFlows, fetchTrendData } from "../lib/api";

export async function DashboardHome() {
  const kpis = await fetchGlobalKPIs();
  const topIntents = await fetchTopIntents();
  const flows = await fetchFrustrationFlows();
  const trendData = await fetchTrendData();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Resumen" />} mainClassName="flex flex-col gap-3">
      <PageHeader />
      <KpiRow data={kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 12, alignItems: "stretch" }}>
        <FrustrationFlows data={flows} />
        <TopIntents data={topIntents} />
      </div>
      <TrendChart data={trendData} />
    </DashboardShell>
  );
}
