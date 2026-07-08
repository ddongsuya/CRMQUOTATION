import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId } from '@/lib/current-user';

/** 견적 추적 편집 — { trackingNote?, status?, contractNo?, contractAmount?, note? }. 결론/상태 변경 시 이력 적재. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const authorId = await currentUserId();
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '본문 오류' }, { status: 400 });

  const prev = await prisma.quote.findUnique({ where: { id }, select: { trackingNote: true, status: true } });
  if (!prev) return NextResponse.json({ error: '견적 없음' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if ('trackingNote' in body) data.trackingNote = body.trackingNote === '' ? null : String(body.trackingNote);
  if ('status' in body && ['DRAFT', 'ISSUED', 'SENT', 'REVIEWED', 'ACCEPTED', 'REJECTED'].includes(body.status)) data.status = body.status;
  if ('contractNo' in body) data.contractNo = body.contractNo === '' ? null : String(body.contractNo);
  if ('contractAmount' in body) { const n = Number(body.contractAmount); data.contractAmount = Number.isFinite(n) && n > 0 ? n : null; }
  if (Object.keys(data).length === 0 && !body.note) return NextResponse.json({ error: '변경 없음' }, { status: 400 });

  if (Object.keys(data).length) await prisma.quote.update({ where: { id }, data });

  // 결론/상태가 바뀌었거나 메모가 있으면 이력 1건 적재
  const conclusionChanged = 'trackingNote' in data && data.trackingNote !== prev.trackingNote;
  const statusChanged = 'status' in data && data.status !== prev.status;
  if (conclusionChanged || statusChanged || body.note) {
    await prisma.quoteTracking.create({
      data: {
        quoteId: id,
        conclusion: (('trackingNote' in data ? data.trackingNote : prev.trackingNote) as string | null) ?? null,
        status: (('status' in data ? data.status : prev.status) as string | null) ?? null,
        note: body.note ? String(body.note) : null,
        authorId,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
