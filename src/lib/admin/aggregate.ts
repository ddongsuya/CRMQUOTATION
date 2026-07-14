/**
 * 관리자 대시보드 — 스코프 롤업 집계 (서버 전용).
 *
 * 집계 정의(실 스키마 기반 — 사업 정의와 다르면 조정 필요):
 *  · 수주(won)      = Quote.status='ACCEPTED', 금액=grandTotal
 *  · 파이프라인      = Quote.status ∈ {DRAFT,ISSUED,SENT,REVIEWED}, 금액=grandTotal
 *  · 수주율(winRate)= ACCEPTED / (ACCEPTED+REJECTED), 건수 기준
 *  · 활동량          = Note + CalendarEvent 건수
 *  · 담당자→센터 롤업 = User.centerId. 견적 귀속 = Quote.userId.
 *  · 월 그룹핑        = createdAt 기준(데모 견적은 수주월=createdAt 로 시딩).
 *
 * 스코프(README §0): 전체(전사)·센터·개인. 서버 파라미터 scope/centerId/userId 매핑.
 */
import { prisma } from '../prisma';

export type Scope =
  | { kind: 'all' }
  | { kind: 'center'; centerId: number }
  | { kind: 'user'; userId: number };

const PIPELINE_STATUS = ['DRAFT', 'ISSUED', 'SENT', 'REVIEWED'];
const WON_STATUS = 'ACCEPTED';
const LOST_STATUS = 'REJECTED';

