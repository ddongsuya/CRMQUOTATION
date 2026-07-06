import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getQuoteList, listCenters } from '@/lib/admin/aggregate';
import { fmtWon, fmtInt, fmtPct } from '@/lib/admin/format';
import { quoteStatus } from '@/lib/admin/status';
import AdminHeader from '@/components/admin/AdminHeader';

export const dynamic = 'force-dynamic';
type SP = { scope?: string; centerId?: string; userId?: string };

export default async function AdminQuotes({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();
  const { stats, rows } = await getQuoteList(scope, '2026H1');
  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';

  return (
    <>
      <AdminHeader title="견적 목록" subtitle={`${scopeName} 기준`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="전체 견적" value={fmtInt(stats.total)} />
        <Stat label="진행 중" value={fmtInt(stats.inProgress)} />
        <Stat label="수주 금액" value={fmtWon(stats.wonAmount)} dark />
        <Stat label="수주율" value={fmtPct(stats.winRate, 0)} />
      </div>

      <div className="card card-pad">
        <table className="w-full">
          <thead>
            <tr className="table-head text-left">
              <th className="pb-3 font-medium">견적번호</th>
              <th className="pb-3 font-medium">고객사</th>
              <th className="pb-3 font-medium">담당자</th>
              <th className="pb-3 font-medium">센터</th>
              <th className="pb-3 font-medium text-right">금액</th>
              <th className="pb-3 font-medium text-right">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = quoteStatus(r.status);
              return (
                <tr key={r.quoteNumber} className="table-row">
                  <td className="py-3 mono-no text-[13px]">{r.quoteNumber}</td>
                  <td className="py-3 text-[13px] text-ink font-medium">{r.company}</td>
                  <td className="py-3 text-[13px] text-ink-body">{r.owner}</td>
                  <td className="py-3 text-[13px] text-ink-body">{r.center}</td>
                  <td className="py-3 text-[13px] text-ink font-semibold text-right tabular-nums">{fmtWon(r.amount)}</td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-body">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-ink-subtle">견적 없음</td></tr>}
          </tbody>
        </table>
      </div>
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
