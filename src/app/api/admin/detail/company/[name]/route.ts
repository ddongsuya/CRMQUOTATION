import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/current-user';
import { getCompanyDetail } from '@/lib/admin/aggregate';

/** 회사(고객사)명 기준 관련 항목 집계 — 드로어용(사용자·관리자 뷰 공통, 읽기전용). */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  await currentUserId(); // 인증(데모) 확인
  const detail = await getCompanyDetail(decodeURIComponent(params.name));
  return NextResponse.json(detail);
}
