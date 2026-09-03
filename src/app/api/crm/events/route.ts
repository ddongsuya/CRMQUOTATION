/**
 * GET  /api/crm/events?from=&to=  — 기간 내 일정 (수동 이벤트)
 * POST /api/crm/events            — 일정 생성
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';
import { checkLinkOwnership } from '@/lib/crm-guards';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { eventCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _GET(req: Request) {
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

async function _POST(req: Request) {
  const ownerId = await currentUserId();
  const parsed = await parseBody(req, eventCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;
  const linkErr = await checkLinkOwnership(b);
  if (linkErr) return NextResponse.json({ error: linkErr }, { status: 404 });
  const event = await prisma.calendarEvent.create({
    data: {
      ownerId, title: b.title, type: b.type,
      startAt: b.startAt,
      endAt: b.endAt,
      allDay: b.allDay,
      dealId: b.dealId,
      contactId: b.contactId,
      // 미팅 상세 — 장소·참여자(고객사/자사)·요청사항
      location: b.location,
      attendeesClient: b.attendeesClient,
      attendeesInternal: b.attendeesInternal,
      requests: b.requests,
    },
  });
  return NextResponse.json({ event });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
