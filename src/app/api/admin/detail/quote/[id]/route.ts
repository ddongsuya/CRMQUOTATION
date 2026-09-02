import { NextResponse } from 'next/server';
import { adminReadScope } from '@/lib/admin/guard';
import { getQuoteDetail } from '@/lib/admin/aggregate';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

/** 견적 상세(추적 타임라인) — 드로어용. */
async function _GET(_req: Request, { params }: { params: { id: string } }) {
  const uids = await adminReadScope(); // 관리자 뷰=전사, 일반=본인 범위
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const d = await getQuoteDetail(id, uids);
  if (!d) return NextResponse.json({ error: '없음' }, { status: 404 });
  return NextResponse.json(d);
}

export const GET = withErrorHandling(_GET);
