/**
 * GET  /api/crm/events?from=&to=  — 기간 내 일정 (수동 이벤트)
 * POST /api/crm/events            — 일정 생성
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const owners = await visibleOwnerIds();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const events = await prisma.calendarEvent.findMany({
    where: {
      ownerId: { in: owners },
      ...(from || to ? { startAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    orderBy: { startAt: 'asc' },
    include: { deal: { select: { id: true, title: true } }, contact: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const ownerId = await currentUserId();
  const b = await req.json().catch(() => null) as { title?: string; type?: string; startAt?: string; endAt?: string; allDay?: boolean; dealId?: number; contactId?: number } | null;
  const title = String(b?.title ?? '').trim();
  if (!title || !b?.startAt) return NextResponse.json({ error: '제목·날짜가 필요합니다.' }, { status: 400 });
  const type = ['MEETING', 'DEADLINE', 'MILESTONE', 'REMINDER'].includes(String(b?.type)) ? String(b!.type) : 'MEETING';
  const event = await prisma.calendarEvent.create({
    data: {
      ownerId, title, type,
      startAt: new Date(b.startAt),
      endAt: b?.endAt ? new Date(b.endAt) : null,
      allDay: b?.allDay ?? true,
      dealId: b?.dealId ? Number(b.dealId) : null,
      contactId: b?.contactId ? Number(b.contactId) : null,
    },
  });
  return NextResponse.json({ event });
}
