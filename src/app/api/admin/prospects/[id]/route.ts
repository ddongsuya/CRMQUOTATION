import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';

const FIELDS = ['name', 'pipeline', 'platform', 'stage', 'indTarget', 'croOutlook', 'founded', 'location', 'ceo', 'companyType', 'note'] as const;

/** 잠재 고객 편집. { <field>: value } — 빈 문자열=null. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '본문 오류' }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) data[f] = body[f] === '' ? null : String(body[f]);
  if ('name' in data && !data.name) return NextResponse.json({ error: '기업명은 비울 수 없음' }, { status: 400 });
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '변경 없음' }, { status: 400 });
  await prisma.prospect.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  await prisma.prospect.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
