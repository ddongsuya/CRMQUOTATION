import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Ctx { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { displayOrder: 'asc' } } },
  });
  if (!quote) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ quote });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/** Duplicate — create a fresh DRAFT copy with new quote number. */
export async function POST(_req: Request, { params }: Ctx) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const src = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
  if (!src) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { createQuoteWithNumber } = await import('@/lib/quote-number');
  // 이력·계약 필드는 복사하지 않는다 — 복제본은 새 DRAFT 이므로 원본의 계약번호·금액·송부·수주 이력을 물려받으면 안 됨.
  const {
    id: _, items, createdAt: _c, updatedAt: _u, quoteNumber: _q, issuedAt: _i, validUntil: _v, status: _s,
    dealId: _d, sentAt: _sa, reviewedAt: _r, accepted: _a, contractNo: _cn, contractAmount: _ca, trackingNote: _tn,
    revisedFromId: _rf, supersededAt: _sp,   // 변경견적 체인은 복제본에 승계하지 않는다
    ...rest
  } = src;
  const dup = await createQuoteWithNumber((quoteNumber) => prisma.quote.create({
    data: {
      ...rest,
      quoteNumber,
      status: 'DRAFT',
      dealId: null, issuedAt: null, validUntil: null, sentAt: null, reviewedAt: null, accepted: null,
      contractNo: null, contractAmount: null, trackingNote: null,
      projectName: src.projectName + ' (복제)',
      items: {
        create: items.map(({ id: _ii, quoteId: _qi, ...item }) => item),
      },
    },
    include: { items: true },
  }), src.userId);
  return NextResponse.json({ quote: dup });
}
