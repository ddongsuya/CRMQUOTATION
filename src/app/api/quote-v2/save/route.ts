/**
 * 견적 엔진 v2 — 저장. 서버에서 재구성·재평가한 권위 스냅샷을 Quote 테이블에 영속.
 *  POST /api/quote-v2/save  body: { category, standard, route, plan, customer*, dealId, issueNow, ... }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextQuoteNumber } from '@/lib/quote-number';
import { currentUserId } from '@/lib/current-user';
import { evaluateQuote } from '@/lib/quote-engine/engine';
import { composeFromPlan, composeAnalysisLines, type ComposePlan } from '@/lib/quote-engine/compose';
import { getItem } from '@/lib/quote-engine/master';
import type { LineItem } from '@/lib/quote-engine/types';
import { buildCompanyIndex, matchCompanyId } from '@/lib/admin/company-match';

export const dynamic = 'force-dynamic';

type Body = {
  category: string; standard: 'MFDS' | 'OECD'; route: string; plan?: ComposePlan; selectedItemIds?: string[];
  customerConditions?: Record<string, boolean>; requestedAddons?: Record<string, boolean>; combinationCount?: number;
  currency?: 'KRW' | 'USD'; discountRate?: number; exchangeRate?: number;
  projectName?: string; substanceName?: string; customerName?: string; customerCompany?: string; customerEmail?: string;
  dealId?: number | null; issueNow?: boolean;
  quantityOverrides?: Record<string, number>; removedIds?: string[];   // step4 수량·삭제 조정
};

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b?.category || (!b.plan && !b.selectedItemIds?.length)) return NextResponse.json({ error: 'category + (plan 또는 selectedItemIds) 필요' }, { status: 400 });

  const std = b.standard ?? 'MFDS';
  const route = b.route ?? '경구';
  // 배터리형(체크리스트): 선택 id 직접 / 파라메트릭: plan 자동구성
  let selectedItems: { id: string }[];
  let extraLines: LineItem[] = [];
  let planForSnapshot: ComposePlan | { modality: string; selectedItemIds: string[] };
  if (b.plan) {
    const plan = { ...b.plan, modality: b.category, standard: std, route };
    const composed = composeFromPlan(plan);
    selectedItems = composed.map(c => ({ id: c.id }));
    const masterItems = composed.map(c => getItem(c.id)).filter((x): x is NonNullable<typeof x> => !!x);
    extraLines = composeAnalysisLines(plan, masterItems);
    planForSnapshot = plan;
  } else {
    selectedItems = (b.selectedItemIds ?? []).map(id => ({ id }));
    planForSnapshot = { modality: b.category, selectedItemIds: b.selectedItemIds ?? [] };
  }
  const quote = evaluateQuote({
    category: b.category, standard: std, route,
    selectedItems, extraLines,
    customerConditions: b.customerConditions ?? {}, requestedAddons: b.requestedAddons ?? {}, combinationCount: b.combinationCount,
    quantityOverrides: b.quantityOverrides, removedIds: b.removedIds,
  });

  const subtotal = quote.totals.subtotalKrw;
  const discountRate = Math.min(Math.max(b.discountRate ?? 0, 0), 0.9);
  const afterDiscount = subtotal * (1 - discountRate);
  const itemRows = quote.lineItems.map((li, i) => ({
    testItemKey: li.id, testNameSnapshot: li.testName, adminRouteSnap: li.route, category: b.category,
    tag: [...li.appliedRules, ...(li.isPrereq ? ['선행'] : [])].join(',') || null,
    unitPrice: li.unitPrice ?? 0, quantity: li.quantity, subtotal: li.amount ?? 0,
    source: li.isPrereq ? 'auto' : 'engine', priority: null, displayOrder: i,
  }));

  const userId = await currentUserId();
  const quoteNumber = await nextQuoteNumber();

  // 신규/기존 고객사 자동 연결 — 견적서에 고객사명이 있으면 CRM(고객관리)에 Company를 find-or-create 하고 companyId FK를 건다.
  // 정규화 매칭으로 표기 변형(㈜·공백 등)을 흡수해 중복 생성을 막는다. 의뢰자가 있으면 Contact도 함께 upsert.
  let companyId: number | null = null;
  const companyName = (b.customerCompany ?? '').trim();
  if (companyName) {
    const companies = await prisma.company.findMany({ select: { id: true, name: true, aliases: true } });
    companyId = matchCompanyId(companyName, buildCompanyIndex(companies));
    if (companyId == null) {
      const co = await prisma.company.create({ data: { name: companyName, ownerId: userId }, select: { id: true } });
      companyId = co.id;
    }
    const contactName = (b.customerName ?? '').trim();
    if (contactName) {
      const email = (b.customerEmail ?? '').trim() || undefined;
      const existing = await prisma.contact.findFirst({ where: { companyId, name: contactName }, select: { id: true } });
      if (!existing) await prisma.contact.create({ data: { companyId, name: contactName, email } });
      else if (email) await prisma.contact.update({ where: { id: existing.id }, data: { email } });
    }
  }

  const created = await prisma.quote.create({
    data: {
      quoteNumber, userId, dealId: b.dealId ?? null, companyId: companyId ?? undefined,
      projectName: b.projectName || `${b.customerCompany ?? ''} ${b.category}`.trim() || b.category,
      substanceName: b.substanceName ?? null,
      customerName: b.customerName ?? null, customerCompany: b.customerCompany ?? null, customerEmail: b.customerEmail ?? null,
      modality: b.category, priceStandard: std,
      planJson: JSON.stringify({ ...planForSnapshot, engine: 'v2' }),
      excipientCount: (b.plan?.excipientCount) ?? 0,
      currency: b.currency ?? 'KRW', exchangeRate: b.currency === 'USD' ? (b.exchangeRate ?? 1400) : null, discountRate,
      totalBeforeDiscount: subtotal, totalAfterDiscount: afterDiscount, vatAmount: afterDiscount * 0.1, grandTotal: afterDiscount * 1.1,
      ...(b.issueNow ? { status: 'ISSUED', issuedAt: new Date(), validUntil: new Date(Date.now() + 60 * 86400_000) } : {}),
      items: { create: itemRows },
    },
    select: { id: true, quoteNumber: true },
  });
  return NextResponse.json({ quote: created });
}
