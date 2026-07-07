import Link from 'next/link';
import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getSchedule, listCenters } from '@/lib/admin/aggregate';
import { fmtInt } from '@/lib/admin/format';
import AdminHeader from '@/components/admin/AdminHeader';

export const dynamic = 'force-dynamic';
type SP = { scope?: string; centerId?: string; userId?: string };

const TONE: Record<string, { text: string; bar: string }> = {
  green: { text: 'var(--success)', bar: 'var(--ink)' },
  orange: { text: 'var(--accent)', bar: 'var(--accent)' },
  gray: { text: 'var(--muted)', bar: 'var(--hairline-soft)' },
};
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월'];

export default async function AdminSchedule({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();
  const { count, rows } = await getSchedule(scope);
  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';

  return (
    <>
      <AdminHeader title="시험 일정" subtitle={`${scopeName} 기준`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      <p className="text-[14px] text-ink-muted mb-4">진행 중 프로젝트 <b className="text-ink tabular-nums">{fmtInt(count)}</b>건 · {scopeName} 기준</p>

      <div className="card card-pad overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="table-head text-left">
              <th className="pb-3 font-medium">프로젝트 / 고객사</th>
              <th className="pb-3 font-medium">담당자</th>
              <th className="pb-3 font-medium">센터</th>
              <th className="pb-3 font-medium">상태</th>
              <th className="pb-3 font-medium w-[38%]">일정 (2026 상반기)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const t = TONE[r.tone];
              return (
                <tr key={i} className="table-row">
                  <td className="py-3">
                    <div className="text-[14px] text-ink font-semibold">{r.project}</div>
                    {r.company !== '—'
                      ? <Link href={`/admin/quotes?company=${encodeURIComponent(r.company)}`} className="text-[12px] text-ink-subtle hover:text-brand-600 transition-colors">{r.company} →</Link>
                      : <div className="text-[12px] text-ink-subtle">{r.company}</div>}
                  </td>
                  <td className="py-3 text-[13px] text-ink-body">{r.owner}</td>
                  <td className="py-3 text-[13px] text-ink-body">{r.center}</td>
                  <td className="py-3 text-[13px] font-semibold" style={{ color: t.text }}>{r.status}</td>
                  <td className="py-3">
                    <div className="relative h-6 rounded-md" style={{ background: 'var(--card-cream)' }}>
                      <div className="absolute top-1 bottom-1 rounded" style={{ left: `${r.startFrac * 100}%`, width: `${r.widthFrac * 100}%`, background: t.bar }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-[13px] text-ink-subtle">프로젝트 없음</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}></td>
              <td className="pt-2">
                <div className="flex justify-between">{MONTHS.map((m) => <span key={m} className="text-[10px] text-ink-subtle">{m}</span>)}</div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