/** 기간 키 → createdAt 범위. 2026H1=상반기, 2026=연간. */
export function periodRange(period: string): { gte: Date; lt: Date } {
  const m = /^(\d{4})(H1|H2)?$/.exec(period);
  const y = m ? Number(m[1]) : 2026;
  if (m?.[2] === 'H1') return { gte: new Date(y, 0, 1), lt: new Date(y, 6, 1) };
  if (m?.[2] === 'H2') return { gte: new Date(y, 6, 1), lt: new Date(y + 1, 0, 1) };
  return { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
}

/**
 * URL searchParams → Scope. 관리자 뷰만 전사/센터 허용, 일반은 개인(self) 고정.
 *  ?scope=all | center&centerId=1 | user&userId=3
 */
export function parseScope(
  sp: { scope?: string; centerId?: string; userId?: string },
  view: { isAdminView: boolean; selfId: number; selfCenterId: number | null },
): Scope {
  if (!view.isAdminView) return { kind: 'user', userId: view.selfId };
  if (sp.scope === 'center') {
    const centerId = Number(sp.centerId);
    if (Number.isFinite(centerId)) return { kind: 'center', centerId };
  }
  if (sp.scope === 'user') {
    const userId = Number(sp.userId);
    return { kind: 'user', userId: Number.isFinite(userId) ? userId : view.selfId }; // 개인=본인
  }
  return { kind: 'all' };
}

/** 스코프 → 대상 담당자 id 집합. */
export async function scopeUserIds(scope: Scope): Promise<number[]> {
  if (scope.kind === 'user') return [scope.userId];
  const where = scope.kind === 'center' ? { centerId: scope.centerId } : {};
  const users = await prisma.user.findMany({ where, select: { id: true } });
  return users.map((u) => u.id);
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

/**
 * 대시보드(홈) 12종 시각화용 데이터 일괄 산출.
 * year 는 추이/월별 차트 기준 연도(기본: 파라미터로 주입).
 */
export async function getDashboardData(scope: Scope, year: number) {
  const uids = await scopeUserIds(scope);
  const inUids = { in: uids };

  // 마스터: 유저·센터 (라벨·롤업)
  const [users, centers] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, role: true, centerId: true } }),
    prisma.center.findMany({ select: { id: true, name: true } }),
  ]);
  const centerName = new Map(centers.map((c) => [c.id, c.name]));
  const userCenter = new Map(users.map((u) => [u.id, u.centerId] as const));
  const userName = new Map(users.map((u) => [u.id, u.name ?? '—'] as const));

  // 데이터: 견적·안건·고객사·활동 (스코프 담당자 한정)
  const [quotes, deals, companies, notes, events] = await Promise.all([
    prisma.quote.findMany({
      where: { userId: inUids, createdAt: periodRange(`${year}H1`) },
      select: { userId: true, status: true, grandTotal: true, createdAt: true, customerCompany: true },
    }),
    prisma.deal.findMany({ where: { ownerId: inUids }, select: { ownerId: true, status: true, stage: true } }),
    prisma.company.findMany({
      where: { ownerId: inUids },
      select: { id: true, ownerId: true, name: true, industry: true, isNewClient: true },
    }),
    prisma.note.findMany({ where: { ownerId: inUids }, select: { ownerId: true, occurredAt: true } }),
    prisma.calendarEvent.findMany({ where: { ownerId: inUids }, select: { ownerId: true, startAt: true } }),
  ]);
  const noteCount = notes.length;
  const eventCount = events.length;

  const amt = (q: { grandTotal: number | null }) => q.grandTotal ?? 0;
  const isWon = (s: string) => s === WON_STATUS;
  const isPipe = (s: string) => PIPELINE_STATUS.includes(s);

  // ── KPI / 히어로 ──────────────────────────────
  let wonAmount = 0, wonCount = 0, pipelineAmount = 0, pipelineCount = 0, acc = 0, rej = 0;
  for (const q of quotes) {
    if (isWon(q.status)) { wonAmount += amt(q); wonCount++; acc++; }
    else if (isPipe(q.status)) { pipelineAmount += amt(q); pipelineCount++; }
    if (q.status === LOST_STATUS) rej++;
  }
  const winRate = acc + rej > 0 ? acc / (acc + rej) : 0;
  const activityCount = noteCount + eventCount;
  const newClientCount = companies.filter((c) => c.isNewClient).length;

  // ── 월별 추이 (수주·파이프라인·활동) ──────────
  const monthlyWon = Array.from({ length: 12 }, () => 0);
  const monthlyAcc = Array.from({ length: 12 }, () => 0);
  const monthlyRej = Array.from({ length: 12 }, () => 0);
  const monthlyPipeline = Array.from({ length: 12 }, () => 0);
  const monthlyPipelineCount = Array.from({ length: 12 }, () => 0);
  const monthlyActivity = Array.from({ length: 12 }, () => 0);
  for (const q of quotes) {
    if (q.createdAt.getFullYear() !== year) continue;
    const m = q.createdAt.getMonth();
    if (isWon(q.status)) { monthlyWon[m] += amt(q); monthlyAcc[m]++; }
    if (q.status === LOST_STATUS) monthlyRej[m]++;
    if (isPipe(q.status)) { monthlyPipeline[m] += amt(q); monthlyPipelineCount[m]++; }
  }
  for (const n of notes) if (n.occurredAt.getFullYear() === year) monthlyActivity[n.occurredAt.getMonth()]++;
  for (const e of events) if (e.startAt.getFullYear() === year) monthlyActivity[e.startAt.getMonth()]++;
  // 수주율 추이(월별)
  const winRateSeries = monthlyAcc.map((a, m) => {
    const d = a + monthlyRej[m];
    return d > 0 ? a / d : null;
  });

  // ── 센터별 월간 추이 (그룹 막대, 전사 기준 — 스코프 무관하게 센터 비교) ──
  const centerMonthly = centers.map((c) => ({ centerId: c.id, name: c.name, months: Array.from({ length: 12 }, () => 0) }));
  const centerMonthlyIdx = new Map(centerMonthly.map((r, i) => [r.centerId, i]));
  // ── 센터 구성 (도넛: 수주금액 by 센터) ──
  const centerWon = new Map<number | null, number>();
  for (const q of quotes) {
    if (!isWon(q.status)) continue;
    const cid = userCenter.get(q.userId ?? -1) ?? null;
    centerWon.set(cid, (centerWon.get(cid) ?? 0) + amt(q));
    if (q.createdAt.getFullYear() === year && cid != null && centerMonthlyIdx.has(cid)) {
      centerMonthly[centerMonthlyIdx.get(cid)!].months[q.createdAt.getMonth()] += amt(q);
    }
  }
  const centerDonut = centers.map((c) => ({ name: c.name, amount: centerWon.get(c.id) ?? 0 }));

  // ── 산업별 분포 (수주금액·건수 by company.industry) ──
  // 견적→고객사(customerCompany명) 매칭이 불안정하므로, 고객사별 수주는 담당자 소유 고객사 industry로 집계.
  const companyById = new Map(companies.map((c) => [c.name, c] as const));
  const industryAgg = new Map<string, { amount: number; count: number }>();
  for (const q of quotes) {
    if (!isWon(q.status)) continue;
    const co = q.customerCompany ? companyById.get(q.customerCompany) : null;
    const ind = co?.industry ?? '기타';
    const cur = industryAgg.get(ind) ?? { amount: 0, count: 0 };
    cur.amount += amt(q); cur.count++;
    industryAgg.set(ind, cur);
  }
  const byIndustry = [...industryAgg.entries()].map(([industry, v]) => ({ industry, ...v })).sort((a, b) => b.amount - a.amount);

  // ── 파이프라인 퍼널 (안건 stage 분포) ──
  const STAGES = ['INQUIRY', 'QUOTE', 'INTAKE', 'CONTRACT', 'STUDY', 'INVOICE', 'DONE'];
  const stageCount = new Map(STAGES.map((s) => [s, 0]));
  for (const d of deals) stageCount.set(d.stage, (stageCount.get(d.stage) ?? 0) + 1);
  const funnel = STAGES.map((s) => ({ stage: s, count: stageCount.get(s) ?? 0 }));

  // ── 상위 고객 (담당자 소유 고객사별 수주누계) ──
  const custWon = new Map<string, number>();
  const custPipe = new Map<string, number>();
  for (const q of quotes) {
    const key = q.customerCompany ?? '—';
    if (isWon(q.status)) custWon.set(key, (custWon.get(key) ?? 0) + amt(q));
    else if (isPipe(q.status)) custPipe.set(key, (custPipe.get(key) ?? 0) + amt(q));
  }
  const topCustomers = companies
    .map((c) => ({
      name: c.name,
      industry: c.industry ?? '—',
      owner: userName.get(c.ownerId) ?? '—',
      center: centerName.get(userCenter.get(c.ownerId) ?? -1) ?? '—',
      won: custWon.get(c.name) ?? 0,
      pipeline: custPipe.get(c.name) ?? 0,
    }))
    .sort((a, b) => b.won - a.won || b.pipeline - a.pipeline)
    .slice(0, 8);

  // ── 담당자 요약 (스코프 내 담당자별 건수·수주·수주율) ──
  const memberAgg = new Map<number, { won: number; acc: number; rej: number; count: number }>();
  for (const q of quotes) {
    const uid = q.userId!;
    const cur = memberAgg.get(uid) ?? { won: 0, acc: 0, rej: 0, count: 0 };
    cur.count++;
    if (isWon(q.status)) { cur.won += amt(q); cur.acc++; }
    if (q.status === LOST_STATUS) cur.rej++;
    memberAgg.set(uid, cur);
  }
  const memberSummary = [...memberAgg.entries()]
    .map(([uid, v]) => ({
      userId: uid,
      name: userName.get(uid) ?? '—',
      center: centerName.get(userCenter.get(uid) ?? -1) ?? '—',
      role: users.find((u) => u.id === uid)?.role ?? 'MEMBER',
      won: v.won,
      count: v.count,
      winRate: v.acc + v.rej > 0 ? v.acc / (v.acc + v.rej) : 0,
    }))
    .sort((a, b) => b.won - a.won);

  // ── 담당자별 활동량 (노트+일정, 인메모리 집계) ──
  const actMap = new Map<number, number>();
  for (const n of notes) actMap.set(n.ownerId, (actMap.get(n.ownerId) ?? 0) + 1);
  for (const e of events) actMap.set(e.ownerId, (actMap.get(e.ownerId) ?? 0) + 1);
  const activityByMember = [...actMap.entries()]
    .map(([uid, count]) => ({ name: userName.get(uid) ?? '—', count }))
    .sort((a, b) => b.count - a.count);

  return {
    scope,
    year,
    kpi: { wonAmount, wonCount, pipelineAmount, pipelineCount, activeQuoteCount: pipelineCount, winRate, activityCount, companyCount: companies.length, newClientCount },
    monthlyWon,
    monthlyPipeline,
    monthlyPipelineCount,
    monthlyActivity,
    winRateSeries,
    centerMonthly,
    centerDonut,
    byIndustry,
    funnel,
    topCustomers,
    memberSummary,
    activityByMember,
  };
}

