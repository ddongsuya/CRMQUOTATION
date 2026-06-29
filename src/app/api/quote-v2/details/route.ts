/**
 * 견적 엔진 v2 — 시험항목 상세(인쇄 부록용). POST { ids } → 446 마스터의 상세/주의사항/가이드라인.
 */
import { NextResponse } from 'next/server';
import { getItem } from '@/lib/quote-engine/master';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ids?: string[] } | null;
  const ids = body?.ids ?? [];
  const details = ids.map(id => {
    const it = getItem(id);
    if (!it) return null;
    const guideline = [it.guidelineCode, it.guidelineSummary].filter(Boolean).join(' — ') || null;
    return {
      key: it.id, testName: it.testName ?? undefined, category: it.category ?? null,
      studyWeeks: it.studyWeeks ?? null, detail: it.detail ?? null, notice: it.notice ?? null,
      quoteText: null, guideline,
    };
  }).filter(Boolean);
  return NextResponse.json({ details });
}
