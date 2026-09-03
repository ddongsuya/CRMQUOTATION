/**
 * POST /api/crm/change-quotes  — 시험 진행 중 감가/추가금 변경견적 추가
 * body: { dealId, kind: 'DEDUCT'|'ADD', amount, reason, studyId? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { changeQuoteCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _POST(req: Request) {
  const owners = await visibleOwnerIds();
  const parsed = await parseBody(req, changeQuoteCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  const deal = await prisma.deal.findUnique({ where: { id: b.dealId } });
  if (!deal || !owners.includes(deal.ownerId)) return NextResponse.json({ error: '안건을 찾을 수 없습니다.' }, { status: 404 });

  const change = await prisma.changeQuote.create({
    data: { dealId: b.dealId, kind: b.kind, amount: Math.abs(b.amount), reason: b.reason, studyId: b.studyId },
  });
  return NextResponse.json({ change });
}

export const POST = withErrorHandling(_POST);
