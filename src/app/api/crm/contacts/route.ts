/**
 * POST /api/crm/contacts  — 의뢰자 생성 (소속 고객사 지정)
 * body: { companyId, name, email?, phone?, position?, memo? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const owners = await visibleOwnerIds();
  const body = await req.json().catch(() => null) as {
    companyId?: number; name?: string; email?: string; phone?: string; position?: string; memo?: string;
  } | null;
  const companyId = Number(body?.companyId);
  const name = String(body?.name ?? '').trim();
  if (!companyId || !name) return NextResponse.json({ error: 'companyId·name 이 필요합니다.' }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || !owners.includes(company.ownerId)) return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 });

  const contact = await prisma.contact.create({
    data: {
      companyId,
      name,
      email: body?.email?.trim() || null,
      phone: body?.phone?.trim() || null,
      position: body?.position?.trim() || null,
      memo: body?.memo?.trim() || null,
    },
  });
  return NextResponse.json({ contact });
}
