import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/current-user';
import { getGlobalSearch } from '@/lib/admin/aggregate';

/** 전역 검색 — ?q=. 회사·견적·기록 통합. */
export async function GET(req: Request) {
  await currentUserId();
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const r = await getGlobalSearch(q);
  return NextResponse.json(r);
}
