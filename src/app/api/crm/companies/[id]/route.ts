/**
 * GET    /api/crm/companies/[id]  — 고객사 상세 (의뢰자 + 각 의뢰자의 안건)
 * PATCH  /api/crm/companies/[id]  — 고객사 수정
 * DELETE /api/crm/companies/[id]  — 고객사 삭제 (의뢰자 cascade)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function ownedCompany(id: number) {
  const owners = await visibleOwnerIds();
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c || !owners.includes(c.ownerId)) return null;
  return c;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { createdAt: 'asc' },
        include: {
          deals: {
            orderBy: { updatedAt: 'desc' },
            include: {
              quotes: { select: { id: true, quoteNumber: true, status: true, grandTotal: true, createdAt: true } },
              contract: true,
              studies: { orderBy: { createdAt: 'asc' } },
              notes: { orderBy: { occurredAt: 'desc' } },
              events: { orderBy: { startAt: 'asc' } },
            },
          },
        },
      },
    },
  });
  if (!company) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 회사 단위 집계 — 모든 의뢰자의 모든 안건을 가로질러 평탄화 (각 탭의 데이터원)
  type DealRel = (typeof company.contacts)[number]['deals'][number];
  const flatDeals = company.contacts.flatMap(ct =>
    ct.deals.map(d => ({ ...d, contactName: ct.name, contactId: ct.id })));
  const dealMeta = (d: DealRel) => ({ dealId: d.id, dealTitle: d.title, modality: d.modality, stage: d.stage });

  const dealQuotes = flatDeals.flatMap(d => d.quotes.map(q => ({ ...q, ...dealMeta(d), contactId: d.contactId })));
  const dealQuoteIds = new Set(dealQuotes.map(q => q.id));
  // 딜 없이 companyId 로만 연결된 견적(엑셀 임포트 견적) — 회사 상세에 함께 노출
  const directRaw = await prisma.quote.findMany({
    where: { companyId: id, id: { notIn: [...dealQuoteIds] } },
    select: { id: true, quoteNumber: true, status: true, grandTotal: true, createdAt: true, modality: true, projectName: true },
    orderBy: { sentAt: 'desc' },
  });
  const directQuotes = directRaw.map(q => ({ id: q.id, quoteNumber: q.quoteNumber, status: q.status, grandTotal: q.grandTotal, createdAt: q.createdAt, dealId: null, dealTitle: q.projectName, modality: q.modality, contactId: null as number | null }));
  const allQuotes = [...flatDeals.flatMap(d => d.quotes), ...directRaw];
  // 최근 견적 목록 (딜 견적 + 직결 견적 병합, 최신순)
  const quotes = [...dealQuotes, ...directQuotes]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const contracts = flatDeals.filter(d => d.contract).map(d => ({ ...d.contract!, ...dealMeta(d) }));
  const studies = flatDeals.flatMap(d => d.studies.map(s => ({ ...s, ...dealMeta(d) })));
  const notes = flatDeals.flatMap(d => d.notes.map(n => ({ ...n, ...dealMeta(d), contactName: d.contactName, contactId: d.contactId })))
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  const events = flatDeals.flatMap(d => d.events.map(e => ({ ...e, ...dealMeta(d), contactId: d.contactId })))
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  const kpi = {
    quoteCount: allQuotes.length,
    quoteAmount: allQuotes.reduce((s, q) => s + (q.grandTotal ?? 0), 0),
    wonAmount: allQuotes.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + (q.grandTotal ?? 0), 0),
    dealCount: flatDeals.length,
    activeDeals: flatDeals.filter(d => d.status === 'ACTIVE').length,
    activeStudies: studies.filter(s => !s.reportDraftIssuedAt).length,
  };

  return NextResponse.json({ company, agg: { deals: flatDeals.map(d => ({ ...dealMeta(d), id: d.id, title: d.title, status: d.status, updatedAt: d.updatedAt, contactName: d.contactName, contactId: d.contactId, quoteCount: d.quotes.length, quoteAmount: d.quotes.reduce((s, q) => s + (q.grandTotal ?? 0), 0), wonAmount: d.quotes.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + (q.grandTotal ?? 0), 0) })), quotes, contracts, studies, notes, events, kpi } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['name', 'bizRegNo', 'industry', 'address', 'memo'] as const) {
    if (k in body) data[k] = String(body[k] ?? '').trim() || (k === 'name' ? undefined : null);
  }
  if ('isNewClient' in body) data.isNewClient = !!body.isNewClient;
  if (data.name === undefined && 'name' in body) return NextResponse.json({ error: '고객사명은 비울 수 없습니다.' }, { status: 400 });
  const company = await prisma.company.update({ where: { id }, data });
  return NextResponse.json({ company });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await currentUserId();
  await prisma.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
