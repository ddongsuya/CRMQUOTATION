/**
 * 견적 엔진 v2 API.
 *  GET  /api/quote-v2?category=의약품  — 카테고리 목록 + 해당 카테고리 항목 + 조건/옵션 키
 *  POST /api/quote-v2                  — QuoteInput → Quote (evaluateQuote)
 */
import { NextResponse } from 'next/server';
import { evaluateQuote } from '@/lib/quote-engine/engine';
import { loadMaster, loadRules } from '@/lib/quote-engine/master';
import { composeFromPlan, composeAnalysisLines, type ComposePlan } from '@/lib/quote-engine/compose';
import { getItem } from '@/lib/quote-engine/master';
import type { QuoteInput, LineItem } from '@/lib/quote-engine/types';

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

type Body = Partial<QuoteInput> & { plan?: ComposePlan };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.category) return NextResponse.json({ error: 'category 필요' }, { status: 400 });

  // 파라메트릭 plan 이 오면 자동구성, 아니면 직접 선택한 selectedItems 사용
  let composed: { id: string; testName: string | null }[] = [];
  let selectedItems = body.selectedItems ?? [];
  let extraLines: LineItem[] = [];
  if (body.plan) {
    const plan = { ...body.plan, modality: body.category, standard: body.standard ?? 'MFDS', route: body.route ?? '경구' };
    composed = composeFromPlan(plan);
    selectedItems = composed.map(c => ({ id: c.id }));
    // 함량분석·조제물분석(R2/R8) 자동 산출
    const masterItems = composed.map(c => getItem(c.id)).filter((x): x is NonNullable<typeof x> => !!x);
    extraLines = composeAnalysisLines(plan, masterItems);
  }
  if (selectedItems.length === 0) return NextResponse.json({ error: '구성된 시험이 없습니다 (조건을 확인하세요)', composed }, { status: 200 });

  const quote = evaluateQuote({
    category: body.category, standard: body.standard ?? 'MFDS', route: body.route ?? '경구',
    submissionTarget: body.submissionTarget, selectedItems, extraLines,
    customerConditions: body.customerConditions ?? {}, requestedAddons: body.requestedAddons ?? {},
    combinationCount: body.combinationCount,
    quantityOverrides: body.quantityOverrides, removedIds: body.removedIds,
  });
  return NextResponse.json({ quote, composed });
}
