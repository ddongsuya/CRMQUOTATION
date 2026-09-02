/**
 * PATCH  /api/crm/contacts/[id]  — 의뢰자 수정
 * DELETE /api/crm/contacts/[id]  — 의뢰자 삭제
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

async function ownedContact(id: number) {
  const owners = await visibleOwnerIds();
  const c = await prisma.contact.findUnique({ where: { id }, include: { company: true } });
  if (!c || !owners.includes(c.company.ownerId)) return null;
  return c;
}

async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedContact(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['name', 'email', 'phone', 'position', 'memo'] as const) {
    if (k in body) data[k] = String(body[k] ?? '').trim() || (k === 'name' ? undefined : null);
  }
  if (data.name === undefined && 'name' in body) return NextResponse.json({ error: '의뢰자명은 비울 수 없습니다.' }, { status: 400 });
  const contact = await prisma.contact.update({ where: { id }, data });
  return NextResponse.json({ contact });
}

async function _DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedContact(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