/**
 * 활동 히트맵 — 최근 weeks주 × 요일(월~일) 활동 강도.
 * 활동 = Note.occurredAt + CalendarEvent.startAt (스코프 담당자).
 */
export async function getActivityHeatmap(scope: Scope, refDate: Date, weeks = 12) {
  const uids = await scopeUserIds(scope);
  const start = new Date(refDate);
  start.setHours(0, 0, 0, 0);
  // 이번 주 월요일 기준으로 정렬
  const dow = (start.getDay() + 6) % 7; // 월=0
  const gridStart = new Date(start.getTime() - (dow + (weeks - 1) * 7) * 86400000);

  const [notes, events] = await Promise.all([
    prisma.note.findMany({ where: { ownerId: { in: uids }, occurredAt: { gte: gridStart } }, select: { occurredAt: true } }),
    prisma.calendarEvent.findMany({ where: { ownerId: { in: uids }, startAt: { gte: gridStart } }, select: { startAt: true } }),
  ]);
  // 7행(요일) × weeks열
  const cells = Array.from({ length: 7 }, () => Array.from({ length: weeks }, () => 0));
  let max = 0, total = 0;
  const place = (d: Date) => {
    const days = Math.floor((d.getTime() - gridStart.getTime()) / 86400000);
    if (days < 0) return;
    const wk = Math.floor(days / 7);
    const wd = days % 7;
    if (wk < 0 || wk >= weeks) return;
    cells[wd][wk]++; total++;
    if (cells[wd][wk] > max) max = cells[wd][wk];
  };
  for (const n of notes) place(n.occurredAt);
  for (const e of events) place(e.startAt);
  return { cells, max, total, weeks };
}

/** 목표 대비 달성률(게이지). scope=all→전사 목표, center→센터 목표. */
export async function getTargetGauge(scope: Scope, period: string) {
  const uids = await scopeUserIds(scope);
  const won = await prisma.quote.aggregate({
    _sum: { grandTotal: true },
    where: { status: WON_STATUS, userId: { in: uids }, createdAt: periodRange(period) },
  });
  const actual = won._sum.grandTotal ?? 0;
  const centerId = scope.kind === 'center' ? scope.centerId : null;
  const target = await prisma.target.findFirst({ where: { centerId, period } });
  const goal = target?.amount ?? null;
  return { actual, target: goal, rate: goal && goal > 0 ? actual / goal : null, period, hasTarget: !!target };
}

