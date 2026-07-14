/**
 * 효력시험 견적 저장 — 클라이언트 상태를 받아 서버에서 원가·견적을 재계산(권위 스냅샷)해 Quote에 영속.
 * POST /api/quote-efficacy/save  body: { state: EffState, quoteId?: number }
 *
 * 우리 프로젝트 규칙 준수:
 *  - 고객사명이 있으면 정규화 매칭으로 Company find-or-create → companyId FK 연결(고객관리 자동 등록)
 *  - 의뢰자가 있으면 Contact upsert
 *  - studyType='efficacy' (핸드오프 §5), planJson에 상태 직렬화, 견적 라인은 스냅샷 저장
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextQuoteNumber } from '@/lib/quote-number';
import { currentUserId } from '@/lib/current-user';
import { buildCompanyIndex, matchCompanyId } from '@/lib/admin/company-match';
import { computeCost, computeQuote, findModel, totalAnimalsOf, totalDaysOf, type EffState } from '@/app/quote-efficacy/_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { state?: EffState; quoteId?: number | null; dealId?: number | null } | null;
  const s = body?.state;
  if (!s?.modelId) return NextResponse.json({ error: '모델이 선택되지 않았습니다.' }, { status: 400 });
  if (!s.client?.company?.trim()) return NextResponse.json({ error: '고객사를 입력해 주세요.' }, { status: 400 });

  const m = findModel(s.modelId);
  const cost = computeCost(s, m);
  const q = computeQuote(cost.total, s.margin, s.discount);

  const totalWeeks = Math.ceil(totalDaysOf(s.schedule) / 7);
  const totalAnimals = totalAnimalsOf(s.groups);
  const modelTitle = m.title.replace(/^[IVX]+-\d+\.\s*/, '');
  const userId = await currentUserId();

  // 고객사 자동 등록 — 표기 변형 흡수(정규화 매칭), 없으면 생성
  const companyName = s.client.company.trim();
  const companies = await prisma.company.findMany({ select: { id: true, name: true, aliases: true } });
  let companyId = matchCompanyId(companyName, buildCompanyIndex(companies));
  if (companyId == null) {
    const co = await prisma.company.create({ data: { name: companyName, ownerId: userId }, select: { id: true } });
    companyId = co.id;
  }
  const contactName = (s.client.name ?? '').trim();
  if (contactName) {
    const email = (s.client.email ?? '').trim() || undefined;
    const phone = (s.client.phone ?? '').trim() || undefined;
    const existing = await prisma.contact.findFirst({ where: { companyId, name: contactName }, select: { id: true } });
    if (!existing) await prisma.contact.create({ data: { companyId, name: contactName, email, phone } });
    else if (email || phone) await prisma.contact.update({ where: { id: existing.id }, data: { email, phone } });
  }

  const itemRows = cost.items.map((it, i) => ({
    testItemKey: `EFF_${it.category}_${i}`,
    testNameSnapshot: it.name,
    adminRouteSnap: s.params.route,
    category: it.category,
    tag: it.multiplier > 1 ? `×${it.multiplier}` : null,
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    subtotal: it.subtotal,
    source: 'efficacy-engine',
    priority: null,
    displayOrder: i,
  }));

  const data = {
    userId,
    companyId,
    dealId: body?.dealId ?? null,
    studyType: 'efficacy',
    projectName: s.client.projectName?.trim() || `${modelTitle} 효력시험`,
    substanceName: s.client.substanceName?.trim() || null,
    substanceType: m.category,
    modality: '효력시험',
    customerCompany: companyName,
    customerName: s.client.name || null,
    customerEmail: s.client.email || null,
    customerPhone: s.client.phone || null,
    planJson: JSON.stringify({ ...s, engine: 'efficacy', modelId: m.id, totalWeeks, totalAnimals }),
    discountRate: s.discount,
    totalBeforeDiscount: q.wp,
    totalAfterDiscount: q.disc,
    vatAmount: q.vatAmt,
    grandTotal: q.vat,
  };

  // 같은 세션에서 재저장하면 기존 견적을 갱신(라인 교체), 아니면 신규 발번
  if (body?.quoteId) {
    const exists = await prisma.quote.findUnique({ where: { id: body.quoteId }, select: { id: true, quoteNumber: true } });
    if (exists) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: exists.id } });
      const updated = await prisma.quote.update({
        where: { id: exists.id },
        data: { ...data, items: { create: itemRows } },
        select: { id: true, quoteNumber: true },
      });
      return NextResponse.json({ quote: updated });
    }
  }

  const quoteNumber = await nextQuoteNumber();
  const created = await prisma.quote.create({
    data: {
      quoteNumber, ...data,
      status: 'ISSUED', issuedAt: new Date(), validUntil: new Date(Date.now() + 60 * 86400_000),
      items: { create: itemRows },
    },
    select: { id: true, quoteNumber: true },
  });
  return NextResponse.json({ quote: created });
}
