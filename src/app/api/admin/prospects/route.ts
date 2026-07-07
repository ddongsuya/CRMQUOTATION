import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';

const FIELDS = ['name', 'pipeline', 'platform', 'stage', 'indTarget', 'croOutlook', 'founded', 'location', 'ceo', 'companyType', 'note'] as const;

/** 잠재 고객 신규. { name(필수), pipeline?, platform?, ... } */
export async function POST(req: Request) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '기업명 필요' }, { status: 400 });

  const data: Record<string, unknown> = { name, ownerId: await currentUserId() };
  for (const f of FIELDS) if (f !== 'name' && body[f] != null && body[f] !== '') data[f] = String(body[f]);
  const p = await prisma.prospect.create({ data: data as { name: string; ownerId: number }, select: { id: true } });
  return NextResponse.json({ ok: true, id: p.id });
}