/** 일일 업무보고 목록(스코프 담당자, 날짜 내림차순). */
export async function getDailyReports(scope: Scope, limit = 120) {
  const uids = await scopeUserIds(scope);
  const { userName } = await centerNameMap();
  const reports = await prisma.dailyReport.findMany({
    where: { ownerId: { in: uids } },
    orderBy: { date: 'desc' },
    take: limit,
    select: { id: true, ownerId: true, date: true, workContent: true, contractPlan: true, activityNote: true, contractAmount: true },
  });
  return reports.map((r) => ({ ...r, owner: userName.get(r.ownerId) ?? '—' }));
}

/** 고객사명 목록(일일보고 본문 자동 링크용). */
export async function companyNames(): Promise<string[]> {
  const cos = await prisma.company.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
  return cos.map((c) => c.name).filter(Boolean);
}

/** 회사(고객사)명 기준 관련 항목 집계 — 드로어·상세 페이지 공용. */
export async function getCompanyDetail(name: string) {
  // 회사 먼저 조회 → 견적은 companyId(FK) OR 이름으로 매칭(표기 변형까지 견고하게)
  const company = await prisma.company.findFirst({
    where: { name },
    select: {
      id: true, industry: true, memo: true, isNewClient: true,
      owner: { select: { name: true, center: { select: { name: true } } } },
      contacts: { select: { name: true, position: true, email: true, phone: true } },
    },
  });
  const quoteWhere = company ? { OR: [{ companyId: company.id }, { customerCompany: name }] } : { customerCompany: name };
  const [quotes, reports, prospect] = await Promise.all([
    prisma.quote.findMany({
      where: quoteWhere,
      orderBy: { sentAt: 'desc' },
      select: { id: true, quoteNumber: true, sentAt: true, projectName: true, grandTotal: true, status: true, trackingNote: true, testStandard: true, submissionPurpose: true, discountRate: true },
    }),
    prisma.dailyReport.findMany({
      where: { OR: [{ workContent: { contains: name } }, { contractPlan: { contains: name } }, { activityNote: { contains: name } }] },
      orderBy: { date: 'desc' }, take: 30,
      select: { id: true, date: true, workContent: true, contractPlan: true, activityNote: true },
    }),
    prisma.prospect.findFirst({ where: { name }, select: { id: true, pipeline: true, stage: true, indTarget: true, croOutlook: true } }),
  ]);

  let won = 0, pipeline = 0, acc = 0, rej = 0;
  for (const q of quotes) {
    if (q.status === WON_STATUS) { won += q.grandTotal ?? 0; acc++; }
    else if (q.status === LOST_STATUS) rej++;
    if (PIPELINE_STATUS.includes(q.status)) pipeline += q.grandTotal ?? 0;
  }
  const snip = (r: { workContent: string | null; contractPlan: string | null; activityNote: string | null }) => {
    const text = [r.workContent, r.contractPlan, r.activityNote].filter(Boolean).join(' ');
    const idx = text.indexOf(name);
    if (idx < 0) return text.slice(0, 90);
    return (idx > 30 ? '…' : '') + text.slice(Math.max(0, idx - 30), idx + 90).trim();
  };
  return {
    name,
    company: company ? {
      industry: company.industry, memo: company.memo, isNewClient: company.isNewClient,
      owner: company.owner?.name ?? '—', center: company.owner?.center?.name ?? '—', contacts: company.contacts,
    } : null,
    prospect,
    stats: { wonAmount: won, pipelineAmount: pipeline, quoteCount: quotes.length, winRate: acc + rej > 0 ? acc / (acc + rej) : null },
    quotes: quotes.map((q) => ({ ...q, sentAt: q.sentAt ? q.sentAt.toISOString().slice(0, 10) : null })),
    reports: reports.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), snippet: snip(r) })),
  };
}

/**
 * 팔로업 필요 견적 — 송부 후 minDays 경과 + 미결(결론 미정/진행중, 계약·반려 아님).
 * 임정모 시트의 "송부 후 추적" 자동화.
 */
export async function getFollowups(scope: Scope, refDate: Date, minDays = 14) {
  const uids = await scopeUserIds(scope);
  const cutoff = new Date(refDate.getTime() - minDays * 86400000);
  const OPEN_CONCLUSIONS = ['비교견적용', '내부 검토중', '결과 대기중', '예산확보'];
  const quotes = await prisma.quote.findMany({
    where: {
      userId: { in: uids },
      status: { in: PIPELINE_STATUS },
      sentAt: { not: null, lte: cutoff },
      OR: [{ trackingNote: null }, { trackingNote: { in: OPEN_CONCLUSIONS } }],
    },
    orderBy: { sentAt: 'asc' },
    select: { id: true, quoteNumber: true, customerCompany: true, projectName: true, grandTotal: true, sentAt: true, trackingNote: true },
  });
  return quotes.map((q) => ({
    ...q,
    sentAt: q.sentAt ? q.sentAt.toISOString().slice(0, 10) : null,
    days: q.sentAt ? Math.floor((refDate.getTime() - q.sentAt.getTime()) / 86400000) : 0,
  }));
}

