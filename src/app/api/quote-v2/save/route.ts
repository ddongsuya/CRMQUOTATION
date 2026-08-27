/**
 * 견적 엔진 v2 — 저장. 서버에서 재구성·재평가한 권위 스냅샷을 Quote 테이블에 영속.
 *  POST /api/quote-v2/save  body: { category, standard, route, plan, customer*, dealId, issueNow, ... }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createQuoteWithNumber } from '@/lib/quote-number';
import { currentUserId } from '@/lib/current-user';
import { evaluateQuote } from '@/lib/quote-engine/engine';
import { composeFromPlan, composeAnalysisLines, type ComposePlan } from '@/lib/quote-engine/compose';
import { getItem } from '@/lib/quote-engine/master';
import type { LineItem } from '@/lib/quote-engine/types';
import { findOrCreateCompanyWithContact } from '@/lib/admin/company-match';

export const dynamic = 'force-dynamic';

type Body = {
  category: string; standard: 'MFDS' | 'OECD'; route: string; plan?: ComposePlan; selectedItemIds?: string[];
  customerConditions?: Record<string, boolean>; requestedAddons?: Record<string, boolean>; combinationCount?: number;
  addonTargets?: Record<string, string[]>; addonPriceOverrides?: Record<string, number>;
  currency?: 'KRW' | 'USD'; discountRate?: number; exchangeRate?: number;
  projectName?: string; substanceName?: string; customerName?: string; customerCompany?: string; customerEmail?: string; customerPhone?: string;
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
    addonTargets: b.addonTargets, addonPriceOverrides: b.addonPriceOverrides,
  });

  const subtotal = quote.totals.subtotalKrw;
  const discountRate = Math.min(Math.max(b.discountRate ?? 0, 0), 0.5);   // 할인 상한 50% (사용자 정책)
  const afterDiscount = subtotal * (1 - discountRate);
  const itemRows = quote.lineItems.map((li, i) => ({
    testItemKey: li.id, testNameSnapshot: li.testName, adminRouteSnap: li.route as string | null, category: b.category,
    tag: [...li.appliedRules, ...(li.isPrereq ? ['선행'] : [])].join(',') || null,
    unitPrice: li.unitPrice ?? 0, quantity: li.quantity, subtotal: li.amount ?? 0,
    source: li.isPrereq ? 'auto' : 'engine', priority: null, displayOrder: i,
  }));
  // 채택된 추가 옵션도 견적 항목으로 영속 — 견적서(인쇄)와 합계가 어긋나지 않게 한다.
  const addonRows = quote.addons.map((a, i) => ({
    testItemKey: `_addon-${a.ruleId}-${i}`, testNameSnapshot: a.name, adminRouteSnap: null, category: b.category,
    tag: a.priceMissing ? '옵션·협의' : '옵션',
    unitPrice: a.price, quantity: 1, subtotal: a.price,
    source: 'addon', priority: null, displayOrder: quote.lineItems.length + i,
  }));
  itemRows.push(...addonRows);

  const userId = await currentUserId();
  const companyName = (b.customerCompany ?? '').trim();
  const contactName = (b.customerName ?? '').trim();

  // 고객사 find-or-create + 연락처 upsert + 견적 생성을 하나의 트랜잭션으로 (중간 실패 시 전부 롤백 → 고아 고객사 방지).
  // 견적번호 재시도는 트랜잭션 단위 — P2002 로 tx 가 중단되면 새 번호로 트랜잭션 전체를 재실행.
  const created = await createQuoteWithNumber((quoteNumber) => prisma.$transaction(async (tx) => {
    const companyId = companyName
      ? await findOrCreateCompanyWithContact(tx, {
          companyName, ownerId: userId, contactName,
          email: (b.customerEmail ?? '').trim() || undefined, phone: (b.customerPhone ?? '').trim() || undefined,
        })
      : null;
    return tx.quote.create({
      data: {
        quoteNumber, userId, dealId: b.dealId ?? null, companyId: companyId ?? undefined,
        projectName: b.projectName || `${b.customerCompany ?? ''} ${b.category}`.trim() || b.category,
        substanceName: b.substanceName ?? null,
        customerName: b.customerName ?? null, customerCompany: b.customerCompany ?? null, customerEmail: b.customerEmail ?? null, customerPhone: b.customerPhone ?? null,
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
  }));
  return NextResponse.json({ quote: created });
}
