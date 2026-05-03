import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { PageHeader } from "./page-header";
import { KpiRow } from "./kpi-row";
import { FrustrationFlows } from "./frustration-flows";
import { TopIntents } from "./top-intents";
import { TrendChart } from "./trend-chart";

export function DashboardHome() {
  return (
    <DashboardShell sidebar={<Sidebar activeItem="Resumen" />} mainClassName="flex flex-col gap-3">
      <PageHeader />
      <KpiRow />
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 12, alignItems: "stretch" }}>
        <FrustrationFlows />
        <TopIntents />
      </div>
      <TrendChart />
    </DashboardShell>
  );
}
