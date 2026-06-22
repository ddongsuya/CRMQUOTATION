/**
 * PATCH  /api/crm/notes/[id]  — 기록 수정
 * DELETE /api/crm/notes/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const n = await prisma.note.findUnique({ where: { id } });
  if (!n || !owners.includes(n.ownerId)) return null;
  return n;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if ('title' in b) data.title = String(b.title ?? '').trim() || null;
  if ('body' in b) { const v = String(b.body ?? '').trim(); if (!v) return NextResponse.json({ error: '내용은 비울 수 없습니다.' }, { status: 400 }); data.body = v; }
  if ('type' in b && ['MEETING', 'CALL', 'MEMO'].includes(String(b.type))) data.type = String(b.type);
  if ('occurredAt' in b) data.occurredAt = b.occurredAt ? new Date(String(b.occurredAt)) : new Date();
  const note = await prisma.note.update({ where: { id }, data });
  return NextResponse.json({ note });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
