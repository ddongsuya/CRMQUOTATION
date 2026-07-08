/**
 * GET  /api/crm/companies  — 내 고객사 목록 (의뢰자·안건 수 동봉)
 * POST /api/crm/companies  — 고객사 생성
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owners = await visibleOwnerIds();
  const rows = await prisma.company.findMany({
    where: { ownerId: { in: owners } },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { contacts: true } },
      contacts: { select: { deals: { select: { status: true, quotes: { select: { id: true, grandTotal: true, status: true } } } } } },
      quotes: { select: { id: true, grandTotal: true, status: true } },   // companyId 직결(임포트 견적)
    },
  });
  // 회사별 집계 = 딜 견적 + companyId 직결 견적(중복 id 제거). 페이로드는 집계 후 제거.
  const companies = rows.map(({ contacts, quotes: directQuotes, ...c }) => {
    const deals = contacts.flatMap(ct => ct.deals);
    const merged = new Map<number, { grandTotal: number | null; status: string }>();
    for (const q of deals.flatMap(d => d.quotes)) merged.set(q.id, q);
    for (const q of directQuotes) merged.set(q.id, q);
    const quotes = [...merged.values()];
    const wonAmount = quotes.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + (q.grandTotal ?? 0), 0);
    return {
      ...c,
      dealCount: deals.length,
      activeDeals: deals.filter(d => d.status === 'ACTIVE').length,
      quoteCount: quotes.length,
      quoteAmount: quotes.reduce((s, q) => s + (q.grandTotal ?? 0), 0),
      wonAmount,
      vip: wonAmount >= 50_000_000,   // 파생: 누적수주 5천만↑
    };
  });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const ownerId = await currentUserId();
  const body = await req.json().catch(() => null) as {
    name?: string; bizRegNo?: string; industry?: string; address?: string; isNewClient?: boolean; memo?: string;
  } | null;
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '고객사명을 입력하세요.' }, { status: 400 });

  const company = await prisma.company.create({
    data: {
      ownerId,
      name,
      bizRegNo: body?.bizRegNo?.trim() || null,
      industry: body?.industry?.trim() || null,
      address: body?.address?.trim() || null,
      isNewClient: body?.isNewClient ?? true,
      memo: body?.memo?.trim() || null,
    },
  });
  return NextResponse.json({ company });
}
