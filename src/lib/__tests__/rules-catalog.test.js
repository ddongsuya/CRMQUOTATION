/**
 * Unit tests for rules-catalog loader.
 *
 * 룰 카탈로그 YAML 의 구조적 정합성 + 기본 쿼리 동작을 검증한다.
 * 데이터 SoT 는 data/rules_catalog.yaml v1.1 (33개 룰).
 *
 * Run: `node --test src/lib/__tests__/rules-catalog.test.js`
 *      또는 `npm test` (package.json scripts 에 등록됨)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');

// loader 가 TS 라 직접 import 불가 — YAML 자체를 검증 (로더 로직은 단순 wrapper)
const ROOT = path.resolve(__dirname, '..', '..', '..');
const catalogPath = path.join(ROOT, 'data', 'rules_catalog.yaml');
const questionsPath = path.join(ROOT, 'data', 'review_questions.yaml');

test('rules_catalog.yaml 파일이 존재한다', () => {
  assert.ok(fs.existsSync(catalogPath), `${catalogPath} 누락`);
});

test('rules_catalog.yaml 이 YAML 로 파싱된다', () => {
  const c = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
  assert.ok(c, 'YAML 파싱 실패');
  assert.ok(c.catalog_meta, 'catalog_meta 없음');
  assert.equal(c.catalog_meta.version, '1.1', '버전이 1.1 아님');
});

test('rules_catalog 의 총 룰 수 = 33', () => {
  const c = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
  const sections = [
    'pricing_formulas', 'pricing_formulas_v1_1_audit',
    'prerequisite_rules', 'prerequisite_rules_v1_1_audit',
    'conditional_groups', 'conditional_groups_v1_1_audit',
    'addons', 'addons_v1_1_audit',
    'waiver_rules', 'substitution_rules', 'generic_rules',
  ];
  let total = 0;
  for (const s of sections) total += (c[s] || []).length;
  assert.equal(total, 33, `룰 총합 33 != ${total}`);
});

test('모든 룰에 필수 메타데이터 (id/description_ko/status/confidence/source_quote/source_location) 가 있다', () => {
  const c = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
  const sections = [
    'pricing_formulas', 'pricing_formulas_v1_1_audit',
    'prerequisite_rules', 'prerequisite_rules_v1_1_audit',
    'conditional_groups', 'conditional_groups_v1_1_audit',
    'addons', 'addons_v1_1_audit',
    'waiver_rules', 'substitution_rules', 'generic_rules',
  ];
  for (const s of sections) {
    for (const rule of (c[s] || [])) {
      assert.ok(rule.id, `${s}: id 누락`);
      assert.ok(rule.description_ko, `${rule.id}: description_ko 누락`);
      assert.ok(rule.status, `${rule.id}: status 누락`);
      assert.ok(['draft', 'draft_audit', 'approved', 'deprecated'].includes(rule.status), `${rule.id}: status 값 이상`);
      assert.ok(rule.confidence, `${rule.id}: confidence 누락`);
      assert.ok(['high', 'medium', 'low'].includes(rule.confidence), `${rule.id}: confidence 값 이상`);
      assert.ok(rule.source_quote, `${rule.id}: source_quote 누락`);
      assert.ok(rule.source_location, `${rule.id}: source_location 누락`);
    }
  }
});

test('룰 ID 가 고유하다', () => {
  const c = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
  const sections = [
    'pricing_formulas', 'pricing_formulas_v1_1_audit',
    'prerequisite_rules', 'prerequisite_rules_v1_1_audit',
    'conditional_groups', 'conditional_groups_v1_1_audit',
    'addons', 'addons_v1_1_audit',
    'waiver_rules', 'substitution_rules', 'generic_rules',
  ];
  const ids = new Set();
  for (const s of sections) {
    for (const rule of (c[s] || [])) {
      assert.ok(!ids.has(rule.id), `${rule.id}: 중복 ID`);
      ids.add(rule.id);
    }
  }
  assert.equal(ids.size, 33);
});

test('review_questions.yaml 이 22개 질문을 가진다', () => {
  const r = yaml.load(fs.readFileSync(questionsPath, 'utf8'));
  assert.ok(Array.isArray(r.review_questions), 'review_questions 배열 아님');
  assert.equal(r.review_questions.length, 22, `질문 22 != ${r.review_questions.length}`);
  assert.equal(r.metadata.total_questions, 22);
});

test('review_questions priority 분포가 메타데이터와 일치', () => {
  const r = yaml.load(fs.readFileSync(questionsPath, 'utf8'));
  const by_priority = {};
  for (const q of r.review_questions) {
    by_priority[q.priority] = (by_priority[q.priority] || 0) + 1;
  }
  assert.equal(by_priority['필수 (P0)'], r.metadata.by_priority.P0_critical);
  assert.equal(by_priority['중요 (P1)'], r.metadata.by_priority.P1_important);
  assert.equal(by_priority['보통 (P2)'], r.metadata.by_priority.P2_normal);
});

test('모든 review_question 에 question_summary / domain_context / questions_for_reviewer 가 있다', () => {
  const r = yaml.load(fs.readFileSync(questionsPath, 'utf8'));
  for (const q of r.review_questions) {
    assert.ok(q.id, `질문 ID 누락`);
    assert.ok(q.question_summary, `${q.id}: question_summary 누락`);
    assert.ok(q.domain_context, `${q.id}: domain_context 누락`);
    assert.ok(Array.isArray(q.questions_for_reviewer) && q.questions_for_reviewer.length > 0, `${q.id}: questions_for_reviewer 누락`);
    assert.ok(q.priority, `${q.id}: priority 누락`);
    assert.ok(q.impact_if_undefined, `${q.id}: impact_if_undefined 누락`);
  }
});

test('v1.1 audit 섹션의 모든 룰은 status="draft_audit"', () => {
  const c = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
  const auditSections = [
    'pricing_formulas_v1_1_audit', 'prerequisite_rules_v1_1_audit',
    'conditional_groups_v1_1_audit', 'addons_v1_1_audit',
  ];
  for (const s of auditSections) {
    for (const rule of (c[s] || [])) {
      assert.equal(rule.status, 'draft_audit', `${rule.id} (${s}): status 가 draft_audit 아님`);
    }
  }
  // GR (generic_rules) 도 v1.1 신규 — status draft_audit
  for (const rule of (c.generic_rules || [])) {
    assert.equal(rule.status, 'draft_audit', `${rule.id} (generic_rules): status 가 draft_audit 아님`);
  }
});

test('v1.0 섹션 (boundary check) 의 모든 룰은 status="draft"', () => {
  const c = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
  const v1Sections = [
    'pricing_formulas', 'prerequisite_rules', 'conditional_groups',
    'addons', 'waiver_rules', 'substitution_rules',
  ];
  for (const s of v1Sections) {
    for (const rule of (c[s] || [])) {
      assert.equal(rule.status, 'draft', `${rule.id} (${s}): status 가 draft 아님`);
    }
  }
});
