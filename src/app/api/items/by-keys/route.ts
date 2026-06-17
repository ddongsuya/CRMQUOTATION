import { NextResponse } from 'next/server';
import { loadData } from '@/lib/data';
import { ensureHydrated } from '@/lib/hydrate';

export async function POST(req: Request) {
  await ensureHydrated();
  const body = await req.json() as { keys: string[] };
  const { testItems } = loadData();
  const map = new Map(testItems.map(it => [it.key, it]));
  const items = body.keys.map(k => {
    const it = map.get(k);
    if (!it) return { key: k, missing: true };
    return {
      key: it.key,
      testName: it.testName,
      category: it.category,
      adminRoute: it.adminRoute,
      studyWeeks: it.studyWeeks,
      priceMfds: it.priceMfds ?? null,
      priceOecd: it.priceOecd ?? null,
      detail: it.detail ?? null,
      notice: it.notice ?? null,
      quoteText: it.quoteText ?? null,
      guideline: it.guideline ?? null,
    };
  });
  return NextResponse.json({ items });
}
