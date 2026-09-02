/**
 * GET /api/crm/agenda?from=&to=  — 날짜성 항목 통합 (대시보드 알람 + 캘린더용)
 *   = 수동 일정(CalendarEvent) + 파생 마일스톤(시험 보고서안 발행+30일 잔금, 보고서안 발행예정,
 *     견적 송부 검토 팔로업) 을 한 목록으로.
 *   범위 미지정 시: 지연(과거 미완료) + 향후 60일.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

type Item = {
  date: string; kind: 'event' | 'milestone' | 'task'; type: string; title: string;
  taskId?: number;
  dealId?: number; dealTitle?: string; company?: string; companyId?: number; contact?: string; contactId?: number;
  quoteId?: number; eventId?: number; done?: boolean;
  // 수동 일정 편집 프리필용 (캘린더·고객상세 공용)
  location?: string | null; attendeesClient?: string | null; attendeesInternal?: string | null; requests?: string | null;
};

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);

async function _GET(req: Request) {
  const owners = await visibleOwnerIds();
  const { searchParams } = new URL(req.url);
  const fromP = searchParams.get('from');
  const toP = searchParams.get('to');
  const now = new Date();
  const from = fromP ? new Date(fromP) : addDays(now, -3650);  // 지연 포함
  const to = toP ? new Date(toP) : addDays(now, 60);

  const inRange = (d: Date | null) => !!d && d >= from && d <= to;
  const items: Item[] = [];

  // 1) 수동 일정
  const events = await prisma.calendarEvent.findMany({
    where: { ownerId: { in: owners }, startAt: { gte: from, lte: to } },
    include: { deal: { select: { id: true, title: true } }, contact: { select: { name: true, company: { select: { id: true, name: true } } } } },
  });
  for (const e of events) {
    items.push({
      date: e.startAt.toISOString(), kind: 'event', type: e.type, title: e.title,
      dealId: e.deal?.id, dealTitle: e.deal?.title, contact: e.contact?.name, company: e.contact?.company?.name,
      companyId: e.contact?.company?.id, contactId: e.contactId ?? undefined,
      eventId: e.id, done: e.done,
      location: e.location, attendeesClient: e.attendeesClient, attendeesInternal: e.attendeesInternal, requests: e.requests,
    });
  }

  // 1.5) 기한 있는 할 일 — 캘린더·알람에 옅게 표시 (완료 여부 포함)
  const tasks = await prisma.task.findMany({
    where: { ownerId: { in: owners }, dueAt: { not: null, gte: from, lte: to } },
    include: { company: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
  });
  for (const t of tasks) {
    items.push({
      date: t.dueAt!.toISOString(), kind: 'task', type: 'TASK', title: t.title,
      dealId: t.deal?.id, dealTitle: t.deal?.title, company: t.company?.name, companyId: t.company?.id,
      taskId: t.id, done: t.done,
    });
  }

  // 2) 파생 마일스톤 — 시험 보고서안/잔금
  // 보고서안 예정일이 범위 안이거나, 발행됐지만 계산서 미발행(잔금 기한 산출 대상)인 것만
  const studies = await prisma.study.findMany({
    where: {
      deal: { ownerId: { in: owners } },
      OR: [
        { reportDraftIssuedAt: null, reportDraftDueAt: { gte: from, lte: to } },
        { reportDraftIssuedAt: { not: null, gte: addDays(from, -30), lte: to }, invoiceIssuedAt: null },
      ],
    },
    include: { deal: { select: { id: true, title: true, contact: { select: { name: true, company: { select: { id: true, name: true } } } } } } },
  });
  for (const s of studies) {
    const ctx = { dealId: s.deal.id, dealTitle: s.deal.title, contact: s.deal.contact.name, company: s.deal.contact.company.name, companyId: s.deal.contact.company.id };
    // 보고서안 발행 예정 (미발행)
    if (!s.reportDraftIssuedAt && inRange(s.reportDraftDueAt)) {
      items.push({ date: s.reportDraftDueAt!.toISOString(), kind: 'milestone', type: 'MILESTONE', title: `최종보고서(안) 발행 예정${s.studyNumber ? ` · ${s.studyNumber}` : ''}`, ...ctx });
    }
    // 잔금 기한 = 보고서안 발행 + 30일 (세금계산서 미발행)
    if (s.reportDraftIssuedAt && !s.invoiceIssuedAt) {
      const due = addDays(s.reportDraftIssuedAt, 30);
      if (inRange(due)) items.push({ date: due.toISOString(), kind: 'milestone', type: 'DEADLINE', title: `잔금 지급 기한 (보고서안+30일)${s.studyNumber ? ` · ${s.studyNumber}` : ''}`, ...ctx });
    }
  }

  // 3) 견적 파생 알림 — 소유자 기준(딜 없는 앱 견적·임포트 견적 포함. 예전엔 deal 필수라 대부분 누락)
  const quotes = await prisma.quote.findMany({
    where: {
      userId: { in: owners },
      status: { in: ['ISSUED', 'SENT', 'REVIEWED'] },   // 진행 중(수주·반려 전)만
      supersededAt: null,                                // 변경견적으로 대체된 버전 제외
      OR: [{ sentAt: { gte: addDays(from, -7), lte: to } }, { validUntil: { gte: from, lte: to } }],
    },
    select: {
      id: true, quoteNumber: true, sentAt: true, validUntil: true, customerCompany: true, companyId: true,
      deal: { select: { id: true, title: true, contact: { select: { name: true, company: { select: { id: true, name: true } } } } } },
    },
  });
  for (const q of quotes) {
    const ctx = q.deal
      ? { dealId: q.deal.id, dealTitle: q.deal.title, contact: q.deal.contact.name, company: q.deal.contact.company.name, companyId: q.deal.contact.company.id, quoteId: q.id }
      : { company: q.customerCompany ?? undefined, companyId: q.companyId ?? undefined, quoteId: q.id };
    // 송부 +7일 검토 팔로업
    if (q.sentAt) {
      const due = addDays(q.sentAt, 7);
      if (inRange(due)) items.push({ date: due.toISOString(), kind: 'milestone', type: 'REMINDER', title: `견적 검토 확인 (${q.quoteNumber})`, ...ctx });
    }
    // 유효기간 만료 임박 (발행일+60일) — 만료 전 재확인 유도
    if (q.validUntil && inRange(q.validUntil)) {
      items.push({ date: q.validUntil.toISOString(), kind: 'milestone', type: 'DEADLINE', title: `견적 유효기간 만료 (${q.quoteNumber})`, ...ctx });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ items, now: now.toISOString() });
}

export const GET = withErrorHandling(_GET);
