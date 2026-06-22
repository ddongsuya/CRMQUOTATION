/**
 * GET  /api/crm/companies  — 내 고객사 목록 (의뢰자·안건 수 동봉)
 * POST /api/crm/companies  — 고객사 생성
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owners = await visibleOwnerIds();
  const companies = await prisma.company.findMany({
    where: { ownerId: { in: owners } },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { contacts: true } } },
  });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const ownerId = await currentUserId();
  const body = await req.json().catch(() => null) as {
    name?: string; bizRegNo?: string; industry?: string; address?: string; isNewClient?: boolean; memo?: string;
  } | null;
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '고객사명을 입력하세요.' }, { status: 400 });

  const company = await prisma.company.create({
    data: {
      ownerId,
      name,
      bizRegNo: body?.bizRegNo?.trim() || null,
      industry: body?.industry?.trim() || null,
      address: body?.address?.trim() || null,
      isNewClient: body?.isNewClient ?? true,
      memo: body?.memo?.trim() || null,
    },
  });
  return NextResponse.json({ company });
}
