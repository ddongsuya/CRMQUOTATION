/**
 * POST /api/crm/quotes/[id]/to-contract — 견적을 계약으로 전환.
 *   딜 없는 견적(임포트) → Deal(안건) + Contract 생성 + 견적 계약체결 처리.
 *   이후 시험·노트·일정 탭이 그 딜에 붙어 사용 가능해진다.
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentUserId } from '@/lib/current-user';
import { classifyRole, defaultDurations, schedule, type GanttTask } from '@/lib/gantt-schedule';
import { getItem } from '@/lib/quote-engine/master';

type Tx = Prisma.TransactionClient;

// 기본 지급조건 — 선금 50%(계약 체결 시) + 잔금 50%(최종보고서안 발행 + 30일). "계약 시작" 경로와 동일 규칙.
const DEFAULT_TERMS = {
  create: [
    { seq: 1, kind: 'ADVANCE', ratio: 0.5, condition: '계약 체결 시' },
    { seq: 2, kind: 'BALANCE', ratio: 0.5, condition: '최종보고서(안) 발행 + 30일' },
  ],
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ownerId = await currentUserId();
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });

  const q = await prisma.quote.findUnique({
    where: { id },
    select: {
      id: true, dealId: true, companyId: true, customerCompany: true, customerName: true, customerEmail: true, customerPhone: true,
      projectName: true, modality: true, submissionPurpose: true,
      quoteNumber: true, studyType: true, planJson: true, issuedAt: true, sentAt: true, createdAt: true,
      items: { select: { testItemKey: true, testNameSnapshot: true }, orderBy: { displayOrder: 'asc' } },
    },
  });
  if (!q) return NextResponse.json({ error: '견적 없음' }, { status: 404 });
  if (q.dealId) {
    // 이미 딜 연결 → 계약·시험만 보장(멱등). 원자적으로.
    const dealId = q.dealId;
    const out = await prisma.$transaction(async (tx) => {
      const hasStudy = await tx.study.findFirst({ where: { dealId }, select: { id: true } });
      const studyId = hasStudy ? hasStudy.id : await createStudiesFromQuote(tx, dealId, q);
      // 견적·안건 상태도 계약 체결로 동기화 (신규 전환 경로와 동일한 의미론 — 수주 KPI 근거)
      await tx.quote.update({ where: { id: q.id }, data: { status: 'ACCEPTED', trackingNote: '계약 체결' } });
      const deal = await tx.deal.findUnique({ where: { id: dealId }, select: { stage: true } });
      if (deal && ['INQUIRY', 'QUOTE', 'INTAKE'].includes(deal.stage)) {
        await tx.deal.update({ where: { id: dealId }, data: { stage: 'CONTRACT', status: 'WON' } });
      } else {
        await tx.deal.update({ where: { id: dealId }, data: { status: 'WON' } });
      }
      const existing = await tx.contract.findUnique({ where: { dealId }, select: { id: true } });
      if (existing) return { dealId, contractId: existing.id, studyId, already: true };
      const c = await tx.contract.create({ data: { dealId, quoteId: q.id, status: 'DRAFT', paymentTerms: DEFAULT_TERMS }, select: { id: true } });
      return { dealId, contractId: c.id, studyId, already: false };
    }, { timeout: 30_000 });   // 시험 다건 생성 + Neon 지연 대비 (기본 5초로는 P2028)
    return NextResponse.json({ ok: true, ...out });
  }

  if (!q.companyId && !q.customerCompany) {
    return NextResponse.json({ error: '고객사 정보 없음 — 견적에 의뢰기관이 필요합니다.' }, { status: 400 });
  }

  // 회사·연락처 확보 → 딜·계약·견적체결·시험을 하나의 트랜잭션으로 (중간 실패 시 전부 롤백).
  const out = await prisma.$transaction(async (tx) => {
    let companyId = q.companyId;
    if (!companyId && q.customerCompany) {
      const co = (await tx.company.findFirst({ where: { name: q.customerCompany }, select: { id: true } }))
        ?? (await tx.company.create({ data: { name: q.customerCompany, ownerId }, select: { id: true } }));
      companyId = co.id;
    }
    let contact = await tx.contact.findFirst({ where: { companyId: companyId! }, select: { id: true } });
    if (!contact) {
      contact = await tx.contact.create({
        data: { companyId: companyId!, name: q.customerName || '담당자', email: q.customerEmail || undefined, phone: q.customerPhone || undefined },
        select: { id: true },
      });
    }
    const deal = await tx.deal.create({
      data: {
        ownerId, contactId: contact.id, title: q.projectName,
        modality: q.modality, submissionTarget: q.submissionPurpose ?? undefined,
        stage: 'CONTRACT', status: 'WON',
      },
      select: { id: true },
    });
    await tx.quote.update({ where: { id: q.id }, data: { dealId: deal.id, status: 'ACCEPTED', trackingNote: '계약 체결' } });
    const contract = await tx.contract.create({ data: { dealId: deal.id, quoteId: q.id, status: 'DRAFT', paymentTerms: DEFAULT_TERMS }, select: { id: true } });
    const studyId = await createStudiesFromQuote(tx, deal.id, q);
    return { dealId: deal.id, contractId: contract.id, studyId };
  }, { timeout: 30_000 });   // 시험 다건 생성 + Neon 지연 대비

  return NextResponse.json({ ok: true, ...out });
}

type QuoteForStudy = {
  studyType: string; planJson: string | null; projectName: string; quoteNumber: string;
  issuedAt: Date | null; sentAt: Date | null; createdAt: Date;
  items: { testItemKey: string; testNameSnapshot: string }[];
};

const WEEK_MS = 7 * 86400_000;

/**
 * 계약 전환 시 견적 → Study 등록 (효력·독성 공용). 생성한 첫 Study id 반환(없으면 null).
 *
 *  · 효력: planJson.totalWeeks 로 Study 1건 (설계된 전체 시험기간).
 *  · 독성: 견적 라인마다 Study 1건 — gantt-schedule 임계경로 스케줄러(회사 실무 규칙:
 *    조제물 4주 anchor → 단회 → DRF → TK검증 → 반복, 유전독성·안전성약리 병렬)로
 *    시작·종료 주차를 배치해 시험 일정에 실제 기간의 막대가 그려지게 한다.
 *    항목별 투여주차는 v2 마스터(studyWeeks)에서 조회, 견적기간으로 역산해 전달.
 */
