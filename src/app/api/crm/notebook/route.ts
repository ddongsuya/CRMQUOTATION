/**
 * GET /api/crm/notebook — 개인 데일리 워크스페이스용 집계.
 *  오늘의 포커스·팔로업 큐(이벤트) + 이번주 처리량. 메모는 /api/crm/notes 재사용.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owners = await visibleOwnerIds();
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86400_000);
  const to = new Date(now.getTime() + 45 * 86400_000);
  const rows = await prisma.calendarEvent.findMany({
    where: { ownerId: { in: owners }, startAt: { gte: from, lte: to } },
    include: { deal: { select: { id: true, title: true } } },
    orderBy: { startAt: 'asc' },
  });
  const events = rows.map(e => ({
    id: e.id, title: e.title, type: e.type, startAt: e.startAt.toISOString(), done: e.done,
    dealId: e.dealId, dealTitle: e.deal?.title ?? null,
  }));
  // 이번 주(월~일) 완료 이벤트 수
  const day = now.getDay(); const mondayOffset = (day + 6) % 7;
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(now.getDate() - mondayOffset);
  const weekDone = rows.filter(e => e.done && e.startAt >= weekStart).length;
  return NextResponse.json({ events, weekDone });
}
