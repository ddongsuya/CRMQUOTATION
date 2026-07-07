import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';

/** 일일보고 편집/생성. PATCH=수정, POST(부모 route)에서 신규는 별도. { workContent?, contractPlan?, activityNote?, contractAmount? } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '본문 오류' }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const k of ['workContent', 'contractPlan', 'activityNote'] as const) {
    if (k in body) data[k] = body[k] === '' ? null : String(body[k]);
  }
  if ('contractAmount' in body) { const n = Number(body.contractAmount); data.contractAmount = Number.isFinite(n) && n > 0 ? n : null; }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '변경 없음' }, { status: 400 });
  await prisma.dailyReport.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  await prisma.dailyReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
