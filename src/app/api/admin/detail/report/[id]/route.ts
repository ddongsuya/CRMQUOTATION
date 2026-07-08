import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/current-user';
import { getReportDetail } from '@/lib/admin/aggregate';

/** 일일보고 상세(전문) — 드로어용. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await currentUserId();
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const d = await getReportDetail(id);
  if (!d) return NextResponse.json({ error: '없음' }, { status: 404 });
  return NextResponse.json(d);
}
