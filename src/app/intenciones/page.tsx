import { IntencionesPage } from "@src/components/intenciones-page";
import { fetchUnresolvedIntentsData, fetchUnresolvedTrend } from "@src/lib/api";

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [data, trendData] = await Promise.all([
    fetchUnresolvedIntentsData(),
    fetchUnresolvedTrend(),
  ]);
  return <IntencionesPage data={data} trendData={trendData} />;
}
