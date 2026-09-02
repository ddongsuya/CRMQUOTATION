/**
 * GET    /api/crm/deals/[id]  — 안건 전체 상세 (고객·견적·계약·시험·변경견적)
 * PATCH  /api/crm/deals/[id]  — 안건 수정 (단계·상태·메모 등)
 * DELETE /api/crm/deals/[id]  — 안건 삭제
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function ownedDeal(id: number) {
  const owners = await visibleOwnerIds();
  const d = await prisma.deal.findUnique({ where: { id } });
  if (!d || !owners.includes(d.ownerId)) return null;
  return d;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedDeal(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['title', 'modality', 'indication', 'clinicalDesign', 'submissionTarget', 'lostReason'] as const) {
    if (k in body) data[k] = String(body[k] ?? '').trim() || (k === 'title' ? undefined : null);
  }
  if ('reportLanguage' in body) data.reportLanguage = body.reportLanguage === 'EN' ? 'EN' : 'KO';
  if ('translationRequested' in body) data.translationRequested = !!body.translationRequested;
  if ('stage' in body) data.stage = String(body.stage);
  if ('status' in body) data.status = String(body.status);
  if (data.title === undefined && 'title' in body) return NextResponse.json({ error: '안건명은 비울 수 없습니다.' }, { status: 400 });
  const deal = await prisma.deal.update({ where: { id }, data });
  // 수주 처리 시 대표 견적(미거절 중 최대 금액)을 ACCEPTED 로 동기화 — 고객 KPI 누적 수주의 근거.
  if (data.status === 'WON') {
    const quotes = await prisma.quote.findMany({ where: { dealId: id }, select: { id: true, status: true, grandTotal: true } });
    if (quotes.length && !quotes.some(q => q.status === 'ACCEPTED')) {
      const top = quotes.filter(q => q.status !== 'REJECTED').sort((a, b) => (b.grandTotal ?? 0) - (a.grandTotal ?? 0))[0];
      if (top) await prisma.quote.update({ where: { id: top.id }, data: { status: 'ACCEPTED', trackingNote: '수주 처리' } });
    }
  }
  return NextResponse.json({ deal });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedDeal(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
