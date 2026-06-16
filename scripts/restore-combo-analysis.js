/**
 * 복합제 분석방식(개별/동시) granularity 복원 + 독립 모달리티화.
 *
 * 분석방식은 3개 항목에서만 가격이 다름 (2025 견적서 기준):
 *   조제물분석:        개별 20/30/40 → 동시 16/26/36 (백만, 2/3/4종)
 *   함량분석:          개별 10/15/20 → 동시  8/13/18
 *   TK 6pt(채혈+분석): 개별 161/213/263 → 동시 117/195/255
 *   TK 8pt(채혈+분석): 개별 186/246/307 → 동시 137/227/299
 * 나머지(DRF·13주반복·회복·TK채혈만)는 개별=동시 동일.
 *
 * 작업: ① 모든 복합제 항목 modalityPool 에 '복합제' 추가(기존 합성신약 유지)
 *       ② 분석민감 4항목: 기존을 "(개별)"로 표기 + "(동시)" 변형 신규 추가
 * 재실행 안전: 기존 _동시 마커 제거 후 재생성.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'test_items.json');
const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const MARK = '_동시분석';

// 동시분석 가격표 (현재 testName → 동시 priceTiers)
const DONGSI = {
  '조제물분석':          { 2: 16_000_000, 3: 26_000_000, 4: 36_000_000 },
  '함량분석':            { 2: 8_000_000, 3: 13_000_000, 4: 18_000_000 },
  'TK 6pt (채혈+분석)': { 2: 117_000_000, 3: 195_000_000, 4: 255_000_000 },
  'TK 8pt (채혈+분석)': { 2: 137_000_000, 3: 227_000_000, 4: 299_000_000 },
};
// 개별/동시 표기 라벨
const labelGae = (n) => /TK/.test(n) ? n.replace(/\)$/, '·개별)') : `${n} (개별분석)`;
const labelDong = (n) => /TK/.test(n) ? n.replace(/\)$/, '·동시)') : `${n} (동시분석)`;

// 0) 기존 동시 변형 제거 (재실행 안전)
const before = items.length;
let arr = items.filter(x => !(x.key && x.key.includes(MARK)));
console.log('기존 동시변형 제거:', before - arr.length, '건');

const out = [];
let added = 0;
for (const it of arr) {
  const isCombo = it.sourceFile && it.sourceFile.includes('복합제');
  if (!isCombo) { out.push(it); continue; }

  // ① modalityPool 에 복합제 추가
  if (!Array.isArray(it.modalityPool)) it.modalityPool = [];
  if (!it.modalityPool.includes('복합제')) it.modalityPool = ['복합제', ...it.modalityPool];

  // 분석민감 항목인지 (현재 testName 의 개별 베이스명으로 매칭)
  const baseName = it.testName.replace(/\s*\((개별|동시)분석\)$/, '').replace(/·(개별|동시)\)$/, ')');
  const dongTiers = DONGSI[baseName];

  if (dongTiers) {
    // 기존 = 개별 (표기)
    if (!/개별|동시/.test(it.testName)) it.testName = labelGae(baseName);
    out.push(it);
    // 동시 변형 신규
    const clone = JSON.parse(JSON.stringify(it));
    clone.testName = labelDong(baseName);
    clone.priceTiers = { ...dongTiers };
    clone.priceMfds = dongTiers[3];
    clone.priceOecd = dongTiers[3];
    clone.masterId = `${it.masterId}${MARK}`;
    clone.key = it.key.includes('__')
      ? it.key.replace('__', `${MARK}__`)
      : `${it.key}${MARK}`;
    out.push(clone);
    added++;
  } else {
    out.push(it);
  }
}

const combo = out.filter(x => x.sourceFile && x.sourceFile.includes('복합제'));
console.log('복합제 항목:', combo.length, '개 (동시변형', added, '개 추가)');
// key 유일성 체크
const ks = out.map(x => x.key);
if (new Set(ks).size !== ks.length) { console.error('❌ key 중복 발생'); process.exit(1); }
fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('✅ 저장 완료 (총', out.length, '항목)');
