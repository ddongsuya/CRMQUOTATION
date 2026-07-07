import { NextResponse } from 'next/server';
import { getViewMode } from '@/lib/admin/view';
import { getCompanyDetail } from '@/lib/admin/aggregate';

/** 회사(고객사)명 기준 관련 항목 집계 — 드로어용. */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const detail = await getCompanyDetail(decodeURIComponent(params.name));
  return NextResponse.json(detail);
}
