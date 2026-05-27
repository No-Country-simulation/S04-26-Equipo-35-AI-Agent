import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { PageHeader } from "./page-header";
import { KpiRow } from "./kpi-row";
import { FrustrationFlows } from "./frustration-flows";
import { TopIntents } from "./top-intents";
import { TrendChart } from "./trend-chart";
import { AlertsPanel } from "./alerts-panel";
import { generateAlerts } from "../lib/alerts";
import { SankeyChart } from "./sankey-chart";
import {
  fetchGlobalKPIs,
  fetchTopIntents,
  fetchFrustrationFlows,
  fetchTrendData,
  fetchSankeyData,
} from "../lib/api";
import { KanbanProgressPanel } from "./kanban-progress-panel";
import { PipelineStatusBanner } from "./pipeline-status-banner";

export async function DashboardHome({ lang }: { lang?: string }) {
  const kpis = await fetchGlobalKPIs(lang);
  const topIntents = await fetchTopIntents(lang);
  const flows = await fetchFrustrationFlows(lang);
  const trendData = await fetchTrendData();
  const sankeyData = await fetchSankeyData(lang);

  // Generate alerts from live KPIs
  const alerts = generateAlerts(kpis);

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Resumen" />} mainClassName="flex flex-col gap-6">
      <PageHeader
        totalSessions={kpis.totalSessions}
        totalMessages={kpis.totalMessages}
        previousPeriod={kpis.deltas?.previous_period}
      />
      <PipelineStatusBanner />
      <KpiRow data={kpis} />

      <KanbanProgressPanel />

      <AlertsPanel alerts={alerts} />

      {/* Sankey Diagram — Fase 3 */}
      <SankeyChart data={sankeyData} />

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 24, alignItems: "stretch" }}>
        <FrustrationFlows data={flows} />
        <TopIntents data={topIntents} />
      </div>
      <TrendChart data={trendData} />
    </DashboardShell>
  );
}
