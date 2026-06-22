/**
 * POST /api/crm/change-quotes  — 시험 진행 중 감가/추가금 변경견적 추가
 * body: { dealId, kind: 'DEDUCT'|'ADD', amount, reason, studyId? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const owners = await visibleOwnerIds();
  const body = await req.json().catch(() => null) as { dealId?: number; kind?: string; amount?: number; reason?: string; studyId?: number } | null;
  const dealId = Number(body?.dealId);
  const amount = Number(body?.amount);
  const reason = String(body?.reason ?? '').trim();
  const kind = body?.kind === 'DEDUCT' ? 'DEDUCT' : 'ADD';
  if (!dealId || !reason || !Number.isFinite(amount)) return NextResponse.json({ error: 'dealId·금액·사유가 필요합니다.' }, { status: 400 });

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || !owners.includes(deal.ownerId)) return NextResponse.json({ error: '안건을 찾을 수 없습니다.' }, { status: 404 });

  const change = await prisma.changeQuote.create({
    data: { dealId, kind, amount: Math.abs(amount), reason, studyId: body?.studyId ? Number(body.studyId) : null },
  });
  return NextResponse.json({ change });
}
