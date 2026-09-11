/**
 * POST /api/crm/tasks/[id]/actions  { body, at? }  — 할 일에 취한 액션 기록 추가 (예: "전화함 · 부재중")
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';
import { parseId } from '@/lib/crm-guards';
import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { taskActionCreateSchema } from '@/lib/schemas/crm';

export const dynamic = 'force-dynamic';

async function _POST(req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const owners = await visibleOwnerIds();
  const task = await prisma.task.findUnique({ where: { id }, select: { ownerId: true } });
  if (!task || !owners.includes(task.ownerId)) return NextResponse.json({ error: '할 일을 찾을 수 없습니다.' }, { status: 404 });
  const parsed = await parseBody(req, taskActionCreateSchema);
  if (!parsed.ok) return parsed.res;
  const action = await prisma.taskAction.create({ data: { taskId: id, body: parsed.data.body, at: parsed.data.at ?? new Date() } });
  return NextResponse.json({ action });
}

export const POST = withErrorHandling(_POST);
