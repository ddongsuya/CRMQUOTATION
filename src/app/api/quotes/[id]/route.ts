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
  const { nextQuoteNumber } = await import('@/lib/quote-number');
  const quoteNumber = await nextQuoteNumber();
  const { id: _, items, createdAt: _c, updatedAt: _u, quoteNumber: _q, issuedAt: _i, validUntil: _v, status: _s, ...rest } = src;
  const dup = await prisma.quote.create({
    data: {
      ...rest,
      quoteNumber,
      status: 'DRAFT',
      issuedAt: null,
      validUntil: null,
      projectName: src.projectName + ' (복제)',
      items: {
        create: items.map(({ id: _ii, quoteId: _qi, ...item }) => item),
      },
    },
    include: { items: true },
  });
  return NextResponse.json({ quote: dup });
}