/** 견적 상세 — 견적 드로어(추적 타임라인 포함). */
export async function getQuoteDetail(id: number) {
  const q = await prisma.quote.findUnique({
    where: { id },
    select: {
      id: true, quoteNumber: true, sentAt: true, projectName: true, customerCompany: true, customerName: true, customerPhone: true, customerEmail: true,
      studyType: true, testStandard: true, submissionPurpose: true, substanceType: true, modality: true,
      totalBeforeDiscount: true, discountRate: true, grandTotal: true, contractNo: true, contractAmount: true,
      status: true, trackingNote: true,
      trackingLog: { orderBy: { createdAt: 'desc' }, select: { id: true, conclusion: true, status: true, note: true, createdAt: true, authorId: true } },
    },
  });
  if (!q) return null;
  const authors = new Map((await prisma.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name ?? '—'] as const));
  return {
    ...q,
    sentAt: q.sentAt ? q.sentAt.toISOString().slice(0, 10) : null,
    trackingLog: q.trackingLog.map((t) => ({ ...t, author: t.authorId ? authors.get(t.authorId) ?? '—' : '—', createdAt: t.createdAt.toISOString().slice(0, 10) })),
  };
}

/** 일일보고 상세 — 기록 드로어(전문 + 언급 회사명). */
export async function getReportDetail(id: number) {
  const r = await prisma.dailyReport.findUnique({
    where: { id },
    select: { id: true, date: true, workContent: true, contractPlan: true, activityNote: true, contractAmount: true, owner: { select: { name: true } } },
  });
  if (!r) return null;
  const text = [r.workContent, r.contractPlan, r.activityNote].filter(Boolean).join(' ');
  const cos = await prisma.company.findMany({ select: { name: true } });
  const mentioned = cos.map((c) => c.name).filter((n) => n.length >= 2 && text.includes(n));
  return { ...r, date: r.date.toISOString().slice(0, 10), owner: r.owner?.name ?? '—', mentioned };
}

/** 전역 검색 — 회사·견적·기록 통합(⌘K). */
export async function getGlobalSearch(q: string) {
  const term = q.trim();
  if (term.length < 1) return { companies: [], quotes: [], reports: [] };
  const ci = { contains: term, mode: 'insensitive' as const };
  const [companies, quotes, reports] = await Promise.all([
    prisma.company.findMany({ where: { OR: [{ name: ci }, { aliases: ci }] }, select: { name: true, industry: true }, take: 6, orderBy: { name: 'asc' } }),
    prisma.quote.findMany({ where: { OR: [{ quoteNumber: ci }, { customerCompany: ci }, { projectName: ci }] }, select: { id: true, quoteNumber: true, customerCompany: true, projectName: true, status: true, trackingNote: true }, take: 8, orderBy: { sentAt: 'desc' } }),
    prisma.dailyReport.findMany({ where: { OR: [{ workContent: ci }, { activityNote: ci }, { contractPlan: ci }] }, select: { id: true, date: true, workContent: true, activityNote: true, contractPlan: true }, take: 6, orderBy: { date: 'desc' } }),
  ]);
  const snip = (r: { workContent: string | null; activityNote: string | null; contractPlan: string | null }) => {
    const text = [r.workContent, r.contractPlan, r.activityNote].filter(Boolean).join(' ');
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx < 0) return text.slice(0, 80);
    return (idx > 24 ? '…' : '') + text.slice(Math.max(0, idx - 24), idx + 70).trim();
  };
  return {
    companies,
    quotes,
    reports: reports.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), snippet: snip(r) })),
  };
}

/** 잠재 고객 목록(영업 타겟). 전사 공유 — 스코프 무관. */
export async function getProspects() {
  const rows = await prisma.prospect.findMany({
    orderBy: [{ companyId: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, pipeline: true, platform: true, stage: true, indTarget: true, croOutlook: true,
      founded: true, location: true, ceo: true, companyType: true, note: true, companyId: true,
    },
  });
  return rows;
}

/** 센터 목록(스코프 토글용). */
export function listCenters() {
  return prisma.center.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } });
}

// ─────────────────────────────────────────────────────────
// Phase 2 — 화면별 집계 (전사 스코프)
// ─────────────────────────────────────────────────────────

async function centerNameMap() {
  const [users, centers] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, centerId: true } }),
    prisma.center.findMany({ select: { id: true, name: true } }),
  ]);
  const cName = new Map(centers.map((c) => [c.id, c.name]));
  return {
    userName: new Map(users.map((u) => [u.id, u.name ?? '—'] as const)),
    userCenterName: new Map(users.map((u) => [u.id, cName.get(u.centerId ?? -1) ?? '—'] as const)),
  };
}

