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
      const existing = await tx.contract.findUnique({ where: { dealId }, select: { id: true } });
      if (existing) return { dealId, contractId: existing.id, studyId, already: true };
      const c = await tx.contract.create({ data: { dealId, quoteId: q.id, status: 'DRAFT' }, select: { id: true } });
      return { dealId, contractId: c.id, studyId, already: false };
    });
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
    const contract = await tx.contract.create({ data: { dealId: deal.id, quoteId: q.id, status: 'DRAFT' }, select: { id: true } });
    const studyId = await createStudiesFromQuote(tx, deal.id, q);
    return { dealId: deal.id, contractId: contract.id, studyId };
  });

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
        requestSentAt: base, reportDraftDueAt: new Date(base.getTime() + weeks * WEEK_MS),
      },
      select: { id: true },
    });
    return study.id;
  }

  // ── 독성: 라인 → GanttTask. '_'로 시작하는 키는 분석 라인(함량·조제물) — 실험 시험이 아니므로
  //    개별 Study 대신 하나의 조제물분석(PREP, 임계경로 anchor)으로 합친다.
  const testLines = q.items.filter((it) => !it.testItemKey.startsWith('_'));
  const hasAnalysis = q.items.length > testLines.length;
  if (!testLines.length && !hasAnalysis) return null;

  const tasks: GanttTask[] = [];
  if (hasAnalysis) {
    tasks.push({ id: '_prep', name: '조제물·함량분석', role: 'PREP', ...defaultDurations('PREP', null) });
  }
  for (const it of testLines) {
    const role = classifyRole(it.testNameSnapshot);
    // 마스터 studyWeeks = 투여 주차 → 견적기간으로 역산(투여 + 순화1 + 보고서4/8 + TK검증4).
    // defaultDurations 가 다시 빼서 animalWeeks(막대 본체) = 투여주차가 된다. 0/미상이면 역할별 기본값.
    const dosing = getItem(it.testItemKey)?.studyWeeks ?? null;
    const report = role === 'REPEAT' ? 8 : 4;
    const quoteWeeks = dosing != null && dosing > 0
      ? dosing + 1 + report + (role === 'TK' ? 4 : 0)
      : null;
    tasks.push({ id: it.testItemKey, name: it.testNameSnapshot, role, ...defaultDurations(role, quoteWeeks) });
  }

  const bars = schedule(tasks);
  let firstId: number | null = null;
  let seq = 0;
  for (const bar of bars) {
    seq += 1;
    const study = await tx.study.create({
      data: {
        dealId,
        itemName: bar.name,
        studyNumber: `${q.quoteNumber}-${String(seq).padStart(2, '0')}`,
        requestSentAt: new Date(base.getTime() + bar.startWeek * WEEK_MS),
        reportDraftDueAt: new Date(base.getTime() + (bar.endWeek + bar.reportWeeks) * WEEK_MS),
      },
      select: { id: true },
    });
    if (firstId == null) firstId = study.id;
  }
  return firstId;
}
