/**
 * POST /api/crm/contracts  — 안건의 계약 생성/보장 (deal 1:1, 없으면 생성)
 * body: { dealId }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const owners = await visibleOwnerIds();
  const body = await req.json().catch(() => null) as { dealId?: number } | null;
  const dealId = Number(body?.dealId);
  if (!dealId) return NextResponse.json({ error: 'dealId 가 필요합니다.' }, { status: 400 });

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || !owners.includes(deal.ownerId)) return NextResponse.json({ error: '안건을 찾을 수 없습니다.' }, { status: 404 });

  // 기본 지급조건: 선금 50% (계약 체결 시) + 잔금 50% (최종보고서안 발행 + 30일)
  const contract = await prisma.contract.upsert({
    where: { dealId },
    update: {},
    create: {
      dealId,
      paymentTerms: {
        create: [
          { seq: 1, kind: 'ADVANCE', ratio: 0.5, condition: '계약 체결 시' },
          { seq: 2, kind: 'BALANCE', ratio: 0.5, condition: '최종보고서(안) 발행 + 30일' },
        ],
      },
    },
    include: { paymentTerms: { orderBy: { seq: 'asc' } } },
  });
  // 안건 단계도 계약으로 진전(되돌리진 않음)
  if (['INQUIRY', 'QUOTE', 'INTAKE'].includes(deal.stage)) {
    await prisma.deal.update({ where: { id: dealId }, data: { stage: 'CONTRACT' } });
  }
  return NextResponse.json({ contract });
}
