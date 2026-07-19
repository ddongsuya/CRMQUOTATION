/**
 * POST /api/crm/quotes/[id]/to-contract — 견적을 계약으로 전환.
 *   딜 없는 견적(임포트) → Deal(안건) + Contract 생성 + 견적 계약체결 처리.
 *   이후 시험·노트·일정 탭이 그 딜에 붙어 사용 가능해진다.
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentUserId } from '@/lib/current-user';

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
    },
  });
  if (!q) return NextResponse.json({ error: '견적 없음' }, { status: 404 });
  if (q.dealId) {
    // 이미 딜 연결 → 계약·시험만 보장(멱등). 원자적으로.
    const dealId = q.dealId;
    const out = await prisma.$transaction(async (tx) => {
      const hasStudy = await tx.study.findFirst({ where: { dealId }, select: { id: true } });
      const studyId = hasStudy ? hasStudy.id : await createEfficacyStudy(tx, dealId, q);
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
    const studyId = await createEfficacyStudy(tx, deal.id, q);
    return { dealId: deal.id, contractId: contract.id, studyId };
  });

  return NextResponse.json({ ok: true, ...out });
}

type QuoteForStudy = {
  studyType: string; planJson: string | null; projectName: string; quoteNumber: string;
  issuedAt: Date | null; sentAt: Date | null; createdAt: Date;
};

/** planJson.totalWeeks 기준으로 Study 1건 생성. 효력 견적이 아니거나 기간을 모르면 건너뜀. */
async function createEfficacyStudy(tx: Tx, dealId: number, q: QuoteForStudy): Promise<number | null> {
  if (q.studyType !== 'efficacy') return null;
  let weeks = 0;
  try { weeks = Number((JSON.parse(q.planJson ?? '{}') as { totalWeeks?: number }).totalWeeks) || 0; } catch { return null; }
  if (weeks <= 0) return null;

  const start = q.sentAt ?? q.issuedAt ?? q.createdAt;
  const study = await tx.study.create({
    data: {
      dealId,
      itemName: q.projectName,
      studyNumber: q.quoteNumber,
      requestSentAt: start,
      reportDraftDueAt: new Date(start.getTime() + weeks * 7 * 86400_000),
    },
    select: { id: true },
  });
  return study.id;
}
