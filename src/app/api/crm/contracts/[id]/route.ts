/**
 * PATCH /api/crm/contracts/[id]  — 계약 수정 (상태·날짜·계약번호 + 지급회차 교체)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { contractPatchSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const c = await prisma.contract.findUnique({ where: { id }, include: { deal: true } });
  if (!c || !owners.includes(c.deal.ownerId)) return null;
  return c;
}

async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = await parseBody(req, contractPatchSchema);
  if (!parsed.ok) return parsed.res;
  const { paymentTerms, ...scalars } = parsed.data;   // 키 없음 → undefined(Prisma 가 무시)

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      ...scalars,
      // 지급회차 교체 (전체 replace) — 스키마가 seq 미지정 시 index+1, kind 기본 INTERIM 을 채운다
      ...(paymentTerms ? { paymentTerms: { deleteMany: {}, create: paymentTerms } } : {}),
    },
    include: { paymentTerms: { orderBy: { seq: 'asc' } } },
  });
  return NextResponse.json({ contract });
}

export const PATCH = withErrorHandling(_PATCH);
