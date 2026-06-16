/**
 * Regression test — suggest.ts API 통합 (skip-if-offline).
 *
 * suggest.ts 는 TypeScript 라 직접 require 불가. 따라서 dev server 의 API 를
 * 호출하여 시나리오별 결과를 스냅샷.
 *
 * 전제: `npm run dev` 가 별도 터미널에서 실행 중.
 * 미실행 시: 자동 skip (CI 정상 통과).
 *
 * 메커니즘:
 *   1. 시나리오 = { modality, plan, priceStandard, excipientCount? }
 *   2. POST /api/plan/suggest 호출 → hits[]
 *   3. hits 의 핵심 필드 (key/testName/unitPrice/priority/tag) 만 스냅샷
 *
 * 실행: `npm run dev` 후 별도 터미널에서 `npm test`
 * 스냅샷 갱신: `UPDATE_SNAPSHOTS=1 npm test`
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const SNAP_DIR = path.join(__dirname, '__snapshots__');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function reachable() {
  try {
    const r = await fetch(BASE + '/api/test-items?modality=합성신약', { method: 'GET' });
    return r.ok;
  } catch { return false; }
}

let _online = null;
const requireOnline = async () => {
  if (_online === null) _online = await reachable();
  if (!_online) {
    console.log(`    [skip] dev server unreachable at ${BASE}`);
    return false;
  }
  return true;
};

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

async function runSuggest(scenario) {
  const body = JSON.stringify({
    modality: scenario.modality,
    plan: scenario.plan,
    priceStandard: scenario.priceStandard || 'MFDS',
    excipientCount: scenario.excipientCount,
  });
  const r = await fetch(BASE + '/api/plan/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  if (!r.ok) throw new Error(`POST /api/plan/suggest failed: ${r.status}`);
  const data = await r.json();
  // 정규화: hits 의 핵심 필드만 + 정렬 안정성을 위해 key 로 정렬
  return {
    scenario_id: scenario.id,
    scenario_title: scenario.title,
    input: {
      modality: scenario.modality,
      priceStandard: scenario.priceStandard || 'MFDS',
      excipientCount: scenario.excipientCount ?? null,   // undefined → null (스냅샷 결정성)
      route: scenario.plan.route,
      durations: scenario.plan.durations,
      addons: scenario.plan.addons,
      categories: scenario.plan.categories,
    },
    hit_count: data.hits.length,
    notes: data.notes,
    // 가격 합계 (regression detect 용)
    total_unit_price: data.hits.reduce((s, h) => s + (h.unitPrice || 0), 0),
    // 처음 5건만 상세 (전체는 너무 길어 snapshot 깨지기 쉬움)
    sample_hits: data.hits.slice(0, 5).map(h => ({
      testName: h.testName,
      adminRoute: h.adminRoute,
      priority: h.priority,
      tag: h.tag,
      unitPrice: h.unitPrice,
    })),
  };
}

// ─── 시나리오 ────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'API01',
    title: '합성신약 IND 표준 — 13주, 양종, 모든 addon',
    modality: '합성신약',
    priceStandard: 'MFDS',
    plan: {
      route: '경구',
      durations: ['W13'],
      phase: 'IND1',
      species: { rodent: true, nonRodent: true },
      addons: { drf: true, recovery: true, tk: true, genotox: true, safetyPharm: true },
      categories: {},
      tk: { sessions: 2, points: 8, sampleOnly: false },
    },
  },
  {
    id: 'API02',
    title: '건강기능식품 — 단회 + 13주 + DRF + 회복 + 유전독성',
    modality: '건강기능식품',
    priceStandard: 'MFDS',
    plan: {
      route: '경구',
      durations: ['SINGLE', 'W13'],
      phase: 'IND1',
      species: { rodent: true, nonRodent: false },
      addons: { drf: true, recovery: true, genotox: true },
      categories: {},
      tk: { sessions: 2, points: 8, sampleOnly: false },
    },
  },
  {
    id: 'API03',
    title: '백신 4주(3회) 반복 + 면역원성',
    modality: '백신',
    priceStandard: 'MFDS',
    plan: {
      route: '근육',
      durations: [],
      phase: 'IND1',
      species: { rodent: true, nonRodent: false },
      addons: { recovery: true, immunogenicity: true },
      categories: {},
      tk: { sessions: 2, points: 8, sampleOnly: false },
    },
  },
  {
    id: 'API04',
    title: '화장품 대체법 — 모든 카테고리 ON',
    modality: '화장품',
    priceStandard: 'MFDS',
    plan: {
      route: '',
      durations: [],
      phase: 'IND1',
      species: { rodent: false, nonRodent: false },
      addons: {},
      categories: {
        singleDose: true, genotox: true, skinIrritation: true, skinSensitization: true,
        eyeIrritation: true, phototox: true, photosensitization: true, repeatDermal: false,
      },
      tk: { sessions: 2, points: 8, sampleOnly: false },
    },
  },
  {
    id: 'API05',
    title: '의료기기 ISO10993 — 기본 카테고리',
    modality: '의료기기(ISO10993)',
    priceStandard: 'MFDS',
    plan: {
      route: '',
      durations: [],
      phase: 'IND1',
      species: { rodent: false, nonRodent: false },
      addons: {},
      categories: {
        cytotoxicity: true, sensitization: true, irritation: true, systemicToxicity: true,
        subAcute: false, subChronic: false, genotox: true, implantation: false,
        pyrogen: false, hemocompat: false,
      },
      tk: { sessions: 2, points: 8, sampleOnly: false },
    },
  },
  {
    id: 'API06',
    title: '복합제 3종 (excipientCount=3 → priceTiers tier 3)',
    modality: '합성신약',
    priceStandard: 'MFDS',
    excipientCount: 3,
    plan: {
      route: '경구',
      durations: ['W13'],
      phase: 'IND1',
      species: { rodent: true, nonRodent: false },
      addons: { drf: true, recovery: false, tk: false, genotox: false, safetyPharm: false },
      categories: {},
      tk: { sessions: 2, points: 8, sampleOnly: false },
    },
  },
];

for (const sc of SCENARIOS) {
  test(`[${sc.id}] ${sc.title}`, async () => {
    if (!(await requireOnline())) return;
    const result = await runSuggest(sc);
    snapshotAssert(`regression-${sc.id}`, result);
  });
}

test('[INFO] suggest API 시나리오 수', () => {
  console.log(`    [INFO] suggest API 시나리오: ${SCENARIOS.length}개 (dev server 필요)`);
});
