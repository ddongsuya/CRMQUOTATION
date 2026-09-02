import { NextResponse } from 'next/server';
import { adminReadScope } from '@/lib/admin/guard';
import { getGlobalSearch } from '@/lib/admin/aggregate';

import { withErrorHandling } from '@/lib/api-handler';
/** 전역 검색 — ?q=. 회사·견적·기록 통합. */
async function _GET(req: Request) {
  const uids = await adminReadScope(); // 관리자 뷰=전사, 일반=본인 범위
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const r = await getGlobalSearch(q, uids);
  return NextResponse.json(r);
}

export const GET = withErrorHandling(_GET);
