/**
 * GET /api/crm/companies/[id]/activity?limit=  — 고객사 활동 타임라인.
 * 기록·일정·할 일·견적(발행/발송/수주)·계약·시험 이벤트를 시간순 한 줄기로 합친다. (고객 상세 개요 탭)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';
import { ownsCompany, parseId } from '@/lib/crm-guards';
import { withErrorHandling } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export type ActivityItem = {
  at: string;                                  // ISO
  kind: 'note' | 'event' | 'task' | 'quote' | 'contract' | 'study' | 'deal';
  type?: string | null;                        // 하위 유형(Note.type / Event.type / Quote.status …)
  title: string;
  detail?: string | null;
  href?: string;
  refId: number;
  dealId?: number | null;
  done?: boolean;
};

async function _GET(req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  const owners = await visibleOwnerIds();
  if (!(await ownsCompany(id, owners))) return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 });
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit') ?? 60) || 60, 10), 200);

  const contacts = await prisma.contact.findMany({ where: { companyId: id }, select: { id: true, name: true } });
  const contactIds = contacts.map((c) => c.id);
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const deals = await prisma.deal.findMany({ where: { contactId: { in: contactIds } }, select: { id: true, title: true, stage: true, status: true, createdAt: true, updatedAt: true, lostReason: true } });
  const dealIds = deals.map((d) => d.id);
  const dealTitle = new Map(deals.map((d) => [d.id, d.title]));

  const [notes, events, tasks, quotes, contracts, studies] = await Promise.all([
    prisma.note.findMany({ where: { ownerId: { in: owners }, OR: [{ contactId: { in: contactIds } }, { dealId: { in: dealIds } }] }, orderBy: { occurredAt: 'desc' }, take: limit,
      select: { id: true, type: true, title: true, body: true, occurredAt: true, contactId: true, dealId: true } }),
    prisma.calendarEvent.findMany({ where: { ownerId: { in: owners }, OR: [{ contactId: { in: contactIds } }, { dealId: { in: dealIds } }] }, orderBy: { startAt: 'desc' }, take: limit,
      select: { id: true, type: true, title: true, startAt: true, done: true, location: true, dealId: true, contactId: true } }),
    prisma.task.findMany({ where: { ownerId: { in: owners }, OR: [{ companyId: id }, { contactId: { in: contactIds } }, { dealId: { in: dealIds } }] }, orderBy: { updatedAt: 'desc' }, take: limit,
      select: { id: true, title: true, dueAt: true, done: true, doneAt: true, createdAt: true, dealId: true } }),
    prisma.quote.findMany({ where: { AND: [{ OR: [{ userId: { in: owners } }, { userId: null }] }, { OR: [{ companyId: id }, { dealId: { in: dealIds } }] }] }, orderBy: { updatedAt: 'desc' }, take: limit,
      select: { id: true, quoteNumber: true, projectName: true, status: true, createdAt: true, issuedAt: true, sentAt: true, supersededAt: true, revisedFromId: true, dealId: true, totalAfterDiscount: true, grandTotal: true } }),
    prisma.contract.findMany({ where: { dealId: { in: dealIds } }, select: { id: true, dealId: true, status: true, createdAt: true, draftSentAt: true, approvedAt: true, signedAt: true, contractNumber: true } }),
    prisma.study.findMany({ where: { dealId: { in: dealIds } }, select: { id: true, dealId: true, studyNumber: true, itemName: true, requestSentAt: true, reportDraftIssuedAt: true, invoiceIssuedAt: true, createdAt: true } }),
  ]);

  const items: ActivityItem[] = [];
  const push = (it: ActivityItem) => items.push(it);

  for (const d of deals) push({ at: d.createdAt.toISOString(), kind: 'deal', type: 'CREATED', title: `안건 생성 · ${d.title}`, refId: d.id, dealId: d.id, href: `/deals/${d.id}` });
  for (const d of deals) if (d.status === 'LOST') push({ at: d.updatedAt.toISOString(), kind: 'deal', type: 'LOST', title: `실주 · ${d.title}`, detail: d.lostReason, refId: d.id, dealId: d.id, href: `/deals/${d.id}` });

  for (const n of notes) push({ at: n.occurredAt.toISOString(), kind: 'note', type: n.type, title: n.title || n.body.slice(0, 80), detail: n.title ? n.body.slice(0, 160) : null, refId: n.id, dealId: n.dealId,
    href: n.dealId ? `/deals/${n.dealId}` : undefined });
  for (const e of events) push({ at: e.startAt.toISOString(), kind: 'event', type: e.type, title: e.title, detail: [e.location, e.contactId ? contactName.get(e.contactId) : null].filter(Boolean).join(' · ') || null, refId: e.id, dealId: e.dealId, done: e.done });
  for (const t of tasks) push({ at: (t.done && t.doneAt ? t.doneAt : t.dueAt ?? t.createdAt).toISOString(), kind: 'task', type: t.done ? 'DONE' : 'OPEN', title: t.title, refId: t.id, dealId: t.dealId, done: t.done });

  for (const q of quotes) {
    const amt = q.totalAfterDiscount ?? (q.grandTotal != null ? Math.round(q.grandTotal / 1.1) : null);
    const detail = [q.projectName, amt != null ? `₩${amt.toLocaleString()} (VAT 별도)` : null].filter(Boolean).join(' · ');
    const href = `/quote/print?id=${q.id}`;
    push({ at: q.createdAt.toISOString(), kind: 'quote', type: q.revisedFromId ? 'REVISED' : 'CREATED', title: `${q.revisedFromId ? '변경견적' : '견적'} 작성 · ${q.quoteNumber}`, detail, refId: q.id, dealId: q.dealId, href });
    if (q.issuedAt) push({ at: q.issuedAt.toISOString(), kind: 'quote', type: 'ISSUED', title: `견적 발행 · ${q.quoteNumber}`, detail, refId: q.id, dealId: q.dealId, href });
    if (q.sentAt) push({ at: q.sentAt.toISOString(), kind: 'quote', type: 'SENT', title: `견적 발송 · ${q.quoteNumber}`, detail, refId: q.id, dealId: q.dealId, href });
    if (q.supersededAt) push({ at: q.supersededAt.toISOString(), kind: 'quote', type: 'SUPERSEDED', title: `변경견적으로 대체 · ${q.quoteNumber}`, refId: q.id, dealId: q.dealId, href });
  }
  for (const c of contracts) {
    const t = dealTitle.get(c.dealId) ?? '';
    const href = `/deals/${c.dealId}`;
    push({ at: c.createdAt.toISOString(), kind: 'contract', type: 'CREATED', title: `계약 시작 · ${t}`, refId: c.id, dealId: c.dealId, href });
    if (c.draftSentAt) push({ at: c.draftSentAt.toISOString(), kind: 'contract', type: 'SENT', title: `계약서 초안 송부 · ${t}`, refId: c.id, dealId: c.dealId, href });
    if (c.approvedAt) push({ at: c.approvedAt.toISOString(), kind: 'contract', type: 'APPROVED', title: `계약서 승인 · ${t}`, refId: c.id, dealId: c.dealId, href });
    if (c.signedAt) push({ at: c.signedAt.toISOString(), kind: 'contract', type: 'SIGNED', title: `계약 체결 · ${t}`, detail: c.contractNumber, refId: c.id, dealId: c.dealId, href });
  }
  for (const s of studies) {
    const name = [s.studyNumber, s.itemName].filter(Boolean).join(' · ') || '시험';
    const href = `/deals/${s.dealId}`;
    if (s.requestSentAt) push({ at: s.requestSentAt.toISOString(), kind: 'study', type: 'START', title: `시험 시작 예정 · ${name}`, refId: s.id, dealId: s.dealId, href });
    if (s.reportDraftIssuedAt) push({ at: s.reportDraftIssuedAt.toISOString(), kind: 'study', type: 'REPORT', title: `최종보고서(안) 발행 · ${name}`, refId: s.id, dealId: s.dealId, href });
    if (s.invoiceIssuedAt) push({ at: s.invoiceIssuedAt.toISOString(), kind: 'study', type: 'INVOICE', title: `세금계산서 발행 · ${name}`, refId: s.id, dealId: s.dealId, href });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return NextResponse.json({ items: items.slice(0, limit), total: items.length });
}

export const GET = withErrorHandling(_GET);
