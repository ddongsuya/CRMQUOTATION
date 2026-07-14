import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { nextQuoteNumber } from '@/lib/quote-number';
import { getItemByKey } from '@/lib/data';
import { assembleQuoteLines } from '@/engine/assemble';
import { computeTotals } from '@/engine/pricing';
import { ensureHydrated } from '@/lib/hydrate';

async function currentUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ? Number(id) : null;
}

const PRICE_ANALYSIS_UNIT = 1_000_000;

type SaveBody = {
  id?: number;                   // present → update; absent → create
  projectName: string;
  substanceName?: string;
  customerName?: string;
  customerCompany?: string;
  customerEmail?: string;
  modality: string;
  priceStandard: 'MFDS' | 'OECD';
  dealId?: number | null;          // CRM 안건 연결
  plan: object;
  selections: {
    key: string;
    quantity: number;
    tag?: string;
    priority?: string;
    source?: string;
    // Phase C-1: 사용자 직접 입력 (override). null = 자동값 사용.
    unitPriceOverride?: number | null;
    studyWeeksOverride?: number | null;
    hamryangCountOverride?: number | null;
    customNote?: string | null;
  }[];
  excipientCount: number;
  currency: 'KRW' | 'USD';
  exchangeRate?: number;
  discountRate: number;
  issueNow?: boolean;            // if true, also stamp issuedAt + status=ISSUED
};

/** GET /api/quotes — list quotes owned by the current user (admins see all). */
export async function GET() {
  const userId = await currentUserId();
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  // ⚠️ DEMO(로그인 OFF): 세션 없으면 전체 노출. 정식 인증(Phase 5) 시 { id: -1 }(=본인만)로 복구.
  const where = role === 'admin' ? {} : userId ? { userId } : {};
  const rows = await prisma.quote.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, quoteNumber: true, projectName: true, customerCompany: true,
      studyType: true, modality: true, status: true, grandTotal: true, currency: true,
      issuedAt: true, updatedAt: true, createdAt: true,
      _count: { select: { items: true } },
    },
    take: 200,
  });
  return NextResponse.json({ quotes: rows });
}

/** POST /api/quotes — create or update. */
export async function POST(req: Request) {
  await ensureHydrated();
  const body = await req.json() as SaveBody;

  // Hydrate + compute totals so we store an authoritative snapshot
  // Phase C-1: override 필드는 그대로 engine 에 전달 (자동값과 다르면 line.note 에 표시됨)
  const hydrated = body.selections.flatMap(sel => {
    const item = getItemByKey(sel.key);
    if (!item) return [];
    return [{
      item: item as unknown as object,
      quantity: sel.quantity,
      unitPriceOverride:     sel.unitPriceOverride     ?? null,
      studyWeeksOverride:    sel.studyWeeksOverride    ?? null,
      hamryangCountOverride: sel.hamryangCountOverride ?? null,
      customNote:            sel.customNote            ?? null,
    }];
  });
  const { lines } = assembleQuoteLines(hydrated, {
    excipientCount: body.excipientCount,
    priceStandard: body.priceStandard,
    priceAnalysisUnit: PRICE_ANALYSIS_UNIT,
  }) as { lines: Array<{ subtotal: number; kind: 'test' | 'analysis'; testItemKey?: string; testName: string; adminRoute: string | null; unitPrice: number; quantity: number; note?: string }>; warnings: string[] };
  const totals = computeTotals(
    lines as unknown as { subtotal: number }[],
    body.discountRate,
    body.currency,
    body.currency === 'USD' ? body.exchangeRate : undefined,
  );

  const baseData = {
    projectName: body.projectName,
    substanceName: body.substanceName ?? null,
    customerName: body.customerName ?? null,
    customerCompany: body.customerCompany ?? null,
    customerEmail: body.customerEmail ?? null,
    modality: body.modality,
    priceStandard: body.priceStandard,
    dealId: body.dealId ?? null,
    planJson: JSON.stringify(body.plan),
    excipientCount: body.excipientCount,
    currency: body.currency,
    exchangeRate: body.exchangeRate ?? null,
    discountRate: body.discountRate,
    totalBeforeDiscount: totals.totalBeforeDiscount,
    totalAfterDiscount: totals.totalAfterDiscount,
    vatAmount: totals.vatAmount,
    grandTotal: totals.grandTotal,
    ...(body.issueNow
      ? { status: 'ISSUED', issuedAt: new Date(), validUntil: new Date(Date.now() + 60 * 86400_000) }
      : {}),
  };

  // QuoteItem rows reflect ONLY user-chosen test items, not the synthesized analysis line.
  // Phase C-1: override 값들도 DB 에 같이 저장 → 견적 재현 시 어떤 값이 수동인지 추적 가능
  const itemRows = body.selections.map((sel, i) => {
    const it = getItemByKey(sel.key);
    const line = lines.find(l => l.kind === 'test' && l.testItemKey === sel.key);
    return {
      testItemKey: sel.key,
      testNameSnapshot: it?.testName ?? '(unknown)',
      adminRouteSnap: it?.adminRoute ?? null,
      category: it?.category ?? null,
      tag: sel.tag ?? null,
      unitPrice: line?.unitPrice ?? 0,           // override 적용된 최종 가격
      quantity: sel.quantity,
      subtotal: line?.subtotal ?? 0,
      source: sel.source ?? 'preset',
      priority: sel.priority ?? null,
      displayOrder: i,
      unitPriceOverride:     sel.unitPriceOverride     ?? null,
      studyWeeksOverride:    sel.studyWeeksOverride    ?? null,
      hamryangCountOverride: sel.hamryangCountOverride ?? null,
      customNote:            sel.customNote            ?? null,
    };
  });

  const userId = await currentUserId();

  if (body.id) {
    // Ownership check: only owner (or admin) may update
    const existing = await prisma.quote.findUnique({ where: { id: body.id }, select: { userId: true } });
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (existing.userId !== userId && role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    await prisma.quoteItem.deleteMany({ where: { quoteId: body.id } });
    const updated = await prisma.quote.update({
      where: { id: body.id },
      data: { ...baseData, items: { create: itemRows } },
      include: { items: true },
    });
    return NextResponse.json({ quote: updated });
  } else {
    const quoteNumber = await nextQuoteNumber();
    const created = await prisma.quote.create({
      data: { quoteNumber, userId, ...baseData, items: { create: itemRows } },
      include: { items: true },
    });
    return NextResponse.json({ quote: created });
  }
}
