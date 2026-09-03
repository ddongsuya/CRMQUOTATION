/**
 * PATCH  /api/crm/notes/[id]  — 기록 수정
 * DELETE /api/crm/notes/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { notePatchSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const n = await prisma.note.findUnique({ where: { id } });
  if (!n || !owners.includes(n.ownerId)) return null;
  return n;
}

async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = await parseBody(req, notePatchSchema);
  if (!parsed.ok) return parsed.res;
  const note = await prisma.note.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ note });
}

async function _DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
