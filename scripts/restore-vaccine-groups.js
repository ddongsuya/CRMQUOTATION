/**
 * 백신 군구성(2/3/4/5군) granularity 복원 — 2025 표준견적서 기준.
 *
 * 현재 앱은 2군(대조1+백신1) baseline 3개 항목만 보유.
 * 2025 견적서의 3/4/5군 변형(가격 선형: 군수에 비례)을 항목으로 추가한다.
 *   반복투여: 2군56 / 3군84 / 4군112 / 5군140 (백만)
 *   회복:    2군30.8 / 3군46.2 / 4군61.6 / 5군77
 *   항체형성: 2군10.8 / 3군16.2 / 4군21.6 / 5군27
 * 출처: data/_extracted_2025_quotes.json (OOOO-2024년 백신 비임상 시험 견적서)
 * 재실행 안전: 기존 3/4/5군 마커 항목을 먼저 제거 후 재생성.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const FILE = path.join(root, 'data', 'test_items.json');
const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// 2025 실제 가격표 (백만원) — 시험유형 × 군수
const PRICE = {
  '반복투여독성': { 2: 56_000_000, 3: 84_000_000, 4: 112_000_000, 5: 140_000_000 },
  '회복':        { 2: 30_800_000, 3: 46_200_000, 4: 61_600_000, 5: 77_000_000 },
  '항체형성':     { 2: 10_800_000, 3: 16_200_000, 4: 21_600_000, 5: 27_000_000 },
};
const GROUP_MARK = '_백신군'; // 새 항목 key 식별 마커

// 1) 기존 3/4/5군 복원항목 제거 (재실행 안전)
const before = items.length;
const cleaned = items.filter(x => !(x.key && x.key.includes(GROUP_MARK)));
console.log('기존 복원항목 제거:', before - cleaned.length, '건');

// 2) 백신 2군 baseline 3개 찾기
const baseItems = cleaned.filter(x => x.sourceFile && x.sourceFile.includes('백신'));
if (baseItems.length !== 3) { console.error('백신 baseline 3개가 아님:', baseItems.length); process.exit(1); }

const typeOf = (it) => /회복/.test(it.testName) ? '회복' : /항체/.test(it.testName) ? '항체형성' : '반복투여독성';

// 3) baseline 의 이름에 "(2군)" 명시 + 새 군 항목 생성
const out = [];
for (const it of cleaned) {
  if (!(it.sourceFile && it.sourceFile.includes('백신'))) { out.push(it); continue; }
  const t = typeOf(it);
  // 2군 baseline: 이름에 (2군) 표기 (이미 있으면 유지)
  if (!/\(\d군\)/.test(it.testName)) it.testName = `${it.testName} (2군)`;
  out.push(it);

  // 3/4/5군 변형 생성
  for (const g of [3, 4, 5]) {
    const price = PRICE[t][g];
    const clone = JSON.parse(JSON.stringify(it));
    clone.key = `${it.masterId}${GROUP_MARK}${g}__${it.adminRoute}`;
    clone.masterId = `${it.masterId}${GROUP_MARK}${g}`;
    clone.testName = it.testName.replace(/\(\d군\)/, `(${g}군)`);
    clone.priceMfds = price;
    clone.priceOecd = price;
    const vaccineGroups = g - 1; // 대조1 + 백신(g-1)
    const sub = (s) => String(s || '')
      .replace(/총 2군/g, `총 ${g}군`)
      .replace(/백신군 1/g, `백신군 ${vaccineGroups}`)
      .replace(/2군\(대조\+백신\)/g, `${g}군(대조1+백신${vaccineGroups})`);
    clone.detail = sub(clone.detail);
    clone.quoteText = sub(clone.quoteText);
    clone.guideline = sub(clone.guideline);
    clone.notice = sub(clone.notice);
    out.push(clone);
  }
}

console.log('백신 항목:', baseItems.length, '→', out.filter(x => x.sourceFile && x.sourceFile.includes('백신')).length);
fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('✅ test_items.json 저장 (총', out.length, '항목)');