/** 견적 목록(전사) — 통계 4카드 + 견적 테이블. */
export async function getQuoteList(scope: Scope, period: string) {
  const uids = await scopeUserIds(scope);
  const { userName, userCenterName } = await centerNameMap();
  const quotes = await prisma.quote.findMany({
    where: { userId: { in: uids }, createdAt: periodRange(period) },
    select: { quoteNumber: true, customerCompany: true, userId: true, grandTotal: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  let won = 0, acc = 0, rej = 0, inProgress = 0;
  for (const q of quotes) {
    if (q.status === WON_STATUS) { won += q.grandTotal ?? 0; acc++; }
    else if (q.status === LOST_STATUS) rej++;
    if (PIPELINE_STATUS.includes(q.status)) inProgress++;
  }
  return {
    stats: { total: quotes.length, inProgress, wonAmount: won, winRate: acc + rej > 0 ? acc / (acc + rej) : 0 },
    rows: quotes.map((q) => ({
      quoteNumber: q.quoteNumber,
      company: q.customerCompany ?? '—',
      owner: userName.get(q.userId ?? -1) ?? '—',
      center: userCenterName.get(q.userId ?? -1) ?? '—',
      amount: q.grandTotal ?? 0,
      status: q.status,
    })),
  };
}

/** 견적 현황(전사) — 임정모 견적서 시트 1:1 재현. 전 컬럼 + 결론 추적. company=고객사 필터. */
export async function getQuoteStatusList(scope: Scope, company?: string) {
  const uids = await scopeUserIds(scope);
  const { userName, userCenterName } = await centerNameMap();
  const quotes = await prisma.quote.findMany({
    where: { userId: { in: uids }, ...(company ? { customerCompany: company } : {}) },
    orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true, sentAt: true, quoteNumber: true, contractNo: true, testStandard: true,
      projectName: true, customerCompany: true, customerName: true, customerPhone: true, customerEmail: true,
      submissionPurpose: true, substanceType: true, userId: true,
      totalBeforeDiscount: true, discountRate: true, grandTotal: true, contractAmount: true,
      status: true, trackingNote: true,
    },
  });
  return quotes.map((q) => ({
    ...q,
    owner: userName.get(q.userId ?? -1) ?? '—',
    center: userCenterName.get(q.userId ?? -1) ?? '—',
  }));
}
export type QuoteStatusRow = Awaited<ReturnType<typeof getQuoteStatusList>>[number];

/** 고객 관리(전사) — 등급/활성 필터 + 고객 테이블. */
export async function getCustomerList(scope: Scope, period: string) {
  const uids = await scopeUserIds(scope);
  const { userName, userCenterName } = await centerNameMap();
  const companies = await prisma.company.findMany({
    where: { ownerId: { in: uids } },
    select: { id: true, name: true, industry: true, ownerId: true, contacts: { select: { id: true } } },
  });
  // 고객사명별 견적 집계(누적수주·진행견적)
  const quotes = await prisma.quote.findMany({
    where: { userId: { in: uids } },
    select: { customerCompany: true, status: true, grandTotal: true },
  });
  const wonByCo = new Map<string, number>();
  const pipeByCo = new Map<string, number>();
  for (const q of quotes) {
    const key = q.customerCompany ?? '';
    if (q.status === WON_STATUS) wonByCo.set(key, (wonByCo.get(key) ?? 0) + (q.grandTotal ?? 0));
    else if (PIPELINE_STATUS.includes(q.status)) pipeByCo.set(key, (pipeByCo.get(key) ?? 0) + 1);
  }
  // 최근 활동(노트/일정) — contactId → 고객사
  const contactCo = new Map<number, number>(); // contactId → companyId
  for (const c of companies) for (const ct of c.contacts) contactCo.set(ct.id, c.id);
  const [notes, events] = await Promise.all([
    prisma.note.findMany({ where: { ownerId: { in: uids }, contactId: { not: null } }, select: { contactId: true, occurredAt: true } }),
    prisma.calendarEvent.findMany({ where: { ownerId: { in: uids }, contactId: { not: null } }, select: { contactId: true, startAt: true } }),
  ]);
  const lastAct = new Map<number, Date>(); // companyId → latest date
  const touch = (cid: number | null, d: Date) => { if (cid == null) return; const co = contactCo.get(cid); if (co == null) return; const prev = lastAct.get(co); if (!prev || d > prev) lastAct.set(co, d); };
  for (const n of notes) touch(n.contactId, n.occurredAt);
  for (const e of events) touch(e.contactId, e.startAt);

  const rows = companies.map((c) => {
    const wonTotal = wonByCo.get(c.name) ?? 0;
    const last = lastAct.get(c.id) ?? null;
    return {
      name: c.name,
      industry: c.industry ?? '—',
      owner: userName.get(c.ownerId) ?? '—',
      center: userCenterName.get(c.ownerId) ?? '—',
      activeQuotes: pipeByCo.get(c.name) ?? 0,
      wonTotal,
      lastActivity: last,
      vip: wonTotal >= 300_000_000,             // 등급 필드 부재 → 누적수주 ≥3억 휴리스틱
    };
  }).sort((a, b) => b.wonTotal - a.wonTotal);
  return { total: companies.length, rows };
}

/** 실적 분석 — 기간 비교(분기/YoY) + 센터별 비교. */
export async function getPerformance(scope: Scope) {
  const uids = await scopeUserIds(scope);
  const centers = await prisma.center.findMany({ select: { id: true, name: true } });
  const centerUsers = new Map<number, number[]>();
  const usersAll = await prisma.user.findMany({ select: { id: true, centerId: true } });
  for (const u of usersAll) if (u.centerId != null) { const a = centerUsers.get(u.centerId) ?? []; a.push(u.id); centerUsers.set(u.centerId, a); }

  const wonInRange = async (ids: number[], gte: Date, lt: Date) => {
    const r = await prisma.quote.aggregate({ _sum: { grandTotal: true }, where: { status: WON_STATUS, userId: { in: ids }, createdAt: { gte, lt } } });
    return r._sum.grandTotal ?? 0;
  };
  const winRateInRange = async (ids: number[], gte: Date, lt: Date) => {
    const [a, r] = await Promise.all([
      prisma.quote.count({ where: { status: WON_STATUS, userId: { in: ids }, createdAt: { gte, lt } } }),
      prisma.quote.count({ where: { status: LOST_STATUS, userId: { in: ids }, createdAt: { gte, lt } } }),
    ]);
    return a + r > 0 ? a / (a + r) : 0;
  };
  // 분기: 이번=2026 Q2, 전분기=2026 Q1, 전년동기=2025 Q2 (데모 데이터 기준)
  const Q2_26: [Date, Date] = [new Date(2026, 3, 1), new Date(2026, 6, 1)];
  const Q1_26: [Date, Date] = [new Date(2026, 0, 1), new Date(2026, 3, 1)];
  const Q2_25: [Date, Date] = [new Date(2025, 3, 1), new Date(2025, 6, 1)];
  const H1_26: [Date, Date] = [new Date(2026, 0, 1), new Date(2026, 6, 1)];

  const [thisQ, prevQ, yoyQ] = await Promise.all([
    wonInRange(uids, ...Q2_26), wonInRange(uids, ...Q1_26), wonInRange(uids, ...Q2_25),
  ]);

  const centerRows = await Promise.all(centers.map(async (c) => {
    const ids = centerUsers.get(c.id) ?? [];
    const [won, wr, q1, q2, target] = await Promise.all([
      wonInRange(ids, ...H1_26),
      winRateInRange(ids, ...H1_26),
      wonInRange(ids, ...Q1_26),
      wonInRange(ids, ...Q2_26),
      prisma.target.findFirst({ where: { centerId: c.id, period: '2026H1' } }),
    ]);
    const goal = target?.amount ?? null;
    return { name: c.name, target: goal, won, rate: goal ? won / goal : null, winRate: wr, qoq: q1 > 0 ? (q2 - q1) / q1 : null };
  }));
  const totWon = centerRows.reduce((a, r) => a + r.won, 0);
  const totTarget = centerRows.reduce((a, r) => a + (r.target ?? 0), 0);
  const totWr = await winRateInRange(uids, ...H1_26);
  const totQ1 = centerRows.length ? await wonInRange(uids, ...Q1_26) : 0;
  const total = { won: totWon, target: totTarget || null, rate: totTarget ? totWon / totTarget : null, winRate: totWr, qoq: totQ1 > 0 ? (thisQ - totQ1) / totQ1 : null };

  return {
    thisQ, prevQ, yoyQ,
    qoqDelta: prevQ > 0 ? (thisQ - prevQ) / prevQ : null,
    yoyDelta: yoyQ > 0 ? (thisQ - yoyQ) / yoyQ : null,
    centerRows, total,
  };
}

/** 구성원 관리 — 계정·직책·권한·개인 실적. */
export async function getMemberList(scope: Scope, period: string) {
  const uids = await scopeUserIds(scope);
  const { userCenterName } = await centerNameMap();
  const users = await prisma.user.findMany({
    where: { id: { in: uids } },
    select: { id: true, name: true, email: true, role: true, centerId: true },
  });
  const quotes = await prisma.quote.findMany({
    where: { userId: { in: uids }, createdAt: periodRange(period) },
    select: { userId: true, status: true, grandTotal: true },
  });
  const agg = new Map<number, { won: number; acc: number; rej: number; count: number }>();
  for (const q of quotes) {
    const cur = agg.get(q.userId!) ?? { won: 0, acc: 0, rej: 0, count: 0 };
    cur.count++;
    if (q.status === WON_STATUS) { cur.won += q.grandTotal ?? 0; cur.acc++; }
    if (q.status === LOST_STATUS) cur.rej++;
    agg.set(q.userId!, cur);
  }
  return users.map((u) => {
    const a = agg.get(u.id) ?? { won: 0, acc: 0, rej: 0, count: 0 };
    return {
      id: u.id, name: u.name ?? '—', email: u.email, role: u.role,
      center: userCenterName.get(u.id) ?? '—',
      count: a.count, won: a.won, winRate: a.acc + a.rej > 0 ? a.acc / (a.acc + a.rej) : 0,
    };
  }).sort((a, b) => b.won - a.won);
}

/** 목표 목록(설정 화면 — 센터별 + 전사, 특정 기간). */
export async function listTargets(period: string) {
  const [centers, targets] = await Promise.all([
    prisma.center.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.target.findMany({ where: { period } }),
  ]);
  const byCenter = new Map(targets.map((t) => [t.centerId, t.amount] as const));
  return {
    period,
    rows: [
      ...centers.map((c) => ({ centerId: c.id, name: c.name, amount: byCenter.get(c.id) ?? null })),
      { centerId: null as number | null, name: '전사', amount: byCenter.get(null) ?? null },
    ],
  };
}

/**
 * 월별 견적 퍼널 (Sheet1) — 월별 견적/계약/진행중/타기관(반려) 건수 + 금액.
 * 견적 결론(상태)에서 파생: ACCEPTED=계약, REJECTED=타기관, 그 외=진행중.
 */
export async function getMonthlyFunnel(scope: Scope, year: number) {
  const uids = await scopeUserIds(scope);
  const quotes = await prisma.quote.findMany({
    where: { userId: { in: uids }, createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
    select: { status: true, grandTotal: true, createdAt: true },
  });
  const rows = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, quoted: 0, won: 0, inProgress: 0, lost: 0, wonAmount: 0 }));
  for (const q of quotes) {
    const r = rows[q.createdAt.getMonth()];
    r.quoted++;
    if (q.status === WON_STATUS) { r.won++; r.wonAmount += q.grandTotal ?? 0; }
    else if (q.status === LOST_STATUS) r.lost++;
    else r.inProgress++;
  }
  // 데이터 있는 달만
  return rows.filter((r) => r.quoted > 0);
}

