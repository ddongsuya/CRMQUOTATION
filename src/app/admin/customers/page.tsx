import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getCustomerList, listCenters } from '@/lib/admin/aggregate';
import { fmtWon, fmtInt } from '@/lib/admin/format';
import AdminHeader from '@/components/admin/AdminHeader';
import FilterChips from '@/components/admin/FilterChips';

export const dynamic = 'force-dynamic';
type SP = { scope?: string; centerId?: string; userId?: string; filter?: string };

const REF = new Date(2026, 6, 6);              // 기준일(활성/휴면 판정)
const ACTIVE_DAYS = 30;

function relLabel(d: Date | null): string {
  if (!d) return '활동 없음';
  const days = Math.floor((REF.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default async function AdminCustomers({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();
  const { total, rows } = await getCustomerList(scope, '2026H1');
  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';

  const isActive = (d: Date | null) => !!d && (REF.getTime() - d.getTime()) / 86400000 <= ACTIVE_DAYS;
  const filter = searchParams.filter ?? 'all';
  const shown = rows.filter((r) =>
    filter === 'vip' ? r.vip
    : filter === 'active' ? isActive(r.lastActivity)
    : filter === 'dormant' ? !isActive(r.lastActivity)
    : true);

  return (
    <>
      <AdminHeader title="고객 관리" subtitle={`${scopeName} 기준`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="text-[14px] text-ink-muted">전체 고객 <b className="text-ink tabular-nums">{fmtInt(total)}</b>개사 · {scopeName} 기준</span>
        <FilterChips
          paramKey="filter"
          active={filter}
          carry={{ scope: searchParams.scope, centerId: searchParams.centerId }}
          chips={[{ key: 'all', label: '전체' }, { key: 'vip', label: 'VIP' }, { key: 'active', label: '활성' }, { key: 'dormant', label: '휴면' }]}
        />
      </div>

      <div className="card card-pad">
        <table className="w-full">
          <thead>
            <tr className="table-head text-left">
              <th className="pb-3 font-medium">고객사</th>
              <th className="pb-3 font-medium">담당자</th>
              <th className="pb-3 font-medium">센터</th>
              <th className="pb-3 font-medium text-right">진행견적</th>
              <th className="pb-3 font-medium text-right">누적수주</th>
              <th className="pb-3 font-medium text-right">최근 활동</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.name} className="table-row">
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="avatar sm">{r.name.charAt(0)}</span>
                    <span className="text-[13px] text-ink font-medium">{r.name}</span>
                    {r.vip && <span className="badge-vip">VIP</span>}
                  </div>
                </td>
                <td className="py-3 text-[13px] text-ink-body">{r.owner}</td>
                <td className="py-3 text-[13px] text-ink-body">{r.center}</td>
                <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{r.activeQuotes}</td>
                <td className="py-3 text-[13px] text-ink font-semibold text-right tabular-nums">{fmtWon(r.wonTotal)}</td>
                <td className="py-3 text-[13px] text-ink-subtle text-right">{relLabel(r.lastActivity)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-ink-subtle">해당 고객 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
