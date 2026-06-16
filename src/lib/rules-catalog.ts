/**
 * Rules Catalog — file-backed loader.
 *
 * data/rules_catalog.yaml (v1.1) 의 33개 룰 + data/review_questions.yaml 의
 * 22개 검토용 메타 질문을 메모리 캐시 + 타입드 인터페이스로 제공.
 *
 * 사용처:
 *   - 향후 suggest.ts/assemble.js 의 인라인 룰을 점진적으로 카탈로그 기반으로
 *     외부화할 때 진실의 원천(SoT) 역할.
 *   - /api/rules 엔드포인트 (룰 명세·원본 문구 조회).
 *   - regression test 가 룰 ID 별 source_quote / applies_to_sheets 등을 활용.
 *
 * 데이터 SoT 는 `data/test_items.json` (extract_mapping.js 로 추출) — 본 모듈은
 * 그 데이터에 적용되는 *룰* 만 다룸. TestItem 자체는 lib/data.ts 참고.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// ─────────────────────────────────────────────────────────────────────────
// Types — rules_catalog.yaml v1.1 구조
// ─────────────────────────────────────────────────────────────────────────

export type RuleStatus = 'draft' | 'draft_audit' | 'approved' | 'deprecated';
export type RuleConfidence = 'high' | 'medium' | 'low';

interface RuleMetaBase {
  id: string;
  description_ko: string;
  version: string;
  status: RuleStatus;
  confidence: RuleConfidence;
  extracted_at: string;
  effective_date: string | null;
  needs_review_by: string[];
  review_notes: string | null;
  source_quote: string;
  source_location: string;
  applies_to_sheets?: string[];
  approved_by?: string | null;
  approved_at?: string | null;
  deprecated_at?: string | null;
  deprecation_reason?: string | null;
}

export interface PricingFormulaRule extends RuleMetaBase {
  formula: string;                        // 실행 가능한 식
  formula_human: string;                  // 사람이 읽을 수식
  variables: Array<{
    name: string;
    type: string;
    source: string;
    description_ko?: string;
  }>;
  applies_to: Record<string, unknown>;
  observed_data_points?: Array<Record<string, unknown>>;
}

export interface PrerequisiteRule extends RuleMetaBase {
  trigger: Record<string, unknown>;
  prerequisites: Array<{
    test_name_pattern?: string;
    species_filter?: string;
    mandatory?: boolean;
    suggestion_only?: boolean;
    rationale_ko?: string;
    prerequisite_type?: 'lead_time' | 'customer_data' | 'customer_document' | 'substance_inspection';
    lead_time_weeks?: number;
    lead_time_weeks_min?: number;
    lead_time_weeks_max?: number;
    required_data_ko?: string;
    document_ko?: string;
    document_key?: string;
    inspection_ko?: string;
    on_failure_ko?: string;
    condition_ko?: string;
  }>;
  effect_ko?: string | null;
  deliverable_format_ko?: string | null;
}

export interface ConditionalGroupRule extends RuleMetaBase {
  applies_to: Record<string, unknown>;
  default_groups: Record<string, number> | null;
  conditional_groups?: Array<{
    condition_ko: string;
    condition_key: string;
    groups?: Record<string, number>;
    groups_addition?: Record<string, number>;
    observation_groups?: Record<string, unknown>;
    price_adjustment_required?: boolean;
    adjustment_note_ko?: string;
  }>;
  selection_criterion_ko?: string;
  selection_criterion_key?: string;
  branches?: Array<{
    condition_ko: string;
    condition_key: string;
    select_test_no?: number;
    select_test_name?: string;
    observation_period_ko?: string;
    price_krw?: number;
  }>;
}

export interface AddonRule extends RuleMetaBase {
  applies_to: Record<string, unknown>;
  addon_name_ko: string;
  addon_name: string;
  price_krw: number | null;
  price_note_ko?: string | null;
  price_krw_table?: Array<{
    test_type_ko: string;
    test_type_key: string;
    price_krw: number;
  }>;
  optional: boolean;
  trigger_ko: string;
  trigger_key?: string;
  trigger_keys?: string[];
  duration_weeks_addition?: number;
  requires_negotiation?: boolean;
}

export interface WaiverRule extends RuleMetaBase {
  applies_to: Record<string, unknown>;
  waiver_condition_ko: string;
  waiver_condition_key: string;
  requires_evidence_ko?: string | null;
  effect: 'skip_test' | 'reduce_scope' | 'defer_to_evidence';
}

export interface SubstitutionRule extends RuleMetaBase {
  trigger: Record<string, unknown>;
  substitution: Record<string, unknown>;
  required_companions?: Array<{
    test_name_contains: string;
    rationale_ko?: string;
  }>;
  requires_customer_confirmation?: boolean;
}

export interface GenericRule extends RuleMetaBase {
  rule_type: string;                      // quote_validity | price_display | duration_definition
  parameters: Record<string, unknown>;
  applies_to: Record<string, unknown>;
}

export interface RulesCatalog {
  catalog_meta: {
    version: string;
    status: string;
    extracted_at: string;
    augmented_at?: string;
    source_files: number;
    source_records_scanned: number;
    candidates_audited?: number;
    total_rules_extracted: number;
    rules_v1_0?: number;
    rules_v1_1_audit?: number;
    total_candidates_excluded: number;
    needs_review_by: string[];
    audit_coverage_summary?: Record<string, number>;
  };
  pricing_formulas: PricingFormulaRule[];
  pricing_formulas_v1_1_audit?: PricingFormulaRule[];
  prerequisite_rules: PrerequisiteRule[];
  prerequisite_rules_v1_1_audit?: PrerequisiteRule[];
  conditional_groups: ConditionalGroupRule[];
  conditional_groups_v1_1_audit?: ConditionalGroupRule[];
  addons: AddonRule[];
  addons_v1_1_audit?: AddonRule[];
  waiver_rules: WaiverRule[];
  substitution_rules: SubstitutionRule[];
  generic_rules?: GenericRule[];
}

// ─── review_questions.yaml ──────────────────────────────────────────────

export type QuestionPriority = '필수 (P0)' | '중요 (P1)' | '보통 (P2)';

export interface ReviewQuestion {
  id: string;
  related_rule_id_proposal: string;
  priority: QuestionPriority;
  question_summary: string;
  domain_context: string;
  questions_for_reviewer: string[];
  suggested_rule_format: string;
  impact_if_undefined: string;
  related_existing_rules?: string[];
  answer_summary?: string | null;
  answer_detail?: string | null;
  answered_by?: string | null;
  answered_at?: string | null;
}

export interface ReviewQuestions {
  review_questions: ReviewQuestion[];
  metadata: {
    version: string;
    created_at: string;
    total_questions: number;
    by_priority: {
      P0_critical: number;
      P1_important: number;
      P2_normal: number;
    };
    needs_review_by: string[];
  };
}

// ─── 통합 룰 객체 (모든 타입 합쳐서 평탄화) ─────────────────────────────

export type AnyRule =
  | (PricingFormulaRule & { _ruleType: 'PricingFormula' })
  | (PrerequisiteRule & { _ruleType: 'PrerequisiteRule' })
  | (ConditionalGroupRule & { _ruleType: 'ConditionalGroup' })
  | (AddonRule & { _ruleType: 'Addon' })
  | (WaiverRule & { _ruleType: 'Waiver' })
  | (SubstitutionRule & { _ruleType: 'Substitution' })
  | (GenericRule & { _ruleType: 'Generic' });

// ─────────────────────────────────────────────────────────────────────────
// Loader (캐시)
// ─────────────────────────────────────────────────────────────────────────

let _catalog: RulesCatalog | null = null;
let _questions: ReviewQuestions | null = null;

function dataDir(): string {
  return path.resolve(process.cwd(), 'data');
}

export function loadRulesCatalog(): RulesCatalog {
  if (_catalog) return _catalog;
  const raw = fs.readFileSync(path.join(dataDir(), 'rules_catalog.yaml'), 'utf8');
  _catalog = yaml.load(raw) as RulesCatalog;
  return _catalog;
}

export function loadReviewQuestions(): ReviewQuestions {
  if (_questions) return _questions;
  const raw = fs.readFileSync(path.join(dataDir(), 'review_questions.yaml'), 'utf8');
  _questions = yaml.load(raw) as ReviewQuestions;
  return _questions;
}

/** v1.0 + v1.1 audit 섹션을 합쳐 단일 평탄화된 룰 리스트로 반환 */
export function flattenAllRules(): AnyRule[] {
  const c = loadRulesCatalog();
  const out: AnyRule[] = [];
  for (const r of c.pricing_formulas || []) out.push({ ...r, _ruleType: 'PricingFormula' });
  for (const r of c.pricing_formulas_v1_1_audit || []) out.push({ ...r, _ruleType: 'PricingFormula' });
  for (const r of c.prerequisite_rules || []) out.push({ ...r, _ruleType: 'PrerequisiteRule' });
  for (const r of c.prerequisite_rules_v1_1_audit || []) out.push({ ...r, _ruleType: 'PrerequisiteRule' });
  for (const r of c.conditional_groups || []) out.push({ ...r, _ruleType: 'ConditionalGroup' });
  for (const r of c.conditional_groups_v1_1_audit || []) out.push({ ...r, _ruleType: 'ConditionalGroup' });
  for (const r of c.addons || []) out.push({ ...r, _ruleType: 'Addon' });
  for (const r of c.addons_v1_1_audit || []) out.push({ ...r, _ruleType: 'Addon' });
  for (const r of c.waiver_rules || []) out.push({ ...r, _ruleType: 'Waiver' });
  for (const r of c.substitution_rules || []) out.push({ ...r, _ruleType: 'Substitution' });
  for (const r of c.generic_rules || []) out.push({ ...r, _ruleType: 'Generic' });
  return out;
}

