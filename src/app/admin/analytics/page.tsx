import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getPerformance, getMonthlyFunnel, listCenters } from '@/lib/admin/aggregate';
import { fmtWon, fmtPct } from '@/lib/admin/format';
import AdminHeader from '@/components/admin/AdminHeader';

export const dynamic = 'force-dynamic';
type SP = { scope?: string; centerId?: string; userId?: string };

export default async function AdminAnalytics({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();
  const [p, funnel] = await Promise.all([getPerformance(scope), getMonthlyFunnel(scope, 2026)]);
  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';

  return (
    <>
      <AdminHeader title="실적 분석" subtitle={`기간 비교 · ${scopeName} 기준`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      {/* 기간 비교 3카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="card-dark card-pad">
          <div className="text-[13px]" style={{ color: 'var(--on-dark-soft)' }}>이번 분기</div>
          <div className="mt-2 text-[30px] font-bold tabular-nums leading-none" style={{ whiteSpace: 'nowrap' }}>{fmtWon(p.thisQ)}</div>
          {p.qoqDelta != null && <div className="mt-2 text-[13px] font-semibold" style={{ color: p.qoqDelta >= 0 ? 'var(--success)' : 'var(--error)' }}>{p.qoqDelta >= 0 ? '▲' : '▼'} {Math.abs(p.qoqDelta * 100).toFixed(1)}% 전분기</div>}
        </div>
        <div className="card card-pad">
          <div className="text-[13px] text-ink-muted">전분기</div>
          <div className="mt-2 text-[30px] font-bold text-ink tabular-nums leading-none" style={{ whiteSpace: 'nowrap' }}>{fmtWon(p.prevQ)}</div>
          <div className="mt-2 text-[13px] text-ink-subtle">2026 1분기</div>
        </div>
        <div className="card card-pad">
          <div className="text-[13px] text-ink-muted">전년 동기</div>
          <div className="mt-2 text-[30px] font-bold text-ink tabular-nums leading-none" style={{ whiteSpace: 'nowrap' }}>{fmtWon(p.yoyQ)}</div>
          {p.yoyDelta != null
            ? <div className="mt-2 text-[13px] font-semibold" style={{ color: p.yoyDelta >= 0 ? 'var(--success)' : 'var(--error)' }}>{p.yoyDelta >= 0 ? '▲' : '▼'} {Math.abs(p.yoyDelta * 100).toFixed(1)}% YoY</div>
            : <div className="mt-2 text-[13px] text-ink-subtle">2025 2분기</div>}
        </div>
      </div>

      {/* 센터별 실적 비교 */}
      <div className="card card-pad">
        <h2 className="text-[15px] font-semibold text-ink mb-4">센터별 실적 비교</h2>
        <table className="w-full">
          <thead>
            <tr className="table-head text-left">
              <th className="pb-3 font-medium">센터</th>
              <th className="pb-3 font-medium text-right">목표</th>
              <th className="pb-3 font-medium text-right">수주</th>
              <th className="pb-3 font-medium">달성률</th>
              <th className="pb-3 font-medium text-right">수주율</th>
              <th className="pb-3 font-medium text-right">전분기 대비</th>
            </tr>
          </thead>
          <tbody>
            {p.centerRows.map((r, i) => <PerfRow key={r.name} r={r} tone={i === 0 ? 'var(--ink)' : 'var(--accent)'} />)}
            <PerfRow r={{ name: '합계', ...p.total }} tone="var(--ink)" bold />
          </tbody>
        </table>
      </div>

      {/* 월별 견적 퍼널 (Sheet1) */}
      <div className="card card-pad mt-4">
        <h2 className="text-[15px] font-semibold text-ink mb-4">월별 견적 현황</h2>
        <table className="w-full">
          <thead>
            <tr className="table-head text-left">
              <th className="pb-3 font-medium">월</th>
              <th className="pb-3 font-medium text-right">견적</th>
              <th className="pb-3 font-medium text-right">진행 중</th>
              <th className="pb-3 font-medium text-right">계약</th>
              <th className="pb-3 font-medium text-right">타 기관</th>
              <th className="pb-3 font-medium text-right">수주율</th>
              <th className="pb-3 font-medium text-right">수주 금액</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((m) => {
              const decided = m.won + m.lost;
              return (
                <tr key={m.month} className="table-row">
                  <td className="py-3 text-[13px] text-ink font-medium tabular-nums">{m.month}월</td>
                  <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{m.quoted}</td>
                  <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{m.inProgress}</td>
                  <td className="py-3 text-[13px] font-semibold text-right tabular-nums" style={{ color: 'var(--success)' }}>{m.won}</td>
                  <td className="py-3 text-[13px] text-right tabular-nums" style={{ color: m.lost ? 'var(--error)' : 'var(--muted-soft)' }}>{m.lost}</td>
                  <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{decided ? fmtPct(m.won / decided, 0) : '—'}</td>
                  <td className="py-3 text-[13px] text-ink font-semibold text-right tabular-nums">{fmtWon(m.wonAmount)}</td>
                </tr>
              );
            })}
            {funnel.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-[13px] text-ink-subtle">데이터 없음</td></tr>}
          </tbody>
        </table>
        <p className="text-[12px] text-ink-subtle mt-3">견적 결론(계약 체결·타 기관 의뢰 등)에서 파생. 보류·예산확보 등 세부 분류는 결론 어휘 확장 시 반영 가능.</p>
      </div>
    </>
  );
}

function PerfRow({ r, tone, bold }: { r: { name: string; target: number | null; won: number; rate: number | null; winRate: number; qoq: number | null }; tone: string; bold?: boolean }) {
  return (
    <tr className={`table-row ${bold ? 'font-semibold' : ''}`}>
      <td className={`py-3 text-[13px] ${bold ? 'text-ink font-bold' : 'text-ink font-medium'}`}>{r.name}</td>
      <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{r.target != null ? fmtWon(r.target) : '—'}</td>
      <td className="py-3 text-[13px] text-ink font-semibold text-right tabular-nums">{fmtWon(r.won)}</td>
      <td className="py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-2 rounded-full min-w-[60px]" style={{ background: 'var(--hairline)' }}>
            <div className="h-2 rounded-full" style={{ width: `${Math.min((r.rate ?? 0) * 100, 100)}%`, background: tone }} />
          </div>
          <span className="text-[13px] text-ink-body tabular-nums w-10 text-right">{r.rate != null ? fmtPct(r.rate, 0) : '—'}</span>
        </div>
      </td>
      <td className="py-3 text-[13px] text-ink-body text-right tabular-nums">{fmtPct(r.winRate, 0)}</td>
      <td className="py-3 text-right text-[13px] font-semibold tabular-nums" style={{ color: r.qoq == null ? 'var(--muted-soft)' : r.qoq >= 0 ? 'var(--success)' : 'var(--error)' }}>
        {r.qoq == null ? '—' : `${r.qoq >= 0 ? '▲' : '▼'}${Math.abs(r.qoq * 100).toFixed(0)}%`}
      </td>
    </tr>
  );
}
