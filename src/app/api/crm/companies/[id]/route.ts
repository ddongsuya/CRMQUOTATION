/**
 * GET    /api/crm/companies/[id]  — 고객사 상세 (의뢰자 + 각 의뢰자의 안건)
 * PATCH  /api/crm/companies/[id]  — 고객사 수정
 * DELETE /api/crm/companies/[id]  — 고객사 삭제 (의뢰자 cascade)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';
import { supplyOrZero } from '@/lib/money';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

async function ownedCompany(id: number) {
  const owners = await visibleOwnerIds();
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c || !owners.includes(c.ownerId)) return null;
  return c;
}

async function _GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { createdAt: 'asc' },
        include: {
          // 안건 없이 의뢰자에게 직접 기록된 노트·일정 (안건 소속은 deals 경유로 수집 — 중복 방지)
          notes: { where: { dealId: null }, orderBy: { occurredAt: 'desc' }, take: 50 },
          events: { where: { dealId: null }, orderBy: { startAt: 'asc' }, take: 50 },
          deals: {
            orderBy: { updatedAt: 'desc' },
            include: {
              quotes: { select: { id: true, quoteNumber: true, status: true, grandTotal: true, totalAfterDiscount: true, createdAt: true, supersededAt: true } },
              contract: true,
              studies: { orderBy: { createdAt: 'asc' } },
              notes: { orderBy: { occurredAt: 'desc' }, take: 50 },
              events: { orderBy: { startAt: 'asc' }, take: 50 },
            },
          },
        },
      },
    },
  });
  if (!company) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const supply = supplyOrZero;   // 공급가(VAT 별도) — lib/money 단일 소스

  // 회사 단위 집계 — 모든 의뢰자의 모든 안건을 가로질러 평탄화 (각 탭의 데이터원)
  type DealRel = (typeof company.contacts)[number]['deals'][number];
  const flatDeals = company.contacts.flatMap(ct =>
    ct.deals.map(d => ({ ...d, contactName: ct.name, contactId: ct.id })));
  const dealMeta = (d: DealRel) => ({ dealId: d.id, dealTitle: d.title, modality: d.modality, stage: d.stage });

  const dealQuotes = flatDeals.flatMap(d => d.quotes.map(q => ({ ...q, supplyTotal: supply(q), ...dealMeta(d), contactId: d.contactId })));
  const dealQuoteIds = new Set(dealQuotes.map(q => q.id));
  // 딜 없이 companyId 로만 연결된 견적(엑셀 임포트 견적) — 회사 상세에 함께 노출
  const directRaw = await prisma.quote.findMany({
    where: { companyId: id, id: { notIn: [...dealQuoteIds] } },
    select: { id: true, quoteNumber: true, status: true, grandTotal: true, totalAfterDiscount: true, createdAt: true, modality: true, projectName: true, contactId: true, customerName: true, supersededAt: true },
    orderBy: { sentAt: 'desc' },
  });
  // 담당자(의뢰자) 연결 — contactId FK 우선, 없으면(구 데이터) 이름 매칭 폴백
  const contactByName = new Map(company.contacts.map(c => [c.name.trim(), c.id] as const));
  const directQuotes = directRaw.map(q => ({
    id: q.id, quoteNumber: q.quoteNumber, status: q.status, grandTotal: q.grandTotal, supplyTotal: supply(q), createdAt: q.createdAt, supersededAt: q.supersededAt,
    dealId: null, dealTitle: q.projectName, modality: q.modality,
    contactId: q.contactId ?? (q.customerName ? contactByName.get(q.customerName.trim()) ?? null : null),
    contactName: q.customerName ?? null,
  }));
  const allQuotes = [...flatDeals.flatMap(d => d.quotes), ...directRaw];
  // 최근 견적 목록 (딜 견적 + 직결 견적 병합, 최신순)
  const quotes = [...dealQuotes, ...directQuotes]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const contracts = flatDeals.filter(d => d.contract).map(d => ({ ...d.contract!, ...dealMeta(d) }));
  const studies = flatDeals.flatMap(d => d.studies.map(s => ({ ...s, ...dealMeta(d) })));
  // 노트·일정 = 안건 소속 + 의뢰자 직속(안건 없음) 병합
  const contactNotes = company.contacts.flatMap(ct => ct.notes.map(n => ({ ...n, dealId: null, dealTitle: null, modality: null, stage: null, contactName: ct.name, contactId: ct.id })));
  const contactEvents = company.contacts.flatMap(ct => ct.events.map(e => ({ ...e, dealId: null, dealTitle: null, modality: null, stage: null, contactName: ct.name, contactId: ct.id })));
  const notes = [
    ...flatDeals.flatMap(d => d.notes.map(n => ({ ...n, ...dealMeta(d), contactName: d.contactName, contactId: d.contactId }))),
    ...contactNotes,
  ].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  const events = [
    ...flatDeals.flatMap(d => d.events.map(e => ({ ...e, ...dealMeta(d), contactName: d.contactName, contactId: d.contactId }))),
    ...contactEvents,
  ].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  // KPI 는 현재 진행 중(최신) 견적만 — 변경견적으로 대체된 버전은 제외 (이중 집계 방지)
  const activeQuotes = allQuotes.filter(q => !q.supersededAt);
  const kpi = {
    quoteCount: activeQuotes.length,
    quoteAmount: activeQuotes.reduce((s, q) => s + supply(q), 0),
    wonAmount: activeQuotes.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + supply(q), 0),
    dealCount: flatDeals.length,
    activeDeals: flatDeals.filter(d => d.status === 'ACTIVE').length,
    activeStudies: studies.filter(s => !s.reportDraftIssuedAt).length,
  };

  return NextResponse.json({ company, agg: { deals: flatDeals.map(d => ({ ...dealMeta(d), id: d.id, title: d.title, status: d.status, updatedAt: d.updatedAt, contactName: d.contactName, contactId: d.contactId, quoteCount: d.quotes.filter(q => !q.supersededAt).length, quoteAmount: d.quotes.filter(q => !q.supersededAt).reduce((s, q) => s + supply(q), 0), wonAmount: d.quotes.filter(q => q.status === 'ACCEPTED' && !q.supersededAt).reduce((s, q) => s + supply(q), 0) })), quotes, contracts, studies, notes, events, kpi } });
}

async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
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

async function _DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await ownedCompany(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 연결 데이터 확인 — 안건이 있으면 FK(Restrict)로 삭제 시 500, 견적은 companyId 가 조용히 null 로 풀려 고아가 된다.
  // 사용자가 먼저 정리하도록 명확한 409 로 막는다.
  const [dealCount, quoteCount] = await Promise.all([
    prisma.deal.count({ where: { contact: { companyId: id } } }),
    prisma.quote.count({ where: { companyId: id } }),
  ]);
  if (dealCount > 0 || quoteCount > 0) {
    const parts = [dealCount > 0 ? `안건 ${dealCount}건` : '', quoteCount > 0 ? `견적 ${quoteCount}건` : ''].filter(Boolean).join(' · ');
    return NextResponse.json({ error: `연결된 ${parts}이 있어 삭제할 수 없습니다. 먼저 정리해 주세요.` }, { status: 409 });
  }

  try {
    await prisma.company.delete({ where: { id } });   // 남은 의뢰자(안건 없는)는 cascade
  } catch {
    return NextResponse.json({ error: '삭제에 실패했습니다. 연결된 데이터를 확인해 주세요.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