async function createStudiesFromQuote(tx: Tx, dealId: number, q: QuoteForStudy): Promise<number | null> {
  const base = q.sentAt ?? q.issuedAt ?? q.createdAt;

  if (q.studyType === 'efficacy') {
    let weeks = 0;
    try { weeks = Number((JSON.parse(q.planJson ?? '{}') as { totalWeeks?: number }).totalWeeks) || 0; } catch { return null; }
    if (weeks <= 0) return null;
    const study = await tx.study.create({
      data: {
        dealId, itemName: q.projectName, studyNumber: q.quoteNumber,
        requestSentAt: base, studyEndAt: new Date(base.getTime() + weeks * WEEK_MS), reportDraftDueAt: new Date(base.getTime() + weeks * WEEK_MS),
      },
      select: { id: true },
    });
    return study.id;
  }

  // ── 독성: 라인 → GanttTask. '_'로 시작하는 키는 분석 라인(함량·조제물) — 실험 시험이 아니므로
  //    개별 Study 대신 하나의 조제물분석(PREP, 임계경로 anchor)으로 합친다.
  //    실무 시험 구성 규칙:
  //     · 반복투여 + 회복 = 하나의 시험 (회복 주수만큼 동물기간 연장)
  //     · TK(독성동태) = 생체시료분석 Validation 시험 + 본시험 두 건으로 분리
  //       (Validation 이 끝나야 DRF·반복의 동물 입고 가능 — 스케줄러 gate)
  const testLines = q.items.filter((it) => !it.testItemKey.startsWith('_'));
  const hasAnalysis = q.items.length > testLines.length;
  if (!testLines.length && !hasAnalysis) return null;

  const tasks: GanttTask[] = [];
  if (hasAnalysis) {
    tasks.push({ id: '_prep', name: '조제물·함량분석', role: 'PREP', ...defaultDurations('PREP', null) });
  }
  const speciesOf = (name: string) => /비설치류|개\b|비글|원숭이|영장류/.test(name) ? '비설치류' : '설치류';
  const recoveryLines: { name: string; weeks: number; species: string }[] = [];
  const repeatTasks: (GanttTask & { species: string })[] = [];
  let tkSeen = false;

  for (const it of testLines) {
    const role = classifyRole(it.testNameSnapshot);
    // 마스터 studyWeeks = 투여 주차 → 견적기간으로 역산(투여 + 순화1 + 보고서4/8 + TK검증4).
    // defaultDurations 가 다시 빼서 animalWeeks(막대 본체) = 투여주차가 된다. 0/미상이면 역할별 기본값.
    const dosing = getItem(it.testItemKey)?.studyWeeks ?? null;
    const report = role === 'REPEAT' ? 8 : 4;
    const quoteWeeks = dosing != null && dosing > 0
      ? dosing + 1 + report + (role === 'TK' ? 4 : 0)
      : null;

    // 회복 라인은 별도 시험이 아님 — 같은 종의 반복투여 시험에 병합
    if (role === 'REPEAT' && /회복/.test(it.testNameSnapshot)) {
      const m = /(\d+)\s*주\s*회복/.exec(it.testNameSnapshot);
      recoveryLines.push({ name: it.testNameSnapshot, weeks: m ? Number(m[1]) : 4, species: speciesOf(it.testNameSnapshot) });
      continue;
    }
    // TK: Validation(1건만) + 본시험으로 분리
    if (role === 'TK') {
      if (!tkSeen) {
        tkSeen = true;
        tasks.push({ id: `${it.testItemKey}__val`, name: '독성동태 생체시료분석 Validation', role: 'VALIDATION', ...defaultDurations('VALIDATION', null) });
      }
      tasks.push({ id: it.testItemKey, name: `${it.testNameSnapshot} — 본시험`, role: 'TK', ...defaultDurations('TK', quoteWeeks) });
      continue;
    }
    const task = { id: it.testItemKey, name: it.testNameSnapshot, role, ...defaultDurations(role, quoteWeeks) };
    tasks.push(task);
    if (role === 'REPEAT') repeatTasks.push({ ...task, species: speciesOf(it.testNameSnapshot) });
  }

  // 회복 병합 — 같은 종의 반복투여 task 를 찾아 이름·기간 확장 (없으면 첫 반복 task)
  for (const rec of recoveryLines) {
    const target = repeatTasks.find(r => r.species === rec.species) ?? repeatTasks[0];
    if (!target) { tasks.push({ id: `_rec-${rec.name}`, name: rec.name, role: 'REPEAT', animalWeeks: rec.weeks, reportWeeks: 8 }); continue; }
    const t = tasks.find(x => x.id === target.id)!;
    t.animalWeeks += rec.weeks;
    t.name = `${t.name} (+${rec.weeks}주 회복)`;
  }

  const bars = schedule(tasks);
  if (!bars.length) return null;
  await tx.study.createMany({
    data: bars.map((bar, i) => ({
      dealId,
      itemName: bar.name,
      studyNumber: `${q.quoteNumber}-${String(i + 1).padStart(2, '0')}`,
      requestSentAt: new Date(base.getTime() + bar.startWeek * WEEK_MS),
      studyEndAt: new Date(base.getTime() + bar.endWeek * WEEK_MS),
      reportDraftDueAt: new Date(base.getTime() + (bar.endWeek + bar.reportWeeks) * WEEK_MS),
    })),
  });
  const first = await tx.study.findFirst({ where: { dealId }, orderBy: { id: 'asc' }, select: { id: true } });
  return first?.id ?? null;
}
