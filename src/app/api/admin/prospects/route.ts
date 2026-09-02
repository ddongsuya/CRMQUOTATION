import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin/guard';
import { currentUserId } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
const FIELDS = ['name', 'pipeline', 'platform', 'stage', 'indTarget', 'croOutlook', 'founded', 'location', 'ceo', 'companyType', 'note'] as const;

/** 잠재 고객 신규. { name(필수), pipeline?, platform?, ... } */
async function _POST(req: Request) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '기업명 필요' }, { status: 400 });

  const data: Record<string, unknown> = { name, ownerId: await currentUserId() };
  for (const f of FIELDS) if (f !== 'name' && body[f] != null && body[f] !== '') data[f] = String(body[f]);
  const p = await prisma.prospect.create({ data: data as { name: string; ownerId: number }, select: { id: true } });
  return NextResponse.json({ ok: true, id: p.id });
}

export const POST = withErrorHandling(_POST);
