import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/current-user';
import { getQuoteDetail } from '@/lib/admin/aggregate';

/** 견적 상세(추적 타임라인) — 드로어용. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await currentUserId();
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const d = await getQuoteDetail(id);
  if (!d) return NextResponse.json({ error: '없음' }, { status: 404 });
  return NextResponse.json(d);
}
