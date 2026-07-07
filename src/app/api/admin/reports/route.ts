import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';

/** 일일보고 신규(수동 추가). { date(YYYY-MM-DD), workContent?, contractPlan?, activityNote? } */
export async function POST(req: Request) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const m = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(String(body?.date ?? ''));
  if (!m) return NextResponse.json({ error: '날짜 형식 오류' }, { status: 400 });
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const ownerId = await currentUserId();

  const data = {
    ownerId, date,
    workContent: body.workContent ? String(body.workContent) : null,
    contractPlan: body.contractPlan ? String(body.contractPlan) : null,
    activityNote: body.activityNote ? String(body.activityNote) : null,
  };
  const report = await prisma.dailyReport.upsert({
    where: { ownerId_date: { ownerId, date } },
    update: data,
    create: data,
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: report.id });
}
