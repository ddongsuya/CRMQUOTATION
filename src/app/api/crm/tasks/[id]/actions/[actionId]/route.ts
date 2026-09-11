/**
 * PATCH  /api/crm/tasks/[id]/actions/[actionId]  { body?, at? }
 * DELETE /api/crm/tasks/[id]/actions/[actionId]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';
import { parseId } from '@/lib/crm-guards';
import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { taskActionPatchSchema } from '@/lib/schemas/crm';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string; actionId: string } };

async function owned(params: Ctx['params']) {
  const id = parseId(params.id), aid = parseId(params.actionId);
  if (!id || !aid) return null;
  const owners = await visibleOwnerIds();
  const a = await prisma.taskAction.findUnique({ where: { id: aid }, select: { id: true, taskId: true, task: { select: { ownerId: true } } } });
  if (!a || a.taskId !== id || !owners.includes(a.task.ownerId)) return null;
  return a;
}

async function _PATCH(req: Request, { params }: Ctx) {
  const a = await owned(params);
  if (!a) return NextResponse.json({ error: '액션을 찾을 수 없습니다.' }, { status: 404 });
  const parsed = await parseBody(req, taskActionPatchSchema);
  if (!parsed.ok) return parsed.res;
  const { at, ...rest } = parsed.data;
  const action = await prisma.taskAction.update({ where: { id: a.id }, data: { ...rest, ...(at ? { at } : {}) } });
  return NextResponse.json({ action });
}

async function _DELETE(_req: Request, { params }: Ctx) {
  const a = await owned(params);
  if (!a) return NextResponse.json({ error: '액션을 찾을 수 없습니다.' }, { status: 404 });
  await prisma.taskAction.delete({ where: { id: a.id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
