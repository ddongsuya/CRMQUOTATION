/**
 * Integration tests for the per-modality suggestion dispatcher.
 *
 * These hit the running dev server's /api/plan/suggest endpoint, so they
 * exercise the real dispatcher → finder chain → uniq() → tier resolver. Skip
 * the suite when no server is reachable so CI/local can run regardless.
 *
 * Run: `node --test src/lib/__tests__/suggest.api.test.js`
 * (Requires `npm run dev` to be running first.)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function reachable() {
  try {
    const r = await fetch(BASE + '/api/items/by-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"keys":[]}' });
    return r.ok;
  } catch { return false; }
}

const skipIfOffline = async () => {
  if (!(await reachable())) {
    console.log(`[skip] dev server unreachable at ${BASE}`);
    return true;
  }
  return false;
};

async function suggest(body) {
  const r = await fetch(BASE + '/api/plan/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const tk = { sessions: 2, points: 8, sampleOnly: false };

// ───── 신약군 (drug-full) ─────
test('[suggest] 합성신약 + 경구 + 13주 + full addons → 13+ hits, prices present', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '합성신약', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '경구', durations: ['W13'], phase: 'IND1',
            species: { rodent: true, nonRodent: true },
            addons: { drf: true, recovery: true, tk: true, genotox: true, safetyPharm: true },
            categories: {}, tk },
  });
  assert.ok(d.hits.length >= 13, `got ${d.hits.length}`);
  assert.ok(d.hits.every(h => h.unitPrice >= 0));
  // tag categories present
  const tags = new Set(d.hits.map(h => h.tag));
  for (const exp of ['DRF (13주용)', '13주 본시험', '13주 + 4주 회복군', '유전독성·Ames', '안전성약리·hERG']) {
    assert.ok([...tags].some(t => t === exp || t.startsWith(exp)), `missing tag: ${exp}`);
  }
});

test('[suggest] 합성신약 + excipientCount=3 → 복합제 tier 적용', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '합성신약', priceStandard: 'MFDS', excipientCount: 3,
    plan: { route: '경구', durations: ['W13'], phase: 'IND1',
            species: { rodent: true, nonRodent: false },
            addons: { drf: true, recovery: false, tk: false, genotox: false, safetyPharm: false },
            categories: {}, tk },
  });
  const drf = d.hits.find(h => h.testName === '설치류 4주 DRF');
  assert.ok(drf, '설치류 4주 DRF should be present');
  // 복합제 master row 4: 2종=28M / 3종=33M / 4종=40M  (true xlsx values; replaces the
  // off-by-one corrupted prices that previously appeared in this slot)
  assert.equal(drf.unitPrice, 33_000_000, `expected 3종 tier 33M, got ${drf.unitPrice}`);
  // Single-component baseline (excipientCount=0) should fall back to 단일제 master (20M)
  const single = await suggest({
    modality: '합성신약', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '경구', durations: ['W13'], phase: 'IND1',
            species: { rodent: true, nonRodent: false },
            addons: { drf: true, recovery: false, tk: false, genotox: false, safetyPharm: false },
            categories: {}, tk },
  });
  const singleDrf = single.hits.find(h => h.testName === '설치류 4주 DRF');
  assert.equal(singleDrf.unitPrice, 20_000_000);
});

// ───── 백신 ─────
test('[suggest] 백신 → 4주(3회) 반복 + 회복 + 면역원성', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '백신', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '근육', durations: [], phase: 'IND1',
            species: { rodent: true, nonRodent: false },
            addons: { recovery: true, immunogenicity: true },
            categories: {}, tk },
  });
  assert.equal(d.hits.length, 3, `expected 3, got ${d.hits.length}`);
  assert.ok(d.hits.some(h => /반복투여 독성/.test(h.testName)));
  assert.ok(d.hits.some(h => /회복/.test(h.testName)));
  assert.ok(d.hits.some(h => /항체형성/.test(h.testName)));
});

// ───── 건강기능식품 ─────
test('[suggest] 건강기능식품 → 단회 + 13주 + 회복 + 유전독성, 안전성약리 없음', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '건강기능식품', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '경구', durations: ['SINGLE', 'W13'], phase: 'IND1',
            species: { rodent: true, nonRodent: false },
            addons: { drf: true, recovery: true, genotox: true },
            categories: {}, tk },
  });
  assert.ok(d.hits.length >= 7);
  assert.ok(d.hits.every(h => !/안전성약리|hERG|중추신경/.test(h.testName)));
  assert.ok(d.hits.some(h => /Ames|소핵|염색체이상/.test(h.testName)));
});

// ───── 의료기기 (category mode) ─────
test('[suggest] 의료기기 카테고리 모드 → 선택 카테고리만 hits', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '의료기기(ISO10993)', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '', durations: [], phase: 'IND1',
            species: { rodent: false, nonRodent: false }, addons: {},
            categories: { cytotoxicity: true, genotox: true }, tk },
  });
  assert.ok(d.hits.length >= 5);
  // every hit should match cytotox or genotox patterns
  const ok = d.hits.every(h => /세포독성|Ames|복귀돌연변이|염색체이상|소핵|MLA/.test(h.testName));
  assert.ok(ok, 'unexpected category result: ' + d.hits.map(h => h.testName).join(', '));
});

// ───── 화장품 (category mode) ─────
test('[suggest] 화장품 카테고리 모드 → 피부자극·감작 항목 포함', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '화장품', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '', durations: [], phase: 'IND1',
            species: { rodent: false, nonRodent: false }, addons: {},
            categories: { skinIrritation: true, skinSensitization: true }, tk },
  });
  assert.ok(d.hits.some(h => /피부자극/.test(h.testName)));
  assert.ok(d.hits.some(h => /피부감작|LLNA/.test(h.testName)));
});

// ───── 카테고리 미선택 → notes 안내 ─────
test('[suggest] 카테고리 모달리티에 카테고리 0개 → 빈 결과 + notes', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '의료기기(ISO10993)', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '', durations: [], phase: 'IND1',
            species: { rodent: false, nonRodent: false }, addons: {}, categories: {}, tk },
  });
  assert.equal(d.hits.length, 0);
  assert.ok(d.notes.length > 0);
});

// ───── 모달리티 미입력 ─────
test('[suggest] modality 미선택 → notes 안내', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const d = await suggest({
    modality: '', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '경구', durations: [], phase: 'IND1',
            species: { rodent: true, nonRodent: false }, addons: {}, categories: {}, tk },
  });
  assert.equal(d.hits.length, 0);
  assert.match(d.notes[0], /모달리티/);
});

// ───── dedup ─────
test('[suggest] uniq dedup — 합성신약·동일조건 두 번 호출 시 결과 일관성', async (t) => {
  if (await skipIfOffline()) return t.skip();
  const body = {
    modality: '합성신약', priceStandard: 'MFDS', excipientCount: 0,
    plan: { route: '경구', durations: ['W4', 'W13'], phase: 'IND1',
            species: { rodent: true, nonRodent: false },
            addons: { drf: true, recovery: false, tk: false, genotox: false, safetyPharm: false },
            categories: {}, tk },
  };
  const a = await suggest(body);
  const b = await suggest(body);
  assert.deepEqual(a.hits.map(h => h.key).sort(), b.hits.map(h => h.key).sort());
  // No duplicate keys within a single response
  const keys = a.hits.map(h => h.key);
  assert.equal(new Set(keys).size, keys.length, '중복 key 존재');
});
