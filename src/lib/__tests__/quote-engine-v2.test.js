/**
 * 견적 엔진 v2(TS) 정합성 회귀 — 실제 마스터(data/master_items.v2.json) 기준.
 *
 *  E3: 함량분석·조제물분석(R2/R8)은 step4 편집(삭제·수량·수동추가) 반영 후의 최종 라인으로 산출돼야 한다.
 *      예전엔 자동 구성 직후 값으로 고정돼, 유전독성을 지워도 조제물분석-유전독성 1,000만이 남았다.
 *  E1: 가격 미정(unitPrice=null) 라인은 findUnpricedLines 가 잡아 저장 API 가 거절한다(₩0 발행 방지).
 *
 * engine.ts 는 확장자 없는 상대 import 를 써서 node 타입 스트리핑으로는 못 읽는다 →
 * 이미 설치돼 있는 jiti(tailwindcss 의존성, package-lock 고정)로 TS 를 그대로 로드한다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
// master.ts 가 process.cwd()/data 를 읽는다 — 어디서 실행하든 저장소 루트 기준으로 맞춘다.
process.chdir(ROOT);
const jiti = require('jiti')(__filename);
const { evaluateQuote } = jiti(path.join(ROOT, 'src/lib/quote-engine/engine.ts'));
const { composeFromPlan, composeDrfTkLines } = jiti(path.join(ROOT, 'src/lib/quote-engine/compose.ts'));
const { composeAnalysisLines } = jiti(path.join(ROOT, 'src/lib/quote-engine/analysis.ts'));
const { getItem } = jiti(path.join(ROOT, 'src/lib/quote-engine/master.ts'));
const { findUnpricedLines, unpricedErrorMessage } = jiti(path.join(ROOT, 'src/lib/quote-engine/unpriced.ts'));

const ALL_ADDONS = { drf: true, recovery: true, tk: true, genotox: true, safetyPharm: true };

/** 라우트(/api/quote-v2, /save)와 같은 방식으로 plan → evaluateQuote 입력을 만든다. */
function evalPlan(planIn, edits = {}) {
  const plan = { excipientCount: 1, ...planIn };
  const composed = composeFromPlan(plan);
  return evaluateQuote({
    category: plan.modality, standard: plan.standard, route: plan.route,
    selectedItems: composed.map(c => ({ id: c.id })),
    extraLines: composeDrfTkLines(plan),
    analysisPlan: { modality: plan.modality, route: plan.route, excipientCount: plan.excipientCount },
    ...edits,
  });
}
const line = (q, id) => q.lineItems.find(l => l.id === id);
const hamCount = q => { const l = line(q, '_hamryang'); return l ? Number(/\((\d+)회/.exec(l.testName)[1]) : 0; };

const DRUG_13W = {
  modality: '의약품', standard: 'MFDS', route: '경구', durations: ['SINGLE', 'W13'],
  species: { rodent: true, nonRodent: true }, addons: ALL_ADDONS,
};

// ── E3 ────────────────────────────────────────────────────────────────

test('E3 기준선: 의약품 단회+13주 풀패키지 — 함량 18회, 조제물 3그룹, 합계 982,100,000 (변경 전과 동일)', () => {
  const q = evalPlan(DRUG_13W);
  assert.equal(hamCount(q), 18);
  assert.equal(line(q, '_hamryang').amount, 18_000_000);
  assert.ok(line(q, '_prep_in_vivo') && line(q, '_prep_genotox') && line(q, '_prep_safety_pharm'));
  assert.equal(q.totals.subtotalKrw, 982_100_000);
});

test('E3 유전독성 3종 삭제 → 조제물분석-유전독성 제거 + 함량분석 3회 감소', () => {
  const q = evalPlan(DRUG_13W, { removedIds: ['med-28', 'med-29', 'med-30'] });
  assert.equal(line(q, '_prep_genotox'), undefined, '삭제한 유전독성의 조제물분석이 남으면 안 된다');
  assert.ok(line(q, '_prep_in_vivo') && line(q, '_prep_safety_pharm'));
  assert.equal(hamCount(q), 15);
  // 982.1M − 유전독성 39.5M − 조제물 10M − 함량 3M
  assert.equal(q.totals.subtotalKrw, 982_100_000 - 39_500_000 - 10_000_000 - 3_000_000);
});

test('E3 13주 본시험 수량 2 → 함량분석 회수 × 수량 반영 (assemble.js R3 와 동일 의미)', () => {
  const q = evalPlan(DRUG_13W, { quantityOverrides: { 'med-75': 2 } });
  assert.equal(line(q, 'med-75').quantity, 2);
  assert.equal(hamCount(q), 20);   // 13주 = 2회 → ×2 로 +2
  // 조제물분석은 그룹별 1회 — 수량과 무관
  assert.equal(line(q, '_prep_in_vivo').amount, 10_000_000);
});

test('E3 수동 추가 항목도 분석 산출에 포함된다 (유전독성 미선택 + Ames 수동 추가 → 조제물-유전독성 생성)', () => {
  const plan = { ...DRUG_13W, addons: { ...ALL_ADDONS, genotox: false } };
  const before = evalPlan(plan);
  assert.equal(line(before, '_prep_genotox'), undefined);
  const after = evalPlan(plan, { extraItemIds: ['med-30'] });
  assert.ok(line(after, '_prep_genotox'));
  assert.equal(hamCount(after), hamCount(before) + 1);
});

test('E3 분석 라인 자체의 삭제·단가 조정은 계속 동작한다', () => {
  const removed = evalPlan(DRUG_13W, { removedIds: ['_hamryang'] });
  assert.equal(line(removed, '_hamryang'), undefined);
  const ov = evalPlan(DRUG_13W, { unitPriceOverrides: { _prep_genotox: 5_000_000 } });
  assert.equal(line(ov, '_prep_genotox').amount, 5_000_000);
});

test('E3 composeAnalysisLines 순수 함수: 복합제 제외 · 명시 분석항목 있으면 skip · 부형제 곱', () => {
  const it75 = getItem('med-75');
  assert.deepEqual(composeAnalysisLines({ modality: '복합제', route: '경구' }, [{ item: it75, quantity: 1 }]), []);
  const two = composeAnalysisLines({ modality: '의약품', route: '경구', excipientCount: 2 }, [{ item: it75, quantity: 1 }]);
  assert.equal(two.find(l => l.id === '_hamryang').amount, 2 * 1_000_000 * 2);
  assert.equal(two.find(l => l.id === '_prep_in_vivo').amount, 20_000_000);
});

test('E3 룰 자동 추가 동반 라인(SB-001 카테터 → 조제물 분석 med-34)은 자동 분석 산출을 없애지 않는다', () => {
  const q = evalPlan(DRUG_13W, { customerConditions: { catheter_oral_administration: true } });
  const med34 = line(q, 'med-34');
  assert.ok(med34 && med34.isPrereq, 'SB-001 동반 조제물분석이 선행 라인으로 추가돼야 한다');
  assert.equal(hamCount(q), 18);
  assert.ok(line(q, '_prep_in_vivo'));
  // med-34 는 '견적 시마다 계산' 항목이라 단가 null — 예전엔 ₩0 으로 저장됐다. 이제 E1 이 저장을 막는다.
  assert.ok(findUnpricedLines(q).some(u => u.id === 'med-34'));
});

// ── E1 ────────────────────────────────────────────────────────────────

const DRUG_OECD_26W = {
  modality: '의약품', standard: 'OECD', route: '경구', durations: ['SINGLE', 'W26'],
  species: { rodent: true, nonRodent: true }, addons: ALL_ADDONS,
};

test('E1 OECD 가격 빈칸 → unitPrice null + missing_info, MFDS 로 폴백하지 않는다', () => {
  const q = evalPlan(DRUG_OECD_26W);
  const ids = findUnpricedLines(q).map(u => u.id).sort();
  assert.deepEqual(ids, ['med-25', 'med-91']);
  for (const id of ids) {
    assert.equal(line(q, id).unitPrice, null, `${id}: MFDS 가격으로 채우면 안 된다`);
    assert.ok(q.missingInfo.some(m => m.id === id), `${id}: missing_info 필요`);
  }
  const msg = unpricedErrorMessage(findUnpricedLines(q));
  assert.match(msg, /2건/);
  assert.ok(msg.includes(line(q, 'med-91').testName));
});

test('E1 단가 직접 입력 또는 삭제하면 미정 해소 (missing_info 도 함께 사라짐)', () => {
  const ov = evalPlan(DRUG_OECD_26W, { unitPriceOverrides: { 'med-91': 300_000_000, 'med-25': 25_000_000 } });
  assert.deepEqual(findUnpricedLines(ov), []);
  assert.ok(!ov.missingInfo.some(m => m.id === 'med-91' || m.id === 'med-25'));
  const rm = evalPlan(DRUG_OECD_26W, { removedIds: ['med-91', 'med-25'] });
  assert.deepEqual(findUnpricedLines(rm), []);
  assert.ok(!rm.missingInfo.some(m => m.id === 'med-91' || m.id === 'med-25'), '삭제한 라인의 경고가 남으면 저장이 엉뚱하게 막힌다');
});

test('E1 협의 단가 미입력 옵션도 미정으로 잡는다', () => {
  const list = findUnpricedLines({
    lineItems: [{ id: 'a', testName: 'A', route: '경구', unitPrice: 100, quantity: 1, amount: 100, appliedRules: [], notes: [] }],
    addons: [{ ruleId: 'AD-009', name: '옵션X', price: 0, optional: true, priceMissing: true }],
  });
  assert.deepEqual(list.map(u => u.kind), ['addon']);
});
