import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';

/** 견적 현황 추적 편집 — 관리자 뷰 전용. { trackingNote?, status?, contractNo?, contractAmount? }. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '본문 오류' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if ('trackingNote' in body) data.trackingNote = body.trackingNote === '' ? null : String(body.trackingNote);
  if ('status' in body && ['DRAFT', 'ISSUED', 'SENT', 'REVIEWED', 'ACCEPTED', 'REJECTED'].includes(body.status)) data.status = body.status;
  if ('contractNo' in body) data.contractNo = body.contractNo === '' ? null : String(body.contractNo);
  if ('contractAmount' in body) { const n = Number(body.contractAmount); data.contractAmount = Number.isFinite(n) && n > 0 ? n : null; }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '변경 없음' }, { status: 400 });

  await prisma.quote.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
