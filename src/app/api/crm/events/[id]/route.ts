/**
 * PATCH  /api/crm/events/[id]  — 일정 수정 (완료 체크·이동 등)
 * DELETE /api/crm/events/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const e = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!e || !owners.includes(e.ownerId)) return null;
  return e;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if ('title' in b) { const v = String(b.title ?? '').trim(); if (!v) return NextResponse.json({ error: '제목은 비울 수 없습니다.' }, { status: 400 }); data.title = v; }
  if ('type' in b) data.type = String(b.type);
  if ('startAt' in b) data.startAt = new Date(String(b.startAt));
  if ('endAt' in b) data.endAt = b.endAt ? new Date(String(b.endAt)) : null;
  if ('done' in b) data.done = !!b.done;
  const event = await prisma.calendarEvent.update({ where: { id }, data });
  return NextResponse.json({ event });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
