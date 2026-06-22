/**
 * POST /api/crm/studies  — 안건에 시험(시험번호) 추가
 * body: { dealId, itemName?, studyNumber?, director? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const owners = await visibleOwnerIds();
  const body = await req.json().catch(() => null) as { dealId?: number; itemName?: string; studyNumber?: string; director?: string } | null;
  const dealId = Number(body?.dealId);
  if (!dealId) return NextResponse.json({ error: 'dealId 가 필요합니다.' }, { status: 400 });
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || !owners.includes(deal.ownerId)) return NextResponse.json({ error: '안건을 찾을 수 없습니다.' }, { status: 404 });

  const study = await prisma.study.create({
    data: {
      dealId,
      itemName: body?.itemName?.trim() || null,
      studyNumber: body?.studyNumber?.trim() || null,
      director: body?.director?.trim() || null,
    },
  });
  if (['INQUIRY', 'QUOTE'].includes(deal.stage)) {
    await prisma.deal.update({ where: { id: dealId }, data: { stage: 'STUDY' } });
  }
  return NextResponse.json({ study });
}
