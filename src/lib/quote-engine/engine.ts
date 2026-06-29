/**
 * 견적 규칙 엔진 v2 — 8단계 파이프라인 (POC 구조 유지).
 *  filter → select → WV(면제) → SB(대체) → CG(조건부군) → PR(선행·문서)
 *         → AD(추가옵션) → PF(가격공식·외삽) → GR(메타) → 합계 + missing_info
 *
 * 현재: select·가격·GR·missing_info 구현. WV~PF 규칙 스테이지는 후속 커밋에서 채움.
 * 설계: docs/quote-engine-binding.md
 */
import type { QuoteInput, Quote, LineItem, MissingInfo } from './types';
import { getItem } from './master';
import { resolvePrice } from './pricing';

export function evaluateQuote(input: QuoteInput): Quote {
  const ruleLog: { step: string; msg: string }[] = [];
  const missingInfo: MissingInfo[] = [];
  const lineItems: LineItem[] = [];

  // ── select: 선택 항목 확정 + 가격 ──
  for (const sel of input.selectedItems) {
    const item = getItem(sel.id);
    if (!item) {
      missingInfo.push({ id: sel.id, level: 'blocker', message: `항목 없음: ${sel.id}` });
      ruleLog.push({ step: 'select', msg: `✖ 항목 없음 ${sel.id}` });
      continue;
    }
    const qty = sel.quantity ?? 1;
    const pr = resolvePrice(item, input.route, input.standard);
    const li: LineItem = {
      id: item.id,
      testName: item.testName ?? '(이름 없음)',
      route: input.route,            // 사용자가 고른 경로 그대로 표시 (폴백해도 라벨 유지)
      unitPrice: pr.ok ? pr.price : null,
      quantity: qty,
      amount: pr.ok ? pr.price * qty : null,
      appliedRules: [],
      notes: [],
    };
    if (pr.ok) {
      if (pr.fallbackGroup) li.notes.push('단일가(경로 무관) 적용');
      ruleLog.push({ step: 'select', msg: `✓ ${li.testName} (${pr.price.toLocaleString()})` });
    } else {
      missingInfo.push({ id: item.id, level: pr.level, message: `${li.testName}: ${pr.reason}` });
      ruleLog.push({ step: 'price', msg: `⚠ ${li.testName}: ${pr.reason}` });
    }
    lineItems.push(li);
  }

  // ── WV → SB → CG → PR → AD → PF : 규칙 스테이지 (후속 구현) ──
  // applyWaivers / applySubstitutions / applyConditionalGroups / applyPrerequisites
  // / applyAddons / applyPricingFormulas — TODO

  // ── GR: 메타룰 (generic_rules: 60일 유효·VAT 별도·시험기간 정의) ──
  const metaNotes = [
    '* 본 견적서는 견적일로부터 60일간 유효합니다.',
    '* 모든 가격은 (VAT 별도)',
    '* 시험기간 정의: 동물입고일부터 최종보고서(안) 제출일까지',
  ];
  ruleLog.push({ step: 'GR', msg: 'GR-001~003 메타룰 적용' });

  // ── 합계 ──
  const subtotalKrw = lineItems.reduce((s, li) => s + (li.amount ?? 0), 0);

  return { input, lineItems, totals: { subtotalKrw }, missingInfo, metaNotes, ruleLog };
}
