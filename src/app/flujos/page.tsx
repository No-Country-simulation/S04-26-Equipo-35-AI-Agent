import { FlujosPage } from "@src/components/flujos-page";
import { fetchFlowsTableData } from "@src/lib/api";

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await fetchFlowsTableData();
  return <FlujosPage data={data} />;
}
