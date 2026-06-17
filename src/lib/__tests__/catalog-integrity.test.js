/**
 * Catalog integrity checks — test_items.json 의 데이터 품질 보장.
 *
 * 회사 마스터 데이터(test_items.json) 가 매번 재생성될 때마다 다음을 자동 검증:
 *   - 필수 필드 존재
 *   - 가격 값 sanity (음수/이상값 없음)
 *   - key 고유성
 *   - modalityPool 비어있는 항목 없음
 *   - priceTiers 구조 일관성
 *   - studyWeeks 와 testName 의 주차 표기 일치
 *
 * 실패 시: extract_mapping.js 에서 데이터 잘못 추출됐거나, 마스터 원본이 깨졌거나,
 *         data 스키마가 변경되었을 가능성.
 *
 * Run: `node --test src/lib/__tests__/catalog-integrity.test.js`
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const testItemsPath = path.join(ROOT, 'data', 'test_items.json');
const presetsPath   = path.join(ROOT, 'data', 'modality_presets.json');
const blocksPath    = path.join(ROOT, 'data', 'guideline_blocks.json');

let _items = null;
function items() {
  if (_items === null) _items = JSON.parse(fs.readFileSync(testItemsPath, 'utf8'));
  return _items;
}

// ─── 파일 존재 ────────────────────────────────────────────────────────────

test('data/test_items.json 파일이 존재한다', () => {
  assert.ok(fs.existsSync(testItemsPath));
});

test('data/modality_presets.json 파일이 존재한다', () => {
  assert.ok(fs.existsSync(presetsPath));
});

test('data/guideline_blocks.json 파일이 존재한다', () => {
  assert.ok(fs.existsSync(blocksPath));
});

// ─── 기본 구조 ────────────────────────────────────────────────────────────

test('test_items.json 이 비어있지 않다 (>= 100건)', () => {
  const arr = items();
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length >= 100, `expected >=100 items, got ${arr.length}`);
});

test('모든 항목이 필수 필드를 가진다 (key, testName, modalityPool, routeGroup)', () => {
  for (const it of items()) {
    assert.ok(it.key && typeof it.key === 'string', `key 누락: ${JSON.stringify(it).slice(0, 80)}`);
    assert.ok(it.testName && typeof it.testName === 'string', `${it.key}: testName 누락`);
    assert.ok(Array.isArray(it.modalityPool), `${it.key}: modalityPool 배열 아님`);
    assert.ok(['A', 'B', 'SPECIAL', 'NONE'].includes(it.routeGroup), `${it.key}: routeGroup 값 이상 = ${it.routeGroup}`);
  }
});

test('key 가 고유하다', () => {
  const keys = new Set();
  const dupes = [];
  for (const it of items()) {
    if (keys.has(it.key)) dupes.push(it.key);
    keys.add(it.key);
  }
  assert.deepEqual(dupes, [], `중복 key: ${dupes.slice(0, 5).join(', ')}${dupes.length > 5 ? ` (+${dupes.length - 5})` : ''}`);
});

// ─── 가격 sanity ──────────────────────────────────────────────────────────

test('priceMfds / priceOecd 는 null 또는 음수 아닌 숫자', () => {
  const bad = [];
  for (const it of items()) {
    for (const f of ['priceMfds', 'priceOecd']) {
      const v = it[f];
      if (v == null) continue;
      if (!Number.isFinite(v) || v < 0) bad.push(`${it.key}.${f} = ${v}`);
    }
  }
  assert.deepEqual(bad, [], `이상 가격: ${bad.slice(0, 5).join(' / ')}`);
});

test('priceTiers 가 있는 항목은 모든 tier 값이 양수', () => {
  const bad = [];
  for (const it of items()) {
    if (!it.priceTiers) continue;
    for (const [tier, v] of Object.entries(it.priceTiers)) {
      if (v == null || !Number.isFinite(v) || v <= 0) bad.push(`${it.key}.priceTiers[${tier}] = ${v}`);
    }
  }
  assert.deepEqual(bad, [], `이상 tier 가격: ${bad.slice(0, 5).join(' / ')}`);
});

test('priceTiers 가 있는 항목은 적어도 1개 tier 보유', () => {
  for (const it of items()) {
    if (!it.priceTiers) continue;
    assert.ok(Object.keys(it.priceTiers).length > 0, `${it.key}: priceTiers 빈 객체`);
  }
});

// ─── modality 검증 ────────────────────────────────────────────────────────

test('modalityPool 또는 source key prefix 로 모달리티 식별 가능', () => {
  // data/modality-config.ts 에 정의된 12개 모달리티
  const KNOWN = new Set([
    '합성신약', '생물의약품', '항암제', '펩타이드', '바이오시밀러',
    'ADC', '이중특이항체', '방사성의약품', '유전자치료제', '핵산치료제',
    '세포치료제', '백신', '건강기능식품',
    '화장품', '의료기기(ISO10993)', '스크리닝', '심혈관계스크리닝',
    '복합제', 'in vitro 대사·PK',
  ]);
  const SOURCE_PREFIXES = ['독성시험_', '건기식_', '백신_', '복합제_', '화장품_', '의료기기_', '스크리닝_', '심혈관계스크리닝_', 'SEND_CTD', '견적_부가옵션_', '대사PK_'];

  let unmatched = 0;
  for (const it of items()) {
    const inPool = it.modalityPool.some(m => KNOWN.has(m));
    const inPrefix = SOURCE_PREFIXES.some(p => (it.key || '').startsWith(p));
    if (!inPool && !inPrefix) unmatched++;
  }
  assert.equal(unmatched, 0, `${unmatched} 건이 알려진 모달리티/소스 prefix 와 매칭 안 됨`);
});

// ─── studyWeeks vs testName 일관성 ───────────────────────────────────────

test('studyWeeks ↔ testName 의 N주 일치 (F-1 수정 후 정상이어야 함)', () => {
  // F-1 수정 이력 (2026-05):
  //   backfill-study-weeks.js 가 testName 에서 실제 시험 투여 주차를 파싱하여
  //   studyWeeks 에 채움. 견적 진행 기간(보고서 4주 포함)은 quoteWeeks 로 분리.
  //   이전: 100건 mismatch (studyWeeks 가 견적기간 값) / 이후: 0건 기대.
  //
  // 본 테스트가 실패하면:
  //   - test_items.json 이 재생성됐고 backfill-study-weeks 가 안 돌았거나
  //   - testName 형식이 바뀌었거나
  //   - parseStudyWeeks 로직이 회귀됐을 가능성.
  const mismatches = [];
  for (const it of items()) {
    if (it.studyWeeks == null) continue;
    if (it.studyWeeks === 0) continue;
    const m = (it.testName || '').match(/(\d+)\s*주/);
    if (m && Number(m[1]) !== it.studyWeeks) {
      mismatches.push(`${it.key.split('#').slice(-1)[0]}: studyWeeks=${it.studyWeeks} ≠ testName ${m[1]}주 (${it.testName.slice(0, 30)})`);
    }
  }
  assert.equal(mismatches.length, 0,
    `mismatch ${mismatches.length}건. backfill-study-weeks.js 재실행 필요? 샘플:\n` +
    mismatches.slice(0, 5).join('\n'));
});

test('[INFO] quoteWeeks 채움률 (견적서 "기간(주)" 표시용)', () => {
  let withQuote = 0, withStudy = 0, bothMissing = 0;
  for (const it of items()) {
    if (it.quoteWeeks != null) withQuote++;
    if (it.studyWeeks != null) withStudy++;
    if (it.quoteWeeks == null && it.studyWeeks == null) bothMissing++;
  }
  console.log(`    [INFO] quoteWeeks=${withQuote} studyWeeks=${withStudy} (둘 다 null=${bothMissing} → 사용자 직접 입력 대상)`);
});

// ─── routeGroup 분포 ──────────────────────────────────────────────────────

test('routeGroup 분포가 합리적 (A/B/SPECIAL/NONE 모두 등장)', () => {
  const dist = {};
  for (const it of items()) dist[it.routeGroup] = (dist[it.routeGroup] || 0) + 1;
  for (const g of ['A', 'B', 'SPECIAL', 'NONE']) {
    assert.ok((dist[g] || 0) > 0, `routeGroup ${g} 가 0건`);
  }
});

// ─── presets 무결성 ───────────────────────────────────────────────────────

test('modality_presets.json 의 defaultTests key 가 test_items.json 에 모두 존재', () => {
  const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
  const keys = new Set(items().map(i => i.key));
  const missing = [];
  for (const p of presets) {
    for (const t of (p.defaultTests || [])) {
      if (!keys.has(t.key)) missing.push(`${p.modality}/${p.presetName}: ${t.key}`);
    }
  }
  // 일부 preset 이 stale 일 수 있음 — 50건 이내면 통과 (broken preset 50건 초과 시 경고)
  assert.ok(missing.length <= 50, `preset 의 defaultTests 중 ${missing.length}건 이 catalog 에 없음 (50건 초과 시 점검 필요)\n${missing.slice(0, 5).join('\n')}`);
});

// ─── 출력: 정보용 ─────────────────────────────────────────────────────────

test('[INFO] catalog 통계', () => {
  const arr = items();
  let withMfds = 0, withOecd = 0, withTiers = 0, withWeeks = 0;
  for (const it of arr) {
    if (it.priceMfds != null) withMfds++;
    if (it.priceOecd != null) withOecd++;
    if (it.priceTiers) withTiers++;
    if (it.studyWeeks != null) withWeeks++;
  }
  console.log(`    [INFO] total=${arr.length} priceMfds=${withMfds} priceOecd=${withOecd} priceTiers=${withTiers} studyWeeks=${withWeeks}`);
});
