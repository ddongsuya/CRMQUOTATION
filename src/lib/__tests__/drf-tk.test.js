/**
 * PF-004 DRF 약식 TK 산출 — 발행 견적서 26-07-DL-0122-4 대조 골든값.
 *   비설치류 2주 DRF TK (6pt·2회·대조1+시험4)  = 18,480,000  (견적서와 동일)
 *   설치류   2주 DRF TK (6pt·2회·대조1+시험4)  = 48,620,000  (견적서 64,960,000 은 동물비 오타 상태 — 정상값)
 * 파라미터는 rules_catalog.yaml PF-004 에서 읽는다 (코드 상수 없음).
 * Node 24 타입 스트리핑으로 .ts 직접 require.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');
const { computeDrfTk, assertDrfTkParams, drfWeeksFor } = require('../quote-engine/drf-tk.ts');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const catalog = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'rules_catalog.yaml'), 'utf8'));
const rule = catalog.pricing_formulas.find((r) => r.id === 'PF-004');
const P = assertDrfTkParams(rule.parameters);
const plan = { enabled: true, groupMode: 'ALL', points: 6, sessions: 2, include: {} };

test('PF-004 룰이 카탈로그에 있고 파라미터가 완전하다', () => {
  assert.ok(rule, 'PF-004 없음');
  assert.equal(P.margin, 0.1);
  assert.equal(P.rodent.animal_unit, 25000);
  assert.equal(P.non_rodent.charge_animals, false);
});

test('비설치류 2주 DRF TK = 18,480,000 (견적서 10번 항목 재현)', () => {
  const r = computeDrfTk('nonRodent', 2, plan, P);
  assert.equal(r.perGroup, 2);
  assert.equal(r.samples, 108);                 // (6×2×4 + 3×2×1) × 2회
  assert.equal(r.subtotal, 16_800_000);         // 채혈 3.24M + 분석 7.56M + QC 5M + 보고서 1M
  assert.equal(r.total, 18_480_000);
  assert.equal(r.components.find((c) => c.key === 'animals').charged, false);
  assert.equal(r.components.find((c) => c.key === 'housing').charged, false);
});

test('설치류 2주 DRF TK = 48,620,000 (동물비 오타 정정 후 정상값)', () => {
  const r = computeDrfTk('rodent', 2, plan, P);
  assert.equal(r.perGroup, 12);
  assert.equal(r.bledPerPoint, 6);              // 교차채혈: 암수 3+3
  assert.equal(r.animalsSpare, 66);             // 60 × 1.1
  assert.equal(r.housingDays, 21);              // 2주 + 순화 1주
  assert.equal(r.samples, 324);                 // (6×6×4 + 3×6×1) × 2회
  assert.equal(r.subtotal, 44_208_000);
  assert.equal(r.total, 48_620_000);            // 48,628,800 → 만 원 절사
});

test('군 축소(대조군+최고용량군)·3회 채혈·항목 미과금이 산식에 반영된다', () => {
  const r = computeDrfTk('rodent', 2, { ...plan, groupMode: 'CONTROL_HIGH', sessions: 3, include: { qc: false } }, P);
  assert.equal(r.testGroups, 1);
  assert.equal(r.samples, (6 * 6 * 1 + 3 * 6) * 3);
  assert.equal(r.components.find((c) => c.key === 'qc').amount, 0);
  assert.deepEqual(r.sessionLabels, ['1일차', '4주차', '마지막일']);
});

test('DRF 주차: 13주 이상 본시험은 4주 DRF, 그 외 2주', () => {
  assert.deepEqual(drfWeeksFor(['SINGLE', 'W4']), [2]);
  assert.deepEqual(drfWeeksFor(['W13']), [4]);
  assert.deepEqual(drfWeeksFor(['W4', 'W26']), [2, 4]);
});
