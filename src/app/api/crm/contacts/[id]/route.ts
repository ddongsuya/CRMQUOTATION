/**
 * PATCH  /api/crm/contacts/[id]  — 의뢰자 수정
 * DELETE /api/crm/contacts/[id]  — 의뢰자 삭제
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { contactPatchSchema } from '@/lib/schemas/crm';
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
  const parsed = await parseBody(req, contactPatchSchema);
  if (!parsed.ok) return parsed.res;
  // 스키마 출력: 키 없음 → undefined(Prisma 가 무시), 있으면 trim·''→null 정규화 완료
  const contact = await prisma.contact.update({ where: { id }, data: parsed.data });
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
