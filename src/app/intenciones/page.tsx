import { IntencionesPage } from "@src/components/intenciones-page";
import { fetchUnresolvedIntentsData } from "@src/lib/api";

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await fetchUnresolvedIntentsData();
  return <IntencionesPage data={data} />;
}
