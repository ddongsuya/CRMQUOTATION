/**
 * PATCH  /api/crm/tasks/[id]  — 할 일 수정 (완료 토글·제목·기한·연결 대상)
 * DELETE /api/crm/tasks/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';
import { checkLinkOwnership } from '@/lib/crm-guards';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t || !owners.includes(t.ownerId)) return null;
  return t;
}

async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if ('title' in b) { const v = String(b.title ?? '').trim(); if (!v) return NextResponse.json({ error: '내용은 비울 수 없습니다.' }, { status: 400 }); data.title = v; }
  if ('memo' in b) data.memo = String(b.memo ?? '').trim() || null;
  if ('dueAt' in b) data.dueAt = b.dueAt ? new Date(String(b.dueAt)) : null;
  if ('done' in b) { data.done = !!b.done; data.doneAt = b.done ? new Date() : null; }
  const linkErr = await checkLinkOwnership(b);   // 재연결 대상도 내 소유여야 함
  if (linkErr) return NextResponse.json({ error: linkErr }, { status: 404 });
  if ('companyId' in b) data.companyId = b.companyId ? Number(b.companyId) : null;
  if ('contactId' in b) data.contactId = b.contactId ? Number(b.contactId) : null;
  if ('dealId' in b) data.dealId = b.dealId ? Number(b.dealId) : null;
  const task = await prisma.task.update({ where: { id }, data });
  return NextResponse.json({ task });
}

async function _DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
