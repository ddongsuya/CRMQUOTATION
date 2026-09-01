/**
 * PATCH  /api/crm/tasks/[id]  — 할 일 수정 (완료 토글·제목·기한·연결 대상)
 * DELETE /api/crm/tasks/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t || !owners.includes(t.ownerId)) return null;
  return t;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if ('title' in b) { const v = String(b.title ?? '').trim(); if (!v) return NextResponse.json({ error: '내용은 비울 수 없습니다.' }, { status: 400 }); data.title = v; }
  if ('memo' in b) data.memo = String(b.memo ?? '').trim() || null;
  if ('dueAt' in b) data.dueAt = b.dueAt ? new Date(String(b.dueAt)) : null;
  if ('done' in b) { data.done = !!b.done; data.doneAt = b.done ? new Date() : null; }
  if ('companyId' in b) data.companyId = b.companyId ? Number(b.companyId) : null;
  if ('contactId' in b) data.contactId = b.contactId ? Number(b.contactId) : null;
  if ('dealId' in b) data.dealId = b.dealId ? Number(b.dealId) : null;
  const task = await prisma.task.update({ where: { id }, data });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