/** 룰 ID 로 특정 룰 조회 */
export function findRuleById(id: string): AnyRule | undefined {
  return flattenAllRules().find(r => r.id === id);
}

/** 룰 타입별 카운트 */
export function getRulesSummary(): {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_confidence: Record<string, number>;
} {
  const all = flattenAllRules();
  const by_type: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  const by_confidence: Record<string, number> = {};
  for (const r of all) {
    by_type[r._ruleType] = (by_type[r._ruleType] || 0) + 1;
    by_status[r.status] = (by_status[r.status] || 0) + 1;
    by_confidence[r.confidence] = (by_confidence[r.confidence] || 0) + 1;
  }
  return { total: all.length, by_type, by_status, by_confidence };
}

/** 우선순위별로 필터링된 review_questions */
export function getReviewQuestionsByPriority(priority?: QuestionPriority): ReviewQuestion[] {
  const all = loadReviewQuestions().review_questions;
  if (!priority) return all;
  return all.filter(q => q.priority === priority);
}

/** 답변되지 않은 review_questions (answer_summary === null) */
export function getUnansweredQuestions(): ReviewQuestion[] {
  return loadReviewQuestions().review_questions.filter(q => !q.answer_summary);
}

/** 테스트/개발용: 캐시 무효화 */
export function _resetRulesCache(): void {
  _catalog = null;
  _questions = null;
}
