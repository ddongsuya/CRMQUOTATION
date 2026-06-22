/**
 * GET /api/crm/agenda?from=&to=  — 날짜성 항목 통합 (대시보드 알람 + 캘린더용)
 *   = 수동 일정(CalendarEvent) + 파생 마일스톤(시험 보고서안 발행+30일 잔금, 보고서안 발행예정,
 *     견적 송부 검토 팔로업) 을 한 목록으로.
 *   범위 미지정 시: 지연(과거 미완료) + 향후 60일.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

type Item = {
  date: string; kind: 'event' | 'milestone'; type: string; title: string;
  dealId?: number; dealTitle?: string; company?: string; contact?: string;
  eventId?: number; done?: boolean;
};

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);

export async function GET(req: Request) {
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
    include: { deal: { select: { id: true, title: true } }, contact: { select: { name: true, company: { select: { name: true } } } } },
  });
  for (const e of events) {
    items.push({
      date: e.startAt.toISOString(), kind: 'event', type: e.type, title: e.title,
      dealId: e.deal?.id, dealTitle: e.deal?.title, contact: e.contact?.name, company: e.contact?.company?.name,
      eventId: e.id, done: e.done,
    });
  }

  // 2) 파생 마일스톤 — 시험 보고서안/잔금
  const studies = await prisma.study.findMany({
    where: { deal: { ownerId: { in: owners } } },
    include: { deal: { select: { id: true, title: true, contact: { select: { name: true, company: { select: { name: true } } } } } } },
  });
  for (const s of studies) {
    const ctx = { dealId: s.deal.id, dealTitle: s.deal.title, contact: s.deal.contact.name, company: s.deal.contact.company.name };
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

  // 3) 견적 송부 후 검토 팔로업 (+7일, 미수락)
  const quotes = await prisma.quote.findMany({
    where: { deal: { ownerId: { in: owners } }, sentAt: { not: null }, accepted: null },
    include: { deal: { select: { id: true, title: true, contact: { select: { name: true, company: { select: { name: true } } } } } } },
  });
  for (const q of quotes) {
    if (!q.deal) continue;
    const due = addDays(q.sentAt!, 7);
    if (inRange(due)) items.push({ date: due.toISOString(), kind: 'milestone', type: 'REMINDER', title: `견적 검토 확인 (${q.quoteNumber})`, dealId: q.deal.id, dealTitle: q.deal.title, contact: q.deal.contact.name, company: q.deal.contact.company.name });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ items, now: now.toISOString() });
}
