/**
 * POST /api/crm/quotes/[id]/to-contract — 견적을 계약으로 전환.
 *   딜 없는 견적(임포트) → Deal(안건) + Contract 생성 + 견적 계약체결 처리.
 *   이후 시험·노트·일정 탭이 그 딜에 붙어 사용 가능해진다.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId } from '@/lib/current-user';

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
    // 이미 딜 연결 → 계약·시험만 보장(멱등)
    const hasStudy = await prisma.study.findFirst({ where: { dealId: q.dealId }, select: { id: true } });
    const studyId = hasStudy ? hasStudy.id : await createEfficacyStudy(q.dealId, q);
    const existing = await prisma.contract.findUnique({ where: { dealId: q.dealId }, select: { id: true } }).catch(() => null);
    if (existing) return NextResponse.json({ ok: true, dealId: q.dealId, contractId: existing.id, studyId, already: true });
    const c = await prisma.contract.create({ data: { dealId: q.dealId, quoteId: q.id, status: 'DRAFT' }, select: { id: true } });
    return NextResponse.json({ ok: true, dealId: q.dealId, contractId: c.id, studyId });
  }

  // 회사 확보(companyId 우선, 없으면 이름으로 조회/생성)
  let companyId = q.companyId;
  if (!companyId && q.customerCompany) {
    const co = (await prisma.company.findFirst({ where: { name: q.customerCompany }, select: { id: true } }))
      ?? (await prisma.company.create({ data: { name: q.customerCompany, ownerId }, select: { id: true } }));
    companyId = co.id;
  }
  if (!companyId) return NextResponse.json({ error: '고객사 정보 없음 — 견적에 의뢰기관이 필요합니다.' }, { status: 400 });

  // 연락처 확보(회사 첫 연락처, 없으면 견적 의뢰자로 생성)
  let contact = await prisma.contact.findFirst({ where: { companyId }, select: { id: true } });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { companyId, name: q.customerName || '담당자', email: q.customerEmail || undefined, phone: q.customerPhone || undefined },
      select: { id: true },
    });
  }

  // 딜 + 계약 생성 + 견적 계약체결
  const deal = await prisma.deal.create({
    data: {
      ownerId, contactId: contact.id, title: q.projectName,
      modality: q.modality, submissionTarget: q.submissionPurpose ?? undefined,
      stage: 'CONTRACT', status: 'WON',
    },
    select: { id: true },
  });
  await prisma.quote.update({ where: { id: q.id }, data: { dealId: deal.id, status: 'ACCEPTED', trackingNote: '계약 체결' } });
  const contract = await prisma.contract.create({ data: { dealId: deal.id, quoteId: q.id, status: 'DRAFT' }, select: { id: true } });

  // 효력 견적은 시험 설계(기간)를 이미 갖고 있다 → 계약 전환 시 Study를 등록해
  // 시험 일정(간트)에 실제 기간의 막대가 바로 그려지게 한다.
  const studyId = await createEfficacyStudy(deal.id, q);

  return NextResponse.json({ ok: true, dealId: deal.id, contractId: contract.id, studyId });
}

type QuoteForStudy = {
  studyType: string; planJson: string | null; projectName: string; quoteNumber: string;
  issuedAt: Date | null; sentAt: Date | null; createdAt: Date;
};

/** planJson.totalWeeks 기준으로 Study 1건 생성. 효력 견적이 아니거나 기간을 모르면 건너뜀. */
async function createEfficacyStudy(dealId: number, q: QuoteForStudy): Promise<number | null> {
  if (q.studyType !== 'efficacy') return null;
  let weeks = 0;
  try { weeks = Number((JSON.parse(q.planJson ?? '{}') as { totalWeeks?: number }).totalWeeks) || 0; } catch { return null; }
  if (weeks <= 0) return null;

  const start = q.sentAt ?? q.issuedAt ?? q.createdAt;
  const study = await prisma.study.create({
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
