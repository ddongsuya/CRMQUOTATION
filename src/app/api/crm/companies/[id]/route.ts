/**
 * GET    /api/crm/companies/[id]  — 고객사 상세 (의뢰자 + 각 의뢰자의 안건)
 * PATCH  /api/crm/companies/[id]  — 고객사 수정
 * DELETE /api/crm/companies/[id]  — 고객사 삭제 (의뢰자 cascade)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function ownedCompany(id: number) {
  const owners = await visibleOwnerIds();
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c || !owners.includes(c.ownerId)) return null;
  return c;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { createdAt: 'asc' },
        include: {
          deals: {
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, modality: true, stage: true, status: true, updatedAt: true },
          },
        },
      },
    },
  });
  return NextResponse.json({ company });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['name', 'bizRegNo', 'industry', 'address', 'memo'] as const) {
    if (k in body) data[k] = String(body[k] ?? '').trim() || (k === 'name' ? undefined : null);
  }
  if ('isNewClient' in body) data.isNewClient = !!body.isNewClient;
  if (data.name === undefined && 'name' in body) return NextResponse.json({ error: '고객사명은 비울 수 없습니다.' }, { status: 400 });
  const company = await prisma.company.update({ where: { id }, data });
  return NextResponse.json({ company });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await currentUserId();
  await prisma.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
