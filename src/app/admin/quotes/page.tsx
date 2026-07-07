import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getQuoteList, getQuoteStatusList, listCenters } from '@/lib/admin/aggregate';
import { fmtWon, fmtInt, fmtPct } from '@/lib/admin/format';
import AdminHeader from '@/components/admin/AdminHeader';
import QuoteUploadButton from '@/components/admin/QuoteUploadButton';
import QuoteStatusTable, { type Row } from '@/components/admin/QuoteStatusTable';

export const dynamic = 'force-dynamic';
type SP = { scope?: string; centerId?: string; userId?: string };

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function AdminQuotes({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();
  const [{ stats }, statusRows] = await Promise.all([
    getQuoteList(scope, '2026H1'),
    getQuoteStatusList(scope),
  ]);
  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';
  const rows: Row[] = statusRows.map((r) => ({ ...r, sentAt: ymd(r.sentAt) }));

  return (
    <>
      <AdminHeader title="견적 현황" subtitle={`${scopeName} 기준`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="전체 견적" value={fmtInt(statusRows.length)} />
        <Stat label="진행 중" value={fmtInt(stats.inProgress)} />
        <Stat label="수주 금액" value={fmtWon(stats.wonAmount)} dark />
        <Stat label="수주율" value={fmtPct(stats.winRate, 0)} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] text-ink-subtle">행을 클릭하지 않고 <b className="text-ink-body">결론</b> 칸을 눌러 추적 결과를 바로 입력·수정할 수 있습니다.</p>
        <QuoteUploadButton />
      </div>

      <QuoteStatusTable rows={rows} />
    </>
  );
}

function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`${dark ? 'card-dark' : 'card'} card-pad`}>
      <div className="text-[13px]" style={dark ? { color: 'var(--on-dark-soft)' } : { color: 'var(--muted)' }}>{label}</div>
      <div className="mt-2 text-[26px] font-bold tabular-nums leading-none" style={{ whiteSpace: 'nowrap', color: dark ? 'var(--on-dark)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}
