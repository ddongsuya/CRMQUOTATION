import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId } from '@/lib/current-user';
import { getViewMode } from '@/lib/admin/view';
import { ownsQuote } from '@/lib/crm-guards';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

/** 견적 추적 편집 — { trackingNote?, status?, contractNo?, contractAmount?, note? }. 결론/상태 변경 시 이력 적재. */
async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const authorId = await currentUserId();
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '본문 오류' }, { status: 400 });

  const prev = await prisma.quote.findUnique({ where: { id }, select: { trackingNote: true, status: true, sentAt: true } });
  if (!prev) return NextResponse.json({ error: '견적 없음' }, { status: 404 });
  // 라우트 자체에서 권한 검사 — 미들웨어(현재 비활성)에 기대지 않는다: 관리자이거나 견적 소유자여야 함
  const isAdmin = (await getViewMode()).actualIsAdmin;
  if (!isAdmin && !(await ownsQuote(id))) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const data: Record<string, unknown> = {};
  if ('trackingNote' in body) data.trackingNote = body.trackingNote === '' ? null : String(body.trackingNote);
  if ('status' in body && ['DRAFT', 'ISSUED', 'SENT', 'REVIEWED', 'ACCEPTED', 'REJECTED'].includes(body.status)) data.status = body.status;
  if ('contractNo' in body) data.contractNo = body.contractNo === '' ? null : String(body.contractNo);
  if ('contractAmount' in body) { const n = Number(body.contractAmount); data.contractAmount = Number.isFinite(n) && n > 0 ? n : null; }
  // 발송일 — 명시 지정(소급 입력) 또는 SENT 전환 시 자동 기록. 팔로업 알림의 기준일.
  if ('sentAt' in body) {
    const d = body.sentAt ? new Date(body.sentAt) : null;
    data.sentAt = d && !isNaN(d.getTime()) ? d : null;
  } else if (data.status === 'SENT' && !prev.sentAt) {
    data.sentAt = new Date();
  }
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

export const PATCH = withErrorHandling(_PATCH);
