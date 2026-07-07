import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getDailyReports, companyNames, listCenters } from '@/lib/admin/aggregate';
import AdminHeader from '@/components/admin/AdminHeader';
import QuoteUploadButton from '@/components/admin/QuoteUploadButton';
import DailyReportList, { type Report } from '@/components/admin/DailyReportList';

export const dynamic = 'force-dynamic';
type SP = { scope?: string; centerId?: string; userId?: string };

export default async function AdminReports({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();
  const [reports, names] = await Promise.all([getDailyReports(scope, 45), companyNames()]);
  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';

  const rows: Report[] = reports.map((r) => ({ ...r, date: r.date.toISOString() }));

  return (
    <>
      <AdminHeader title="일일 업무" subtitle={`${scopeName} 기준`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-[13px] text-ink-subtle">날짜별 업무 일지 · 본문의 <b className="text-ink-body">고객사명</b>은 해당 견적으로 연결됩니다.</p>
        <QuoteUploadButton endpoint="/api/admin/reports/import" label="일일보고 업로드" />
      </div>

      <DailyReportList reports={rows} companyNames={names} />
    </>
  );
}
