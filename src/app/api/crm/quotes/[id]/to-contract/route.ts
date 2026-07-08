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
    select: { id: true, dealId: true, companyId: true, customerCompany: true, customerName: true, customerEmail: true, customerPhone: true, projectName: true, modality: true, submissionPurpose: true },
  });
  if (!q) return NextResponse.json({ error: '견적 없음' }, { status: 404 });
  if (q.dealId) {
    // 이미 딜 연결 → 계약만 보장
    const existing = await prisma.contract.findUnique({ where: { dealId: q.dealId }, select: { id: true } }).catch(() => null);
    if (existing) return NextResponse.json({ ok: true, dealId: q.dealId, contractId: existing.id, already: true });
    const c = await prisma.contract.create({ data: { dealId: q.dealId, quoteId: q.id, status: 'DRAFT' }, select: { id: true } });
    return NextResponse.json({ ok: true, dealId: q.dealId, contractId: c.id });
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

  return NextResponse.json({ ok: true, dealId: deal.id, contractId: contract.id });
}
