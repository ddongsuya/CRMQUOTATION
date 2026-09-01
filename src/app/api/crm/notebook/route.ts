/**
 * GET /api/crm/notebook — 개인 데일리 워크스페이스용 집계.
 *  · tasks: 내 할 일(미완료 전체 + 최근 완료) — 오늘의 포커스(기한 오늘)·팔로업 큐의 데이터원
 *  · todayEvents: 오늘 일정(약속 — 미팅 등) 참고 표시용
 *  · weekDone: 이번 주(월~) 완료한 할 일 수
 *  메모는 /api/crm/notes 재사용.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owners = await visibleOwnerIds();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const tasks = await prisma.task.findMany({
    where: { ownerId: { in: owners }, OR: [{ done: false }, { doneAt: { gte: new Date(now.getTime() - 14 * 86400_000) } }] },
    include: {
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
    },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 200,
  });

  const todayEvents = await prisma.calendarEvent.findMany({
    where: { ownerId: { in: owners }, startAt: { gte: dayStart, lt: dayEnd } },
    include: { deal: { select: { id: true, title: true } }, contact: { select: { company: { select: { id: true, name: true } } } } },
    orderBy: { startAt: 'asc' },
  });

  // 이번 주(월~) 완료한 할 일 수
  const day = now.getDay(); const mondayOffset = (day + 6) % 7;
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(now.getDate() - mondayOffset);
  const weekDone = await prisma.task.count({ where: { ownerId: { in: owners }, done: true, doneAt: { gte: weekStart } } });

  return NextResponse.json({
    tasks: tasks.map(t => ({
      id: t.id, title: t.title, memo: t.memo, dueAt: t.dueAt?.toISOString() ?? null, done: t.done,
      companyId: t.companyId, companyName: t.company?.name ?? null,
      dealId: t.dealId, dealTitle: t.deal?.title ?? null,
    })),
    todayEvents: todayEvents.map(e => ({
      id: e.id, title: e.title, type: e.type, location: e.location,
      dealId: e.dealId, dealTitle: e.deal?.title ?? null,
      companyId: e.contact?.company?.id ?? null, companyName: e.contact?.company?.name ?? null,
    })),
    weekDone,
  });
}