/** 시험 일정(전사) — 진행 프로젝트 + 미니 간트(H1). */
export async function getSchedule(scope: Scope) {
  const uids = await scopeUserIds(scope);
  const { userName, userCenterName } = await centerNameMap();
  const deals = await prisma.deal.findMany({
    where: { ownerId: { in: uids } },
    select: { title: true, ownerId: true, stage: true, status: true, createdAt: true, contact: { select: { company: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  // stage/status → 상태 라벨·색
  const statusOf = (stage: string, status: string): { label: string; tone: 'green' | 'orange' | 'gray' } => {
    if (status === 'WON' || ['STUDY', 'INVOICE'].includes(stage)) return { label: '진행 중', tone: 'green' };
    if (stage === 'CONTRACT') return { label: '진행 중', tone: 'green' };
    if (stage === 'QUOTE') return { label: '분석 중', tone: 'orange' };
    if (stage === 'DONE') return { label: '완료', tone: 'gray' };
    return { label: '착수 예정', tone: 'gray' };
  };
  const H1start = new Date(2026, 0, 1).getTime();
  const H1span = new Date(2026, 6, 1).getTime() - H1start;
  const frac = (ms: number, titleLen: number) => {
    const startFrac = Math.min(Math.max((Math.max(ms, H1start) - H1start) / H1span, 0), 0.85);
    return { startFrac, widthFrac: Math.min(0.15 + (titleLen % 3) * 0.1, 1 - startFrac) };
  };
  const rows = deals.map((d) => {
    const s = statusOf(d.stage, d.status);
    return {
      project: d.title, company: d.contact?.company?.name ?? '—',
      owner: userName.get(d.ownerId) ?? '—', center: userCenterName.get(d.ownerId) ?? '—',
      status: s.label, tone: s.tone as 'green' | 'orange' | 'gray', ...frac(d.createdAt.getTime(), d.title.length),
    };
  });
  // 계약 체결(ACCEPTED) 견적 = 실제 진행 시험(Deal 없는 임포트 견적 포함)
  const wonQuotes = await prisma.quote.findMany({
    where: { userId: { in: uids }, status: WON_STATUS },
    select: { projectName: true, customerCompany: true, userId: true, sentAt: true, createdAt: true },
    orderBy: { sentAt: 'desc' },
  });
  for (const q of wonQuotes) {
    const t = (q.sentAt ?? q.createdAt).getTime();
    rows.push({
      project: q.projectName, company: q.customerCompany ?? '—',
      owner: userName.get(q.userId ?? -1) ?? '—', center: userCenterName.get(q.userId ?? -1) ?? '—',
      status: '진행 중', tone: 'green', ...frac(t, q.projectName.length),
    });
  }
  const activeCount = rows.filter((r) => r.status !== '완료').length;
  return { count: activeCount, rows };
}
