/**
 * GET /api/rules           — 전체 룰 카탈로그 + 요약
 * GET /api/rules?type=PF   — 특정 룰 타입만 (PF/PR/CG/AD/WV/SB/GR)
 * GET /api/rules?status=draft_audit
 * GET /api/rules?confidence=low
 */
import { NextResponse } from 'next/server';
import {
  loadRulesCatalog,
  flattenAllRules,
  getRulesSummary,
  type RuleStatus,
  type RuleConfidence,
} from '@/lib/rules-catalog';

const TYPE_PREFIX_MAP: Record<string, string> = {
  PF: 'PricingFormula',
  PR: 'PrerequisiteRule',
  CG: 'ConditionalGroup',
  AD: 'Addon',
  WV: 'Waiver',
  SB: 'Substitution',
  GR: 'Generic',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');         // PF/PR/CG/AD/WV/SB/GR or full type name
  const status = searchParams.get('status') as RuleStatus | null;
  const confidence = searchParams.get('confidence') as RuleConfidence | null;
  const summaryOnly = searchParams.get('summary') === '1';

  if (summaryOnly) {
    const catalog = loadRulesCatalog();
    return NextResponse.json({
      meta: catalog.catalog_meta,
      summary: getRulesSummary(),
    });
  }

  let rules = flattenAllRules();

  if (type) {
    const fullType = TYPE_PREFIX_MAP[type] || type;
    rules = rules.filter(r => r._ruleType === fullType);
  }
  if (status) rules = rules.filter(r => r.status === status);
  if (confidence) rules = rules.filter(r => r.confidence === confidence);

  return NextResponse.json({
    count: rules.length,
    rules,
  });
}
