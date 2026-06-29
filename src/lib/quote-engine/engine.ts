/**
 * 견적 규칙 엔진 v2 — 8단계 파이프라인.
 *  select → WV(면제) → SB(대체) → CG(조건부군) → PR(선행·문서) → AD(추가옵션) → PF(가격공식)
 *         → GR(메타) → 합계 + missing_info
 * 설계: docs/quote-engine-binding.md
 */
import type { QuoteInput, Quote, LineItem, MissingInfo } from './types';
import { getItem } from './master';
import { resolvePrice } from './pricing';
import { runRuleStages, type RuleState } from './rules';

export function evaluateQuote(input: QuoteInput): Quote {
  const s: RuleState = {
    input, lineItems: [], waivedItems: [], addons: [], prerequisitesAdded: [],
    documentRequirements: [], missingInfo: [], ruleLog: [],
  };

  // ── select: 선택 항목 확정 + 가격 ──
  for (const sel of input.selectedItems) {
    const it = getItem(sel.id);
    if (!it) {
      s.missingInfo.push({ id: sel.id, level: 'blocker', message: `항목 없음: ${sel.id}` });
      s.ruleLog.push({ step: 'select', msg: `✖ 항목 없음 ${sel.id}` });
      continue;
    }
    const qty = sel.quantity ?? 1;
    const pr = resolvePrice(it, input.route, input.standard);
    const li: LineItem = {
      id: it.id, testName: it.testName ?? '(이름 없음)', route: input.route,
      unitPrice: pr.ok ? pr.price : null, quantity: qty, amount: pr.ok ? pr.price * qty : null,
      appliedRules: [], notes: [],
    };
    if (pr.ok) {
      if (pr.fallbackGroup) li.notes.push('단일가(경로 무관) 적용');
      s.ruleLog.push({ step: 'select', msg: `✓ ${li.testName} (${pr.price.toLocaleString()})` });
    } else {
      s.missingInfo.push({ id: it.id, level: pr.level, message: `${li.testName}: ${pr.reason}` });
      s.ruleLog.push({ step: 'price', msg: `⚠ ${li.testName}: ${pr.reason}` });
    }
    s.lineItems.push(li);
  }

  // ── WV → SB → CG → PR → AD → PF ──
  runRuleStages(s);

  // ── GR: 메타룰 ──
  const metaNotes = [
    '* 본 견적서는 견적일로부터 60일간 유효합니다.',
    '* 모든 가격은 (VAT 별도)',
    '* 시험기간 정의: 동물입고일부터 최종보고서(안) 제출일까지',
  ];
  s.ruleLog.push({ step: 'GR', msg: 'GR-001~003 메타룰 적용' });

  // ── 합계 (라인 + 선행추가 + 추가옵션) ──
  const allLines = [...s.lineItems, ...s.prerequisitesAdded];
  const lineItemsKrw = allLines.reduce((sum, li) => sum + (li.amount ?? 0), 0);
  const addonsKrw = s.addons.reduce((sum, a) => sum + a.price, 0);

  return {
    input, lineItems: s.lineItems, waivedItems: s.waivedItems, addons: s.addons,
    prerequisitesAdded: s.prerequisitesAdded, documentRequirements: s.documentRequirements,
    totals: { lineItemsKrw, addonsKrw, subtotalKrw: lineItemsKrw + addonsKrw },
    missingInfo: s.missingInfo, metaNotes, ruleLog: s.ruleLog,
  };
}
