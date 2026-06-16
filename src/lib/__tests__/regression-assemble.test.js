/**
 * Regression test — assemble.js + 실제 catalog 데이터.
 *
 * 견적 자동 생성 로직의 가격·라인 산출이 **의도하지 않게 변하는 것**을 잡는다.
 *
 * 메커니즘 (스냅샷):
 *   1. 시나리오별로 실제 test_items.json 에서 항목을 골라 selections 구성
 *   2. assembleQuoteLines + computeTotals 실행
 *   3. 결과를 __snapshots__/regression-<name>.json 와 비교
 *   4. 차이 발견 시 fail (의도된 변경이면 UPDATE_SNAPSHOTS=1 로 갱신)
 *
 * 시나리오 의도:
 *   - SC01: 단순 13주 본시험 1건 → 함량분석 2회 자동
 *   - SC02: 단회+4주DRF+13주본+13주TK → 1+2+2+2=7회
 *   - SC03: 회복군만 (warning 발생: 상위 본시험 없음)
 *   - SC04: TK만 (warning 발생: 동일 기간 본시험 없음)
 *   - SC05: 복합제 priceTiers — excipientCount=3 → tier "3" 가격 사용
 *   - SC06: 13주 본시험 + 회복군 + TK (정상 패키지 — warning 없음)
 *
 * 실행: `npm test` 또는 `node --test src/lib/__tests__/regression-assemble.test.js`
 * 스냅샷 갱신: `UPDATE_SNAPSHOTS=1 node --test src/lib/__tests__/regression-assemble.test.js`
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const { assembleQuoteLines } = require(path.join(ROOT, 'src', 'engine', 'assemble.js'));
const { computeTotals, computeValidUntil } = require(path.join(ROOT, 'src', 'engine', 'pricing.js'));

const SNAP_DIR = path.join(__dirname, '__snapshots__');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'test_items.json'), 'utf8'));

function byKey(key) {
  const it = items.find(i => i.key === key);
  if (!it) throw new Error(`Test item not found: ${key}`);
  return it;
}

function snapshotAssert(name, actual) {
  const file = path.join(SNAP_DIR, `${name}.json`);
  if (UPDATE || !fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(actual, null, 2));
    console.log(`    [snapshot] ${UPDATE ? 'updated' : 'created'}: ${name}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(actual, expected, `Snapshot mismatch: ${name}. UPDATE_SNAPSHOTS=1 로 갱신.`);
}

function runScenario(scenario) {
  // selections: [{ key, quantity? }] → [{ item, quantity }]
  const selections = scenario.selections.map(s => ({ item: byKey(s.key), quantity: s.quantity ?? 1 }));
  const { lines, warnings } = assembleQuoteLines(selections, {
    excipientCount: scenario.excipientCount ?? 0,
    priceStandard:  scenario.priceStandard ?? 'MFDS',
    priceAnalysisUnit: scenario.priceAnalysisUnit ?? 1_000_000,
  });
  const totals = computeTotals(lines, scenario.discountRate ?? 0, scenario.currency ?? 'KRW', scenario.exchangeRate);
  // Snapshot 가능한 형태로 정규화 (numeric IDs/Dates 등은 제외 — 가격·라인 구성만)
  return {
    scenario_id: scenario.id,
    scenario_title: scenario.title,
    options: {
      excipientCount: scenario.excipientCount ?? 0,
      priceStandard: scenario.priceStandard ?? 'MFDS',
      discountRate: scenario.discountRate ?? 0,
      currency: scenario.currency ?? 'KRW',
    },
    lines: lines.map(l => ({
      kind: l.kind,
      testItemKey: l.testItemKey ?? null,
      testName: l.testName,
      adminRoute: l.adminRoute ?? null,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      subtotal: l.subtotal,
      linkRelation: l.linkRelation ?? null,
      note: l.note ?? null,
    })),
    warnings,
    totals: {
      // 통화 변환 가능한 필드만
      totalBeforeDiscount: totals.totalBeforeDiscount,
      discountAmount:      totals.discountAmount,
      totalAfterDiscount:  totals.totalAfterDiscount,
      vatAmount:           totals.vatAmount,
      grandTotal:          totals.grandTotal,
      currency:            totals.currency,
    },
  };
}

// ─── 시나리오 정의 ────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'SC01',
    title: '13주 반복투여 1건 (베이스라인)',
    selections: [
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#19@경구__경구' },
    ],
  },
  {
    id: 'SC02',
    title: '단회 + 4주 DRF + 13주 본시험 + 13주 TK (함량분석 7회 자동)',
    selections: [
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#19@경구__경구' },  // 13주 본시험 → 2회
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#6@경구__경구' },   // 4주 DRF → 2회
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#21@경구__경구' },  // 13주 TK → 2회
    ],
  },
  {
    id: 'SC03',
    title: '회복군만 (warning: 상위 본시험 미선택)',
    selections: [
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#20@경구__경구' },  // 13주 회복
    ],
  },
  {
    id: 'SC04',
    title: 'TK만 (warning: 동일 기간 본시험 미선택)',
    selections: [
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#21@경구__경구' },  // 13주 TK
    ],
  },
  {
    id: 'SC05',
    title: '복합제 priceTiers — excipientCount=3 → tier "3" (30M)',
    selections: [
      { key: '복합제_항목_마스터_추가정규화_v2.xlsx#복합제 시험항목 마스터#2__' },  // priceTiers
    ],
    excipientCount: 3,
  },
  {
    id: 'SC06',
    title: '13주 본시험 + 회복군 + TK 정상 패키지 (warning 없음)',
    // F-2 수정 (2026-05): isParentSelected 가 normalize 후 substring 매칭으로
    // 변경되어, 회복군 parentTest("13주 반복투여독성") 와 본시험 testName
    // ("설치류 13주 반복투여 독성") 차이가 정상 매칭. warning 없음.
    selections: [
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#19@경구__경구' },  // 13주 본시험
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#20@경구__경구' },  // 13주 회복
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#21@경구__경구' },  // 13주 TK
    ],
  },
  {
    id: 'SC07',
    title: '할인 10% + USD 환산 (환율 1400)',
    selections: [
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#19@경구__경구' },
    ],
    discountRate: 0.1,
    currency: 'USD',
    exchangeRate: 1400,
  },
  {
    id: 'SC08',
    title: 'OECD 가격 (priceStandard=OECD)',
    selections: [
      { key: '독성시험_항목_마스터_추가정규화_v2.xlsx#시험항목 마스터#19@경구__경구' },
    ],
    priceStandard: 'OECD',
  },
];

// ─── 테스트 실행 ──────────────────────────────────────────────────────────

for (const sc of SCENARIOS) {
  test(`[${sc.id}] ${sc.title}`, () => {
    const result = runScenario(sc);
    snapshotAssert(`regression-${sc.id}`, result);
  });
}

// ─── 메타 테스트 ──────────────────────────────────────────────────────────

test('valid-until 산출 = 견적일 + 60일 (GR-001 룰)', () => {
  const issued = new Date('2026-05-16T00:00:00.000Z');
  const valid  = computeValidUntil(issued);
  const diffMs = valid.getTime() - issued.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  assert.equal(diffDays, 60);
});

test('[INFO] 시나리오 수 + 스냅샷 위치', () => {
  console.log(`    [INFO] 시나리오: ${SCENARIOS.length}개 / 스냅샷: ${SNAP_DIR}`);
  console.log(`    [INFO] 스냅샷 갱신: UPDATE_SNAPSHOTS=1 npm test`);
});
