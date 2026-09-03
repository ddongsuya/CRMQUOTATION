/**
 * GET    /api/crm/deals/[id]  — 안건 전체 상세 (고객·견적·계약·시험·변경견적)
 * PATCH  /api/crm/deals/[id]  — 안건 수정 (단계·상태·메모 등)
 * DELETE /api/crm/deals/[id]  — 안건 삭제
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { dealPatchSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function ownedDeal(id: number) {
  const owners = await visibleOwnerIds();
  const d = await prisma.deal.findUnique({ where: { id } });
  if (!d || !owners.includes(d.ownerId)) return null;
  return d;
}

async function _GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedDeal(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      contact: { include: { company: true } },
      quotes: { orderBy: { createdAt: 'desc' }, select: { id: true, quoteNumber: true, grandTotal: true, totalAfterDiscount: true, currency: true, status: true, sentAt: true, accepted: true, createdAt: true } },
      contract: { include: { paymentTerms: { orderBy: { seq: 'asc' } } } },
      studies: { orderBy: { createdAt: 'asc' } },
      changeQuotes: { orderBy: { createdAt: 'desc' } },
      notes: { orderBy: { occurredAt: 'desc' } },
    },
  });
  return NextResponse.json({ deal });
}

async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedDeal(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = await parseBody(req, dealPatchSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;   // 키 없음 → undefined(Prisma 가 무시)
  const deal = await prisma.deal.update({ where: { id }, data: b });
  // 수주 처리 시 대표 견적(미거절 중 최대 금액)을 ACCEPTED 로 동기화 — 고객 KPI 누적 수주의 근거.
  if (b.status === 'WON') {
    const quotes = await prisma.quote.findMany({ where: { dealId: id }, select: { id: true, status: true, grandTotal: true } });
    if (quotes.length && !quotes.some(q => q.status === 'ACCEPTED')) {
      const top = quotes.filter(q => q.status !== 'REJECTED').sort((a, b) => (b.grandTotal ?? 0) - (a.grandTotal ?? 0))[0];
      if (top) await prisma.quote.update({ where: { id: top.id }, data: { status: 'ACCEPTED', trackingNote: '수주 처리' } });
    }
  }
  return NextResponse.json({ deal });
}

async function _DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedDeal(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
