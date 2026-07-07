import Link from 'next/link';
import CompanyLink from '@/components/admin/CompanyLink';
import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { parseScope, getDashboardData, getTargetGauge, getActivityHeatmap, listCenters } from '@/lib/admin/aggregate';
import { fmtWon, splitWon, fmtPct, fmtInt } from '@/lib/admin/format';
import AdminHeader from '@/components/admin/AdminHeader';
import { Sparkline, BarSpark, ProgressBar, GroupedBars, DonutGauge, Donut, HBars, Funnel, Heatmap } from '@/components/admin/charts';

export const dynamic = 'force-dynamic';

const YEAR = 2026;
const PERIOD = '2026H1';
const H1 = ['1월', '2월', '3월', '4월', '5월', '6월'];
const STAGE_KO: Record<string, string> = { INQUIRY: '문의', QUOTE: '견적', INTAKE: '접수', CONTRACT: '계약', STUDY: '시험', INVOICE: '청구', DONE: '완료' };
const ROLE_KO: Record<string, string> = { ADMIN: '본부장', CENTER_LEAD: '센터장', TEAM_LEAD: '팀장', MEMBER: '구성원', admin: '관리자' };

type SP = { scope?: string; centerId?: string; userId?: string };

/** 관리자 대시보드(홈) — 12종 시각화. 스코프 롤업(전사/센터/개인) 집계 바인딩. */
export default async function AdminDashboard({ searchParams }: { searchParams: SP }) {
  const view = await getViewMode();
  const me = await getCurrentUser();
  const scope = parseScope(searchParams, { isAdminView: view.isAdminView, selfId: me.id, selfCenterId: me.centerId });
  const centers = await listCenters();

  const [data, gaugeAll, heat] = await Promise.all([
    getDashboardData(scope, YEAR),
    getTargetGauge(scope, PERIOD),
    getActivityHeatmap(scope, new Date(YEAR, 6, 6), 12),
  ]);
  const centerGauges = await Promise.all(centers.map((c) => getTargetGauge({ kind: 'center', centerId: c.id }, PERIOD).then((g) => ({ ...c, g }))));

  const scopeName = scope.kind === 'all' ? '전사' : scope.kind === 'center' ? (centers.find((c) => c.id === scope.centerId)?.name ?? '센터') : '개인';
  const k = data.kpi;
  // 현재 스코프를 하위 화면 링크로 이어줌
  const carry = new URLSearchParams();
  if (searchParams.scope) carry.set('scope', searchParams.scope);
  if (searchParams.centerId) carry.set('centerId', searchParams.centerId);
  const qs = carry.toString() ? `?${carry.toString()}` : '';

  // 델타(실데이터 파생) — 히어로 QoQ, 수주율 상·하반기 비교
  const q1 = data.monthlyWon.slice(0, 3).reduce((a, b) => a + b, 0);
  const q2 = data.monthlyWon.slice(3, 6).reduce((a, b) => a + b, 0);
  const heroDelta = q1 > 0 ? (q2 - q1) / q1 : null;
  const wr = data.winRateSeries;
  const early = wr.slice(0, 3).filter((v): v is number => v != null);
  const late = wr.slice(3, 6).filter((v): v is number => v != null);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const wrEarly = avg(early), wrLate = avg(late);
  const wrDelta = wrEarly != null && wrLate != null ? wrLate - wrEarly : null;

  const won = splitWon(k.wonAmount);
  const centerColors = ['var(--ink)', 'var(--accent)'];

  return (
    <>
      <AdminHeader title={`${scopeName} 대시보드`} subtitle={`${scopeName} 기준 · 2026 상반기`} centers={centers} activeScope={searchParams.scope ?? 'all'} activeCenterId={searchParams.centerId} />

      {/* ── 히어로 (블랙 반전) ── */}
      <section className="card-dark card-pad flex flex-col sm:flex-row sm:items-center gap-6 mb-4">
        <div className="min-w-0">
          <div className="eyebrow" style={{ color: 'var(--on-dark-soft)' }}>{scopeName} 누적 · 수주 금액</div>
          <div className="mt-2 flex items-end gap-1 tabular-nums" style={{ whiteSpace: 'nowrap' }}>
            <span className="text-[40px] leading-none font-bold">₩{won.num}</span>
            <span className="text-[20px] font-bold mb-0.5">{won.unit}</span>
          </div>
          {heroDelta != null && (
            <div className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: heroDelta >= 0 ? 'var(--success)' : 'var(--error)' }}>
              <span>{heroDelta >= 0 ? '▲' : '▼'}</span>
              <span>{Math.abs(heroDelta * 100).toFixed(1)}%</span>
              <span className="font-normal" style={{ color: 'var(--on-dark-soft)' }}>전분기 대비</span>
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center min-w-[120px]">
          <Sparkline values={data.monthlyWon.slice(0, 6)} w={180} h={64} />
        </div>
        <div className="flex gap-7 sm:gap-9 flex-shrink-0">
          {[
            { l: '목표 달성', v: gaugeAll.rate != null ? fmtPct(gaugeAll.rate) : '—' },
            { l: '수주율', v: fmtPct(k.winRate, 0) },
            { l: '신규 고객', v: fmtInt(k.newClientCount) },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-[12px]" style={{ color: 'var(--on-dark-soft)' }}>{s.l}</div>
              <div className="mt-1 text-[24px] font-bold tabular-nums leading-none">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── KPI 4 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard label="파이프라인" value={fmtWon(k.pipelineAmount)}>
          <BarSpark values={pad6(data.monthlyPipeline)} tone="accent" />
        </KpiCard>
        <KpiCard label="진행 견적" value={`${fmtInt(k.pipelineCount)}건`}>
          <BarSpark values={pad6(data.monthlyPipelineCount)} tone="cream" accentLast={1} />
        </KpiCard>
        <KpiCard label="수주율" value={fmtPct(k.winRate, 0)} delta={wrDelta != null ? { up: wrDelta >= 0, text: `${Math.abs(wrDelta * 100).toFixed(1)}%` } : undefined}>
          <div className="pt-3"><ProgressBar value={k.winRate} /></div>
        </KpiCard>
        <KpiCard label="활동량" value={fmtInt(k.activityCount)}>
          <BarSpark values={pad6(data.monthlyActivity)} tone="accent" />
        </KpiCard>
      </div>

      {/* ── 센터별 월간 추이 + 목표 게이지 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-ink">센터별 월간 수주 추이</h2>
            <Legend items={centers.map((c, i) => ({ name: c.name, color: centerColors[i % centerColors.length] }))} />
          </div>
          <GroupedBars
            labels={H1}
            series={centers.map((c, i) => ({ name: c.name, color: centerColors[i % centerColors.length], values: pad6(data.centerMonthly.find((r) => r.centerId === c.id)?.months ?? []) }))}
          />
        </div>
        <div className="card card-pad">
          <h2 className="text-[15px] font-semibold text-ink mb-4">목표 달성 게이지</h2>
          <div className="flex items-center justify-around gap-3">
            {centerGauges.map((cg, i) => (
              cg.g.rate != null
                ? <DonutGauge key={cg.id} value={cg.g.rate} color={i % 2 === 0 ? 'ink' : 'accent'} label={cg.name} size={108} />
                : <div key={cg.id} className="flex flex-col items-center gap-2 text-ink-subtle text-[12px]"><div className="w-[108px] h-[108px] rounded-full border border-dashed border-slate-200 flex items-center justify-center">목표 미설정</div>{cg.name}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 수주율 추이 + 센터 구성 + 산업별 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card card-pad">
          <h2 className="text-[15px] font-semibold text-ink mb-4">수주율 추이</h2>
          <Sparkline values={wr.slice(0, 6).map((v) => (v ?? 0) * 100)} w={280} h={90} />
          <div className="flex justify-between mt-2">{H1.map((m) => <span key={m} className="text-[10px] text-ink-subtle">{m}</span>)}</div>
        </div>
        <div className="card card-pad">
          <h2 className="text-[15px] font-semibold text-ink mb-4">센터 구성</h2>
          <div className="flex items-center gap-5">
            <Donut segments={data.centerDonut.map((c, i) => ({ label: c.name, value: c.amount, color: centerColors[i % centerColors.length] }))} centerValue={fmtWon(data.centerDonut.reduce((a, c) => a + c.amount, 0))} centerLabel="수주" />
            <div className="space-y-2">
              {data.centerDonut.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-[13px]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: centerColors[i % centerColors.length] }} />
                  <span className="text-ink-body">{c.name}</span>
                  <span className="ml-auto font-semibold text-ink tabular-nums">{fmtWon(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="text-[15px] font-semibold text-ink mb-4">산업별 분포</h2>
          {data.byIndustry.length ? <HBars items={data.byIndustry.map((r) => ({ label: r.industry, value: r.amount }))} fmt={fmtWon} /> : <Empty />}
        </div>
      </div>

      {/* ── 퍼널 + 활동 히트맵 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card card-pad">
          <h2 className="text-[15px] font-semibold text-ink mb-4">파이프라인 퍼널</h2>
          <Funnel stages={data.funnel.map((s) => ({ label: STAGE_KO[s.stage] ?? s.stage, value: s.count }))} />
        </div>
        <div className="card card-pad">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-ink">활동 히트맵</h2>
            <span className="text-[12px] text-ink-subtle tabular-nums">최근 12주 · 총 {fmtInt(heat.total)}건</span>
          </div>
          <Heatmap cells={heat.cells} max={heat.max} />
        </div>
      </div>

      {/* ── 상위 고객 + 담당자 요약 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-ink">상위 고객</h2>
            <Link href={`/admin/customers${qs}`} className="link text-[13px]">전체 보기 →</Link>
          </div>
          <table className="w-full">
            <thead><tr className="table-head text-left"><th className="pb-2 font-medium">고객사</th><th className="pb-2 font-medium">담당</th><th className="pb-2 font-medium text-right">파이프라인</th><th className="pb-2 font-medium text-right">누적 수주</th></tr></thead>
            <tbody>
              {data.topCustomers.map((c) => (
                <tr key={c.name} className="table-row">
                  <td className="py-2.5 text-[13px] font-medium"><CompanyLink name={c.name} className="text-ink hover:text-brand-600 transition-colors text-left" /><span className="block text-[11px] text-ink-subtle font-normal">{c.industry}</span></td>
                  <td className="py-2.5 text-[13px] text-ink-body">{c.owner}<span className="block text-[11px] text-ink-subtle">{c.center}</span></td>
                  <td className="py-2.5 text-[13px] text-ink-body text-right tabular-nums">{fmtWon(c.pipeline)}</td>
                  <td className="py-2.5 text-[13px] text-ink font-semibold text-right tabular-nums">{fmtWon(c.won)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card card-pad">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-ink">담당자 요약</h2>
            <Link href={`/admin/members${qs}`} className="link text-[13px]">전체 보기 →</Link>
          </div>
          <table className="w-full">
            <thead><tr className="table-head text-left"><th className="pb-2 font-medium">담당자</th><th className="pb-2 font-medium">직책</th><th className="pb-2 font-medium text-right">건수</th><th className="pb-2 font-medium text-right">수주</th><th className="pb-2 font-medium text-right">수주율</th></tr></thead>
            <tbody>
              {data.memberSummary.map((m) => (
                <tr key={m.userId} className="table-row">
                  <td className="py-2.5 text-[13px] text-ink font-medium">{m.name}<span className="block text-[11px] text-ink-subtle font-normal">{m.center}</span></td>
                  <td className="py-2.5 text-[13px] text-ink-body">{ROLE_KO[m.role] ?? '구성원'}</td>
                  <td className="py-2.5 text-[13px] text-ink-body text-right tabular-nums">{m.count}</td>
                  <td className="py-2.5 text-[13px] text-ink font-semibold text-right tabular-nums">{fmtWon(m.won)}</td>
                  <td className="py-2.5 text-[13px] text-ink-body text-right tabular-nums">{fmtPct(m.winRate, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function pad6(a: number[]): number[] { return Array.from({ length: 6 }, (_, i) => a[i] ?? 0); }

function KpiCard({ label, value, delta, children }: { label: string; value: string; delta?: { up: boolean; text: string }; children?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-muted">{label}</span>
        {delta && <span className="text-[12px] font-semibold tabular-nums" style={{ color: delta.up ? 'var(--success)' : 'var(--error)' }}>{delta.up ? '▲' : '▼'}{delta.text}</span>}
      </div>
      <div className="mt-1.5 text-[26px] font-bold text-ink tabular-nums leading-none" style={{ whiteSpace: 'nowrap' }}>{value}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex gap-3">
      {items.map((it) => (
        <span key={it.name} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: it.color }} />{it.name}
        </span>
      ))}
    </div>
  );
}

function Empty() { return <div className="py-8 text-center text-[13px] text-ink-subtle">데이터 없음</div>; }
