/**
 * POST /api/crm/contacts  — 의뢰자 생성 (소속 고객사 지정)
 * body: { companyId, name, email?, phone?, position?, memo? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { contactCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _POST(req: Request) {
  const owners = await visibleOwnerIds();
  const parsed = await parseBody(req, contactCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  const company = await prisma.company.findUnique({ where: { id: b.companyId } });
  if (!company || !owners.includes(company.ownerId)) return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 });

  const contact = await prisma.contact.create({
    data: {
      companyId: b.companyId,
      name: b.name,
      email: b.email,
      phone: b.phone,
      position: b.position,
      memo: b.memo,
    },
  });
  return NextResponse.json({ contact });
}

export const POST = withErrorHandling(_POST);
