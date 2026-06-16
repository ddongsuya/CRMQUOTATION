import { NextResponse } from 'next/server';
import { getItemByKey } from '@/lib/data';
import { matchGuidelineCodes } from '@/lib/knowledge';
// Engine is JS + JSDoc; allowJs in tsconfig picks it up.
import { assembleQuoteLines } from '@/engine/assemble';
import { computeTotals } from '@/engine/pricing';

// price for the synthetic 함량분석 aggregate line — policy value, tweak here
const PRICE_ANALYSIS_UNIT = 1_000_000;

export async function POST(req: Request) {
  const body = await req.json() as {
    selections: Array<{
      key: string;
      quantity: number;
      // Phase C-1: 사용자 직접 입력 (override). null = 자동값 사용. 0 = 명시 값.
      unitPriceOverride?: number | null;
      studyWeeksOverride?: number | null;
      hamryangCountOverride?: number | null;
      customNote?: string | null;
    }>;
    excipientCount: number;
    priceStandard: 'MFDS' | 'OECD';
    discountRate: number;
    currency: 'KRW' | 'USD';
    exchangeRate: number;
  };

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

  const { lines, warnings } = assembleQuoteLines(hydrated, {
    excipientCount: body.excipientCount,
    priceStandard: body.priceStandard,
    priceAnalysisUnit: PRICE_ANALYSIS_UNIT,
  }) as { lines: Array<{ subtotal: number; [k: string]: unknown }>; warnings: string[] };

  // 각 test 라인에 근거 가이드라인 코드 부착 (지식베이스 연결 — 가이드라인이 견적에 붙음)
  for (const l of lines) {
    if (l.kind === 'test' && typeof l.testName === 'string') {
      const codes = matchGuidelineCodes(l.testName);
      if (codes.length) l.guidelineCodes = codes;
    }
  }

  const totals = computeTotals(
    lines,
    body.discountRate,
    body.currency,
    body.currency === 'USD' ? body.exchangeRate : undefined,
  );

  return NextResponse.json({ lines, warnings, totals });
}
