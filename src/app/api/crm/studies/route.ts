/**
 * POST /api/crm/studies  — 안건에 시험(시험번호) 추가
 * body: { dealId, itemName?, studyNumber?, director? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { studyCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _POST(req: Request) {
  const owners = await visibleOwnerIds();
  const parsed = await parseBody(req, studyCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;
  const deal = await prisma.deal.findUnique({ where: { id: b.dealId } });
  if (!deal || !owners.includes(deal.ownerId)) return NextResponse.json({ error: '안건을 찾을 수 없습니다.' }, { status: 404 });

  const study = await prisma.study.create({
    data: {
      dealId: b.dealId,
      itemName: b.itemName,
      studyNumber: b.studyNumber,
      director: b.director,
    },
  });
  if (['INQUIRY', 'QUOTE'].includes(deal.stage)) {
    await prisma.deal.update({ where: { id: b.dealId }, data: { stage: 'STUDY' } });
  }
  return NextResponse.json({ study });
}

export const POST = withErrorHandling(_POST);
