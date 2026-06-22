/** DELETE /api/crm/change-quotes/[id] */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const owners = await visibleOwnerIds();
  const c = await prisma.changeQuote.findUnique({ where: { id }, include: { deal: true } });
  if (!c || !owners.includes(c.deal.ownerId)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.changeQuote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
