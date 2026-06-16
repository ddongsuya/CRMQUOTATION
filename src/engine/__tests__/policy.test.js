/**
 * Policy 함수 단위 테스트.
 * rules_catalog.yaml v1.1 의 단가·공식 명시 룰 4개 (PF-001, AD-001, AD-003, AD-010) 검증.
 *
 * Run: `node --test src/engine/__tests__/policy.test.js`
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    pricePF001NonRodentBleedingOnly,
    addonAD001GenotoxRecheck,
    addonAD003CosmeticPositiveRecheck,
    addonAD010SendRawDataReview,
    POLICY_REGISTRY,
    applicablePolicies,
} = require('../policy');

// ─── PF-001 ─────────────────────────────────────────────────────────────
test('[PF-001] 252 pt → 252 × 30,000 + 5,000,000 = 12,560,000', () => {
    const r = pricePF001NonRodentBleedingOnly(252);
    assert.equal(r.ok, true);
    assert.equal(r.value, 12_560_000);
    assert.equal(r.ruleId, 'PF-001');
});

test('[PF-001] 324 pt → 324 × 30,000 + 5,000,000 = 14,720,000', () => {
    const r = pricePF001NonRodentBleedingOnly(324);
    assert.equal(r.value, 14_720_000);
});

test('[PF-001] 0 pt → base 5,000,000 만', () => {
    const r = pricePF001NonRodentBleedingOnly(0);
    assert.equal(r.value, 5_000_000);
});

test('[PF-001] 잘못된 입력 → ok=false', () => {
    for (const bad of [-1, 1.5, NaN, Infinity, 'abc', null, undefined]) {
        const r = pricePF001NonRodentBleedingOnly(bad);
        assert.equal(r.ok, false, `${bad} should fail`);
        assert.ok(r.reason);
    }
});

// ─── AD-001 / AD-003 ────────────────────────────────────────────────────
test('[AD-001] 유전독성 재현시험 = 2,000,000원 (고정)', () => {
    const r = addonAD001GenotoxRecheck();
    assert.equal(r.ok, true);
    assert.equal(r.value, 2_000_000);
    assert.equal(r.ruleId, 'AD-001');
});

test('[AD-003] 화장품 양성판정 재현 = 2,000,000원 (고정, AD-001 과 동가)', () => {
    const r = addonAD003CosmeticPositiveRecheck();
    assert.equal(r.value, 2_000_000);
    assert.equal(r.ruleId, 'AD-003');
});

// ─── AD-010 ────────────────────────────────────────────────────────────
test('[AD-010] 단회 → 1,000,000원', () => {
    const r = addonAD010SendRawDataReview('single');
    assert.equal(r.value, 1_000_000);
});

test('[AD-010] 반복 → 2,000,000원', () => {
    const r = addonAD010SendRawDataReview('repeat');
    assert.equal(r.value, 2_000_000);
});

test('[AD-010] 잘못된 testType → ok=false', () => {
    const r = addonAD010SendRawDataReview('bogus');
    assert.equal(r.ok, false);
});

// ─── POLICY_REGISTRY · applicablePolicies ───────────────────────────────
test('[REGISTRY] PF-001 매처 — 비설치류 + TK + 채혈만', () => {
    const def = POLICY_REGISTRY['PF-001'];
    assert.equal(def.appliesTo({ testName: '비설치류 13주 TK 6pt(채혈만)' }), true);
    assert.equal(def.appliesTo({ testName: '설치류 13주 TK 6pt(채혈만)' }), false, '설치류는 X');
    assert.equal(def.appliesTo({ testName: '비설치류 13주 반복투여' }), false, 'TK 아님');
    assert.equal(def.appliesTo({ testName: '비설치류 TK 6pt(채혈+분석)' }), false, '분석 포함은 X');
});

test('[REGISTRY] AD-001/AD-003 매처 — 복귀돌연변이', () => {
    const items = [
        { testName: '유전독성 복귀돌연변이 시험' },
        { testName: '유전독성시험 : Ames' },
        { testName: '유전독성 TG471' },
    ];
    for (const it of items) {
        assert.equal(POLICY_REGISTRY['AD-001'].appliesTo(it), true, `${it.testName} should match AD-001`);
        assert.equal(POLICY_REGISTRY['AD-003'].appliesTo(it), true, `${it.testName} should match AD-003`);
    }
    assert.equal(POLICY_REGISTRY['AD-001'].appliesTo({ testName: '설치류 단회 투여 독성' }), false);
});

test('[REGISTRY] AD-010 매처 — SEND', () => {
    assert.equal(POLICY_REGISTRY['AD-010'].appliesTo({ testName: '설치류 13주 반복 독성시험 SEND' }), true);
    assert.equal(POLICY_REGISTRY['AD-010'].appliesTo({ testName: '설치류 13주 반복투여 독성' }), false);
});

test('[REGISTRY] applicablePolicies — 1건에 여러 룰 동시 적용 가능', () => {
    // 유전독성 복귀돌연변이는 AD-001, AD-003 둘 다 매칭
    const r = applicablePolicies({ testName: '유전독성 복귀돌연변이' });
    assert.deepEqual(r.sort(), ['AD-001', 'AD-003']);
});

test('[REGISTRY] applicablePolicies — 매칭 0건', () => {
    assert.deepEqual(applicablePolicies({ testName: '설치류 단회 투여 독성' }), []);
    assert.deepEqual(applicablePolicies(null), []);
});

test('[REGISTRY] PF-001 compute 통합 — UI 입력 시뮬레이션', () => {
    const def = POLICY_REGISTRY['PF-001'];
    const result = def.compute({ bleedingPoints: '252' });   // 문자열 입력도 처리
    assert.equal(result.ok, true);
    assert.equal(result.value, 12_560_000);
});
