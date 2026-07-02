import Link from 'next/link';
import { FlaskConical, Clock, Coins, Boxes, ArrowRight, Receipt, FileText, TrendingUp, AlarmClock, Activity, FileSignature, NotebookPen } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadData } from '@/lib/data';
import { ensureHydrated } from '@/lib/hydrate';
import DashboardAlarms from '@/components/DashboardAlarms';

// 통계·최근견적을 매 요청 갱신 (런타임 DB 반영). 정적 프리렌더 금지.
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '작성중', cls: 'bg-slate-200 text-ink-muted' },
  ISSUED: { label: '발행', cls: 'bg-brand-100 text-brand-700' },
  SENT: { label: '발송', cls: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { label: '수주', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: '반려', cls: 'bg-red-100 text-red-700' },
};

export default async function Home() {
  await ensureHydrated();
  const { testItems } = loadData();
  const byModality: Record<string, number> = {};
  for (const it of testItems) for (const m of it.modalityPool) byModality[m] = (byModality[m] || 0) + 1;
  const modalityRows = Object.entries(byModality).sort((a, b) => b[1] - a[1]);
  const maxCount = modalityRows.length ? modalityRows[0][1] : 1;

  const session = await getServerSession(authOptions);
  const name = session?.user?.name ?? '데모 사용자';  // DEMO(임시): 로그인 OFF

  let quotes: Array<{ id: number; quoteNumber: string; customerCompany: string | null; modality: string; status: string; grandTotal: number | null }> = [];
  // 업무 KPI (이번 달 견적 · 진행 중 · 수주 금액/수주율 · 진행 시험)
  let kpi = { thisMonth: 0, inProgress: 0, wonAmt: 0, wonRate: 0, runningStudies: 0, quoteDelta: 0, wonDelta: 0 };
  let dueStudies: { id: number; name: string; company: string; dueAt: string }[] = [];
  let monthly: { label: string; amount: number }[] = [];
  let activity: { id: string; kind: string; text: string; sub: string; at: string }[] = [];
  try {
    quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, quoteNumber: true, customerCompany: true, modality: true, status: true, grandTotal: true },
    });
    const all = await prisma.quote.findMany({ select: { status: true, grandTotal: true, createdAt: true } });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const won = all.filter(q => q.status === 'ACCEPTED');
    const thisMonthN = all.filter(q => q.createdAt >= monthStart).length;
    const lastMonthN = all.filter(q => q.createdAt >= lastMonthStart && q.createdAt < monthStart).length;
    const wonThis = won.filter(q => q.createdAt >= monthStart).reduce((s, q) => s + (q.grandTotal ?? 0), 0);
    const wonLast = won.filter(q => q.createdAt >= lastMonthStart && q.createdAt < monthStart).reduce((s, q) => s + (q.grandTotal ?? 0), 0);
    kpi = {
      thisMonth: thisMonthN,
      inProgress: all.filter(q => ['DRAFT', 'ISSUED', 'SENT'].includes(q.status)).length,
      wonAmt: won.reduce((s, q) => s + (q.grandTotal ?? 0), 0),
      wonRate: all.length ? Math.round(won.length / all.length * 100) : 0,
      runningStudies: await prisma.study.count({ where: { reportDraftIssuedAt: null } }),
      quoteDelta: thisMonthN - lastMonthN,
      wonDelta: wonThis - wonLast,
    };

    // 마감 임박 시험 (보고서안 발행 예정·미발행, 가까운 순)
    const studies = await prisma.study.findMany({
      where: { reportDraftIssuedAt: null, reportDraftDueAt: { not: null } },
      orderBy: { reportDraftDueAt: 'asc' }, take: 6,
      select: { id: true, itemName: true, reportDraftDueAt: true, deal: { select: { title: true, contact: { select: { company: { select: { name: true } } } } } } },
    });
    dueStudies = studies.map(s => ({ id: s.id, name: s.itemName || s.deal.title, company: s.deal.contact?.company?.name ?? '', dueAt: s.reportDraftDueAt!.toISOString() }));

    // 월별 수주 추이 (최근 6개월 ACCEPTED 합)
    const buckets: { y: number; m: number; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.push({ y: d.getFullYear(), m: d.getMonth(), amount: 0 }); }
    for (const q of won) { const b = buckets.find(x => x.y === q.createdAt.getFullYear() && x.m === q.createdAt.getMonth()); if (b) b.amount += q.grandTotal ?? 0; }
    monthly = buckets.map(b => ({ label: `${b.m + 1}월`, amount: b.amount }));

    // 최근 활동 (견적·계약·노트 통합 타임라인)
    const [rQuotes, rContracts, rNotes] = await Promise.all([
      prisma.quote.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, quoteNumber: true, customerCompany: true, status: true, createdAt: true } }),
      prisma.contract.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true, deal: { select: { title: true } } } }),
      prisma.note.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, type: true, title: true, createdAt: true, deal: { select: { title: true } } } }),
    ]);
    activity = [
      ...rQuotes.map(q => ({ id: `q${q.id}`, kind: '견적', text: `${q.customerCompany ?? '견적'} · ${q.quoteNumber}`, sub: STATUS[q.status]?.label ?? q.status, at: q.createdAt })),
      ...rContracts.map(c => ({ id: `c${c.id}`, kind: '계약', text: c.deal?.title ?? '계약', sub: c.status, at: c.createdAt })),
      ...rNotes.map(n => ({ id: `n${n.id}`, kind: '노트', text: n.title || n.deal?.title || '메모', sub: n.type, at: n.createdAt })),
    ].sort((a, b) => +b.at - +a.at).slice(0, 7).map(x => ({ ...x, at: x.at.toISOString() }));
  } catch { /* DB 미연결 시 0 */ }
  const fmtM = (n: number) => n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(1)}M` : `₩${n.toLocaleString()}`;

  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="space-y-7 animate-fade-in">
      <div>
        <h1 className="text-display text-ink">안녕하세요, {name}님 👋</h1>
        <p className="text-subhead text-ink-muted mt-2">{todayStr} · 진행 중인 견적 {kpi.inProgress}건과 마감이 임박한 시험 {dueStudies.length}건이 있습니다.</p>
      </div>

      {/* 업무 KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Receipt className="w-4 h-4" />} label="이번 달 견적" value={`${kpi.thisMonth}`} unit="건" sub="전월 대비" delta={kpi.quoteDelta} />
        <StatCard icon={<Clock className="w-4 h-4" />} label="진행 중" value={`${kpi.inProgress}`} unit="건" sub="작성·발행·발송" />
        <StatCard icon={<Coins className="w-4 h-4" />} label="수주 금액" value={fmtM(kpi.wonAmt)} sub={`수주율 ${kpi.wonRate}%`} invert />
        <StatCard icon={<FlaskConical className="w-4 h-4" />} label="진행 시험" value={`${kpi.runningStudies}`} unit="건" sub="보고서안 발행 전" />
      </div>

      {/* CRM 알람 · 예정 일정 */}
      <DashboardAlarms />

      {/* 월별 수주 추이 + 마감 임박 시험 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="rounded-[12px] bg-slate-900 p-[22px] min-w-0 lg:col-span-2 text-white">
          <h2 className="text-card-title flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-400" /> 월별 수주 추이 <span className="text-xs font-normal text-white/50">최근 6개월 · 단위 ₩M</span>
          </h2>
          <MonthlyChart data={monthly} />
        </section>

        <section className="card p-[22px] min-w-0">
          <h2 className="text-card-title text-ink flex items-center gap-2 mb-4">
            <AlarmClock className="w-4 h-4 text-brand-500" /> 마감 임박 시험
          </h2>
          {dueStudies.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-subtle">예정된 보고서안 발행이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dueStudies.map(s => {
                const dd = ddayLabel(s.dueAt);
                return (
                  <li key={s.id} className="flex items-center gap-2 py-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink truncate">{s.name}</span>
                      <span className="block text-[11px] text-ink-subtle truncate">{s.company || '고객사 미지정'}</span>
                    </span>
                    <span className={`pill flex-shrink-0 ${dd.cls}`}>{dd.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 최근 견적 */}
        <section className="card p-[22px] min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-card-title text-ink flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand-500" /> 최근 견적
            </h2>
            <Link href="/quotes" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5">
              전체 보기 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {quotes.length === 0 ? (
            <div className="py-10 text-center">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-brand-50 text-brand-400 mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-sm text-ink-muted">아직 저장된 견적이 없습니다.</div>
              <Link href="/quote-v2" className="btn-primary text-xs mt-3">
                <FileText className="w-3.5 h-3.5" /> 첫 견적 작성하기
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {quotes.map(q => {
                const st = STATUS[q.status] ?? STATUS.DRAFT;
                return (
                  <li key={q.id}>
                    <Link href={`/quote/print?id=${q.id}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 py-2.5 hover:bg-slate-50/60 -mx-2 px-2 rounded-lg transition-colors">
                      <span className="hidden sm:block text-xs text-ink-subtle font-mono w-28 flex-shrink-0 truncate">{q.quoteNumber}</span>
                      <span className="order-1 sm:order-none flex-1 min-w-0 text-sm text-ink truncate">
                        {q.customerCompany || '(고객사 미지정)'} · <span className="text-ink-muted">{q.modality}</span>
                      </span>
                      <div className="order-2 sm:order-none flex items-center gap-2 min-w-0 sm:contents">
                        <span className="sm:hidden text-[11px] text-ink-subtle font-mono truncate">{q.quoteNumber}</span>
                        <span className={`pill ${st.cls} flex-shrink-0 ml-auto sm:ml-0`}>{st.label}</span>
                        <span className="text-sm font-semibold text-ink tabular-nums sm:w-32 sm:text-right flex-shrink-0 whitespace-nowrap">
                          ₩{(q.grandTotal ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 모달리티별 항목 수 (막대) */}
        <section className="card p-[22px] min-w-0">
          <h2 className="text-card-title text-ink flex items-center gap-2 mb-4">
            <Boxes className="w-4 h-4 text-brand-500" /> 모달리티별 항목 수
          </h2>
          <ul className="space-y-2 max-h-[320px] overflow-auto pr-1">
            {modalityRows.map(([m, n]) => (
              <li key={m} className="flex items-center gap-3">
                <span className="text-xs text-ink w-28 flex-shrink-0 truncate" title={m}>{m}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${Math.max(6, (n / maxCount) * 100)}%` }} />
                </div>
                <span className="text-xs text-ink-subtle tabular-nums w-9 text-right flex-shrink-0">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 최근 활동 */}
      <section className="card p-[22px] min-w-0">
        <h2 className="text-card-title text-ink flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-brand-500" /> 최근 활동
        </h2>
        {activity.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-subtle">최근 활동이 없습니다.</div>
        ) : (
          <ul className="space-y-3">
            {activity.map(a => {
              const ic = ACTIVITY_ICON[a.kind] ?? Activity;
              const Icon = ic;
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-500 flex-shrink-0"><Icon className="w-4 h-4" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink truncate">{a.text}</span>
                    <span className="block text-[11px] text-ink-subtle">{a.kind} · {a.sub}</span>
                  </span>
                  <span className="text-[11px] text-ink-subtle tabular-nums flex-shrink-0">{fmtDay(a.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const ACTIVITY_ICON: Record<string, typeof Activity> = { 견적: Receipt, 계약: FileSignature, 노트: NotebookPen };

function ddayLabel(iso: string): { label: string; cls: string } {
  const days = Math.ceil((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return { label: 'D-DAY', cls: 'bg-red-100 text-red-700' };
  if (days < 0) return { label: `D+${-days}`, cls: 'bg-slate-200 text-ink-subtle' };
  return { label: `D-${days}`, cls: days <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-ink-muted' };
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function MonthlyChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.amount));
  const hasData = data.some(d => d.amount > 0);
  return (
    <div>
      <div className="flex items-end justify-between gap-2 h-36">
        {data.map((d, i) => (
          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0">
            <span className="text-[9px] text-white/70 tabular-nums">{d.amount > 0 ? Math.round(d.amount / 1_000_000) : ''}</span>
            <div className={`w-full max-w-[40px] rounded-t ${i === data.length - 1 ? 'bg-brand-500' : 'bg-white/20'}`} style={{ height: `${Math.max(2, (d.amount / max) * 100)}%` }} title={`${d.label}: ₩${d.amount.toLocaleString()}`} />
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 mt-1.5">
        {data.map((d, i) => <span key={i} className="flex-1 text-center text-[10px] text-white/50">{d.label}</span>)}
      </div>
      {!hasData && <div className="text-center text-[11px] text-white/50 mt-2">아직 수주(ACCEPTED) 견적이 없습니다.</div>}
    </div>
  );
}

function Delta({ v }: { v: number }) {
  if (!v) return null;
  const up = v > 0;
  return <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-emerald-500' : 'text-red-500'}`}>{up ? '▲' : '▼'}{Math.abs(v)}</span>;
}
function StatCard({ icon, label, value, unit, sub, invert, delta }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub?: string; invert?: boolean; delta?: number }) {
  // 강조 KPI는 컬러가 아니라 블랙 반전(polarity flip)으로 (Notion 원칙)
  if (invert) {
    return (
      <div className="rounded-[12px] bg-slate-900 pt-[22px] px-[22px] pb-5 text-white">
        <div className="flex items-center gap-2 text-white/60 mb-3">{icon}<span className="text-[12.5px] font-semibold">{label}</span></div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-kpi tabular-nums">{value}</span>
          {unit && <span className="text-[14px] text-white/60">{unit}</span>}
        </div>
        {(sub || delta != null) && <div className="text-[12.5px] font-semibold text-white/60 mt-2 flex items-center gap-1.5">{delta != null && <Delta v={delta} />}{sub}</div>}
      </div>
    );
  }
  return (
    <div className="card pt-[22px] px-[22px] pb-5">
      <div className="flex items-center gap-2 text-ink-muted mb-3">
        {icon}
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-kpi text-ink tabular-nums">{value}</span>
        {unit && <span className="text-[14px] text-ink-muted">{unit}</span>}
      </div>
      {(sub || delta != null) && <div className="text-[12.5px] font-semibold text-ink-muted mt-2 flex items-center gap-1.5">{delta != null && <Delta v={delta} />}{sub}</div>}
    </div>
  );
}
