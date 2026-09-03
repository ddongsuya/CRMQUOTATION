/**
 * POST /api/crm/deals  — 안건 생성 (의뢰자 지정)
 * body: { contactId, title, modality?, indication?, clinicalDesign?, submissionTarget?, reportLanguage? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';
import { supplyTotal } from '@/lib/money';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { dealCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _POST(req: Request) {
  const owners = await visibleOwnerIds();
  const ownerId = await currentUserId();
  const parsed = await parseBody(req, dealCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  const contact = await prisma.contact.findUnique({ where: { id: b.contactId }, include: { company: true } });
  if (!contact || !owners.includes(contact.company.ownerId)) return NextResponse.json({ error: '의뢰자를 찾을 수 없습니다.' }, { status: 404 });

  const deal = await prisma.deal.create({
    data: {
      ownerId,
      contactId: b.contactId,
      title: b.title,
      modality: b.modality,
      indication: b.indication,
      clinicalDesign: b.clinicalDesign,
      submissionTarget: b.submissionTarget,
      reportLanguage: b.reportLanguage,
    },
  });
  return NextResponse.json({ deal });
}

/**
 * GET /api/crm/deals?status=ACTIVE|WON|LOST|ALL  — 파이프라인 카드용 안건 목록 (내 범위).
 * 카드 필드: 고객사·의뢰자·대표 견적 금액(공급가)·마지막 활동일·다음 할 일·계약 상태.
 */
async function _GET(req: Request) {
  const owners = await visibleOwnerIds();
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') ?? 'ACTIVE';
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: { ownerId: { in: owners }, ...(status !== 'ALL' && ['ACTIVE', 'WON', 'LOST'].includes(status) ? { status } : {}) },
    include: {
      contact: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
      quotes: { where: { supersededAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, quoteNumber: true, status: true, totalAfterDiscount: true, grandTotal: true, sentAt: true, validUntil: true } },
      contract: { select: { status: true } },
      notes: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
      events: { where: { startAt: { lte: now } }, orderBy: { startAt: 'desc' }, take: 1, select: { startAt: true } },
      tasks: { where: { done: false }, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }], take: 1, select: { id: true, title: true, dueAt: true } },
      _count: { select: { notes: true, tasks: true, studies: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  const cards = deals.map((d) => {
    const rep = d.quotes.find((q) => q.status !== 'REJECTED') ?? d.quotes[0] ?? null;
    const amount = rep ? supplyTotal(rep) : null;
    const lastAt = [d.notes[0]?.occurredAt, d.events[0]?.startAt, d.updatedAt].filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      id: d.id, title: d.title, stage: d.stage, status: d.status, lostReason: d.lostReason, modality: d.modality,
      company: d.contact.company, contact: { id: d.contact.id, name: d.contact.name },
      quote: rep ? { id: rep.id, quoteNumber: rep.quoteNumber, status: rep.status, sentAt: rep.sentAt, validUntil: rep.validUntil } : null,
      amount, quoteCount: d.quotes.length,
      contractStatus: d.contract?.status ?? null,
      lastActivityAt: lastAt, nextTask: d.tasks[0] ?? null,
      counts: d._count, updatedAt: d.updatedAt, createdAt: d.createdAt,
    };
  });
  return NextResponse.json({ deals: cards, now });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
