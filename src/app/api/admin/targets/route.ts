import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin/guard';

import { withErrorHandling } from '@/lib/api-handler';
/** 목표(Target) 저장 — 관리자 뷰 전용. { period, rows: [{ centerId|null, amount|null }] }. amount null → 삭제. */
async function _POST(req: Request) {
  const denied = await requireAdmin(); if (denied) return denied;

  const body = await req.json().catch(() => null);
  const period = (body?.period ?? '').toString();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!/^\d{4}(H1|H2)?$/.test(period)) return NextResponse.json({ error: '기간 오류' }, { status: 400 });

  for (const r of rows) {
    const centerId = r?.centerId != null ? Number(r.centerId) : null;
    const amount = r?.amount != null && r.amount !== '' ? Number(r.amount) : null;
    const existing = await prisma.target.findFirst({ where: { centerId, period } });
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      if (existing) await prisma.target.delete({ where: { id: existing.id } });
      continue;
    }
    if (existing) await prisma.target.update({ where: { id: existing.id }, data: { amount } });
    else await prisma.target.create({ data: { centerId, period, amount } });
  }
  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(_POST);
