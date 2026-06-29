/**
 * 견적 엔진 v2 API.
 *  GET  /api/quote-v2?category=의약품  — 카테고리 목록 + 해당 카테고리 항목 + 조건/옵션 키
 *  POST /api/quote-v2                  — QuoteInput → Quote (evaluateQuote)
 */
import { NextResponse } from 'next/server';
import { evaluateQuote } from '@/lib/quote-engine/engine';
import { loadMaster, loadRules } from '@/lib/quote-engine/master';
import type { QuoteInput } from '@/lib/quote-engine/types';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const master = loadMaster();
  const categories = [...new Set(master.map(i => i.category))];

  const items = (category ? master.filter(i => i.category === category) : []).map(i => ({
    id: i.id, testName: i.testName, testClass: i.testClass, species: i.species,
    componentCount: i.componentCount, analysisMethod: i.analysisMethod,
    tkPoints: i.tkPoints, tkMode: i.tkMode,
    priceA: i.prices['경구피하근육'], priceB: i.prices['정맥경피'],
  }));

  // 고객조건·추가옵션 키 추출
  const R = loadRules();
  const cond = new Set<string>();
  for (const sec of ['waiver_rules', 'substitution_rules', 'conditional_groups', 'conditional_groups_v1_1_audit']) {
    for (const r of ((R[sec] as Record<string, unknown>[]) ?? [])) {
      const blob = JSON.stringify(r);
      for (const m of blob.matchAll(/"(?:condition_key|sub_condition_key|waiver_condition_key)":"([^"]+)"/g)) cond.add(m[1]);
    }
  }
  const addons = [...((R['addons'] as Record<string, unknown>[]) ?? []), ...((R['addons_v1_1_audit'] as Record<string, unknown>[]) ?? [])]
    .filter(a => a.optional)
    .map(a => ({ key: a.addon_name as string, label: a.addon_name_ko as string, price: a.price_krw as number }));

  return NextResponse.json({ categories, items, conditionKeys: [...cond], addonOptions: addons });
}

export async function POST(req: Request) {
  const input = (await req.json().catch(() => null)) as QuoteInput | null;
  if (!input || !input.category || !Array.isArray(input.selectedItems)) {
    return NextResponse.json({ error: 'category·selectedItems 필요' }, { status: 400 });
  }
  const quote = evaluateQuote({
    category: input.category, standard: input.standard ?? 'MFDS', route: input.route ?? '경구',
    submissionTarget: input.submissionTarget, selectedItems: input.selectedItems,
    customerConditions: input.customerConditions ?? {}, requestedAddons: input.requestedAddons ?? {},
    combinationCount: input.combinationCount,
  });
  return NextResponse.json({ quote });
}
