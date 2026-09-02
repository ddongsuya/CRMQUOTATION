import { NextResponse } from 'next/server';
import { adminReadScope } from '@/lib/admin/guard';
import { getCompanyDetail } from '@/lib/admin/aggregate';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

/** 회사(고객사)명 기준 관련 항목 집계 — 드로어용(사용자·관리자 뷰 공통, 읽기전용). */
async function _GET(_req: Request, { params }: { params: { name: string } }) {
  const uids = await adminReadScope(); // 관리자 뷰=전사, 일반=본인 범위
  const detail = await getCompanyDetail(decodeURIComponent(params.name), uids);
  return NextResponse.json(detail);
}

export const GET = withErrorHandling(_GET);
