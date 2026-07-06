import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getMemberList, listCenters } from '@/lib/admin/aggregate';
import { roleLabel, isAdminRole } from '@/lib/admin/roles';
import { fmtWon, fmtInt, fmtPct } from '@/lib/admin/format';
import AdminHeader from '@/components/admin/AdminHeader';
import AddMemberButton from '@/components/admin/AddMemberButton';

export const dynamic = 'force-dynamic';
type SP = { scope?: string; centerId?: string; userId?: string };

export default async function AdminMembers({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();
  const members = await getMemberList(scope, '2026H1');
  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';

  return (
    <>
      <AdminHeader title="구성원 관리" subtitle={`${scopeName} 기준`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="text-[14px] text-ink-muted">사업개발본부 구성원 <b className="text-ink tabular-nums">{fmtInt(members.length)}</b>명</span>
        <AddMemberButton centers={centers} />
      </div>

      <div className="card card-pad">
        <table className="w-full">
          <thead>
            <tr className="table-head text-left">
              <th className="pb-3 font-medium">이름</th>
              <th className="pb-3 font-medium">직책</th>
              <th className="pb-3 font-medium">센터</th>
              <th className="pb-3 font-medium">권한</th>
              <th className="pb-3 font-medium text-right">건수</th>
              <th className="pb-3 font-medium text-right">수주금액</th>
              <th className="pb-3 font-medium text-right">수주율</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const admin = isAdminRole(m.role);
              return (
                <tr key={m.id} className="table-row">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="avatar sm">{m.name.charAt(0)}</span>
                      <span className="text-[13px] text-ink font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-[13px] text-ink-body">{roleLabel(m.role)}</td>
                  <td className="py-3 text-[13px] text-ink-body">{m.center}</td>
                  <td className="py-3">
                    <span className="tag" style={admin ? { background: 'var(--accent-tint)', color: 'var(--accent-press)' } : undefined}>{admin ? '관리자' : '일반'}</span>
                  </td>
                  <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{m.count}</td>
                  <td className="py-3 text-[13px] text-ink font-semibold text-right tabular-nums">{fmtWon(m.won)}</td>
                  <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{fmtPct(m.winRate, 0)}</td>
                </tr>
              );
            })}
            {members.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-[13px] text-ink-subtle">구성원 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
