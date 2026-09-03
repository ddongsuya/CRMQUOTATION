/**
 * PATCH  /api/crm/tasks/[id]  — 할 일 수정 (완료 토글·제목·기한·연결 대상)
 * DELETE /api/crm/tasks/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';
import { checkLinkOwnership } from '@/lib/crm-guards';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { taskPatchSchema } from '@/lib/schemas/crm';
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
  const parsed = await parseBody(req, taskPatchSchema);
  if (!parsed.ok) return parsed.res;
  const { done, ...rest } = parsed.data;   // 키 없음 → undefined(Prisma 가 무시)
  const linkErr = await checkLinkOwnership(rest);   // 재연결 대상도 내 소유여야 함
  if (linkErr) return NextResponse.json({ error: linkErr }, { status: 404 });
  const task = await prisma.task.update({
    where: { id },
    data: { ...rest, ...(done !== undefined ? { done, doneAt: done ? new Date() : null } : {}) },
  });
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
