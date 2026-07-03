import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureHydrated } from '@/lib/hydrate';

// 통계·목록을 매 요청 갱신 (런타임 DB 반영). 정적 프리렌더 금지.
export const dynamic = 'force-dynamic';

// 상태점 색(components.css): 작성중 muted-soft · 발행 accent · 발송 status-sent · 수주 success · 반려 error
const STATUS: Record<string, { label: string; dot: string }> = {
  DRAFT: { label: '작성중', dot: 'var(--muted-soft)' },
  ISSUED: { label: '발행', dot: 'var(--accent)' },
  SENT: { label: '발송', dot: 'var(--status-sent)' },
  ACCEPTED: { label: '수주', dot: 'var(--success)' },
  REJECTED: { label: '반려', dot: 'var(--error)' },
};

export default async function Home() {
  await ensureHydrated();
  const session = await getServerSession(authOptions);
  const name = session?.user?.name ?? '데모 사용자';  // DEMO(임시): 로그인 OFF

  let quotes: Array<{ id: number; quoteNumber: string; customerCompany: string | null; modality: string; status: string; grandTotal: number | null }> = [];
  let kpi = { thisMonth: 0, inProgress: 0, wonAmt: 0, wonRate: 0, runningStudies: 0, quoteDelta: 0, wonDelta: 0 };
  let dueStudies: { id: number; name: string; company: string; dueAt: string; duration: string }[] = [];
  let monthly: { label: string; amount: number }[] = [];
  let activity: { id: string; kind: string; text: string; sub: string; at: string }[] = [];
  try {
    // 진행 중 견적(작성·발행·발송) — 좌측 리스트
    quotes = await prisma.quote.findMany({
      where: { status: { in: ['DRAFT', 'ISSUED', 'SENT'] } },
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, quoteNumber: true, customerCompany: true, modality: true, status: true, grandTotal: true },
    });
    const all = await prisma.quote.findMany({ select: { status: true, grandTotal: true, createdAt: true } });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const won = all.filter(q => q.status === 'ACCEPTED');
    const thisMonthN = all.filter(q => q.createdAt >= monthStart).length;
    const lastMonthN = all.filter(q => q.createdAt >= lastMonthStart && q.createdAt < monthStart).length;
    kpi = {
      thisMonth: thisMonthN,
      inProgress: all.filter(q => ['DRAFT', 'ISSUED', 'SENT'].includes(q.status)).length,
      wonAmt: won.reduce((s, q) => s + (q.grandTotal ?? 0), 0),
      wonRate: all.length ? Math.round(won.length / all.length * 100) : 0,
      runningStudies: await prisma.study.count({ where: { reportDraftIssuedAt: null } }),
      quoteDelta: thisMonthN - lastMonthN,
      wonDelta: 0,
    };

    // 마감 임박 시험 (보고서안 미발행, 가까운 순)
    const studies = await prisma.study.findMany({
      where: { reportDraftIssuedAt: null, reportDraftDueAt: { not: null } },
      orderBy: { reportDraftDueAt: 'asc' }, take: 5,
      select: { id: true, itemName: true, studyNumber: true, reportDraftDueAt: true, deal: { select: { title: true, contact: { select: { company: { select: { name: true } } } } } } },
    });
    dueStudies = studies.map(s => ({
      id: s.id, name: s.itemName || s.deal.title,
      company: s.deal.contact?.company?.name ?? '',
      dueAt: s.reportDraftDueAt!.toISOString(),
      duration: s.studyNumber ?? '',
    }));

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
    ].sort((a, b) => +b.at - +a.at).slice(0, 6).map(x => ({ ...x, at: x.at.toISOString() }));
  } catch { /* DB 미연결 시 0 */ }

  const fmtM = (n: number) => n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(1)}M` : (n > 0 ? `₩${n.toLocaleString()}` : '₩0');
  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="animate-fade-in">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.022em] text-ink sm:text-display">안녕하세요, {name}님</h1>
        <p className="text-[14px] sm:text-subhead text-ink-body mt-2 sm:mt-3">{todayStr} · 진행 중인 견적 {kpi.inProgress}건과 마감이 임박한 시험 {dueStudies.length}건이 있습니다.</p>
      </div>

      {/* KPI 4카드 — 아이콘 없음, 수주 금액은 블랙 반전(#000) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="이번 달 견적" value={`${kpi.thisMonth}`} unit="건" delta={kpi.quoteDelta} note="지난달 대비" />
        <StatCard label="진행 중" value={`${kpi.inProgress}`} unit="건" note="작성·발행·발송" />
        <StatCard label="수주 금액" value={fmtM(kpi.wonAmt)} note={`수주율 ${kpi.wonRate}%`} invert />
        <StatCard label="진행 시험" value={`${kpi.runningStudies}`} unit="건" note="보고서안 발행 전" />
      </div>

      {/* 진행 중 견적 (459) | 마감 임박 시험 (306) */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* 진행 중 견적 */}
        <section className="card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between pt-5 px-6 pb-[14px]">
            <h2 className="text-[22px] font-bold text-ink tracking-tight">진행 중 견적</h2>
            <Link href="/quotes" className="link">전체 보기 →</Link>
          </div>
          {quotes.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-ink-subtle border-t border-[var(--hairline-soft)]">진행 중인 견적이 없습니다.</div>
          ) : (
            <ul>
              {quotes.map(q => {
                const st = STATUS[q.status] ?? STATUS.DRAFT;
                const initial = (q.customerCompany || '?').trim().charAt(0);
                return (
                  <li key={q.id}>
                    <Link href={`/quote/print?id=${q.id}`} className="flex items-center gap-3.5 px-6 py-[14px] border-t border-[var(--hairline-soft)] hover:bg-slate-100 transition-colors">
                      <span className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-[9px] bg-slate-100 text-ink-muted text-[15px] font-semibold flex-shrink-0">{initial}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] text-ink truncate">{q.customerCompany || '(고객사 미지정)'}</div>
                        <div className="text-[12px] font-mono text-ink-subtle truncate">{q.quoteNumber} · {q.modality}</div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-[11px] py-1 text-[12px] font-medium text-ink-muted flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />{st.label}
                      </span>
                      <span className="text-[20px] font-bold text-ink tabular-nums text-right w-[92px] flex-shrink-0">{fmtM(q.grandTotal ?? 0)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 마감 임박 시험 */}
        <section className="card pt-5 px-[22px] pb-2 lg:col-span-2">
          <h2 className="text-[22px] font-bold text-ink tracking-tight mb-1">마감 임박 시험</h2>
          {dueStudies.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-subtle">예정된 보고서안 발행이 없습니다.</div>
          ) : (
            <ul>
              {dueStudies.map(s => {
                const dd = ddayLabel(s.dueAt);
                return (
                  <li key={s.id} className="flex items-center gap-3.5 py-[11px] border-t border-[var(--hairline-soft)] first:border-t-0">
                    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-[10px] text-[14px] font-semibold flex-shrink-0 ${dd.urgent ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-ink-muted'}`}>{dd.label}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] text-ink truncate">{s.name}</div>
                      <div className="text-[12px] text-ink-subtle truncate">{[s.company || '고객사 미지정', s.duration].filter(Boolean).join(' · ')}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 월별 수주 추이 (다크) | 최근 활동 */}
      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        {/* 월별 수주 추이 — 피처 다크 카드(#191919) */}
        <section className="rounded-[12px] bg-slate-900 pt-[22px] px-6 pb-5 text-white lg:col-span-3">
          <div className="flex items-baseline gap-2 mb-5">
            <h2 className="text-[22px] font-bold tracking-tight">월별 수주 추이</h2>
            <span className="text-[13px] font-normal text-white/50">최근 6개월 · 단위 ₩M</span>
          </div>
          <MonthlyChart data={monthly} />
        </section>

        {/* 최근 활동 */}
        <section className="card pt-[22px] px-[22px] pb-2 lg:col-span-2">
          <h2 className="text-[22px] font-bold text-ink tracking-tight mb-2">최근 활동</h2>
          {activity.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-subtle">최근 활동이 없습니다.</div>
          ) : (
            <ul>
              {activity.map(a => (
                <li key={a.id} className="flex items-start gap-3 py-[11px] border-t border-[var(--hairline-soft)] first:border-t-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[7px]" style={{ background: ACTIVITY_DOT[a.kind] ?? 'var(--muted-soft)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-ink truncate">{a.text}</div>
                    <div className="text-[12px] text-ink-subtle">{a.kind} · {a.sub}</div>
                  </div>
                  <span className="text-[12px] text-ink-subtle tabular-nums flex-shrink-0">{fmtDay(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const ACTIVITY_DOT: Record<string, string> = { 견적: 'var(--accent)', 계약: 'var(--success)', 노트: 'var(--status-sent)' };

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function MonthlyChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.amount));
  const hasData = data.some(d => d.amount > 0);
  return (
    <div>
      <div className="flex items-end justify-between gap-3 h-[130px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-white/70 tabular-nums">{d.amount > 0 ? Math.round(d.amount / 1_000_000) : ''}</span>
            <div className={`w-full max-w-[46px] rounded-t-[5px] ${i === data.length - 1 ? 'bg-brand-600' : 'bg-white/20'}`} style={{ height: `${Math.max(2, (d.amount / max) * 100)}%` }} title={`${d.label}: ₩${d.amount.toLocaleString()}`} />
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-3 mt-2">
        {data.map((d, i) => <span key={i} className="flex-1 text-center text-[11px] text-white/50">{d.label}</span>)}
      </div>
      {!hasData && <div className="text-center text-[11px] text-white/50 mt-3">아직 수주(ACCEPTED) 견적이 없습니다.</div>}
    </div>
  );
}

function ddayLabel(iso: string): { label: string; urgent: boolean } {
  const days = Math.ceil((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return { label: 'D-DAY', urgent: true };
  if (days < 0) return { label: `D+${-days}`, urgent: false };
  return { label: `D-${days}`, urgent: days <= 7 };
}

function Delta({ v }: { v: number }) {
  if (!v) return null;
  const up = v > 0;
  return <span className={`inline-flex items-center gap-0.5 ${up ? 'text-emerald-500' : 'text-red-500'}`}>{up ? '▲' : '▼'}{Math.abs(v)}</span>;
}

function StatCard({ label, value, unit, note, invert, delta }: { label: string; value: string; unit?: string; note?: string; invert?: boolean; delta?: number }) {
  // 강조 KPI = 컬러가 아니라 블랙 반전(#000, polarity flip)
  const box = invert ? 'bg-ink text-white' : 'card';
  const labelC = invert ? 'text-white/85' : 'text-ink-muted';
  const numC = invert ? 'text-white' : 'text-ink';
  const noteC = invert ? 'text-white/72' : 'text-ink-muted';
  return (
    <div className={`${box} rounded-[12px] pt-[22px] px-[22px] pb-5`}>
      <div className={`text-[13px] font-medium ${labelC}`}>{label}</div>
      <div className="flex items-baseline gap-1.5 mt-3">
        <span className={`text-kpi tabular-nums ${numC}`}>{value}</span>
        {unit && <span className={`text-[14px] ${labelC}`}>{unit}</span>}
      </div>
      {(note || delta != null) && (
        <div className={`text-[13px] font-medium mt-2 flex items-center gap-1.5 ${noteC}`}>
          {delta != null && <Delta v={delta} />}{note}
        </div>
      )}
    </div>
  );
}
