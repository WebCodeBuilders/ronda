import { pageUser } from "@/lib/auth/guard";
import { rangeFromParams, salesReport } from "@/lib/reports";
import { ReportsView } from "@/components/reports/ReportsView";

export const metadata = { title: "Reportes · ronda" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const user = await pageUser("reports.view");
  const sp = await searchParams;
  const range = rangeFromParams(sp.desde, sp.hasta, 7);
  const prevLen = range.to.getTime() - range.from.getTime();
  const [report, prev] = await Promise.all([
    salesReport(user.organizationId, range),
    salesReport(user.organizationId, { from: new Date(range.from.getTime() - prevLen), to: range.from }),
  ]);
  return <ReportsView report={report} prev={prev.totals} from={sp.desde ?? null} to={sp.hasta ?? null} />;
}
