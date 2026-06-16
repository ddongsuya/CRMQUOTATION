import { NextResponse } from 'next/server';
import { loadData } from '@/lib/data';

export async function POST(req: Request) {
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
      detail: it.detail ?? null,
      notice: it.notice ?? null,
      quoteText: it.quoteText ?? null,
      guideline: it.guideline ?? null,
    };
  });
  return NextResponse.json({ items });
}
