/**
 * 2025 vs 2026 표준견적서 비교 분석 리포트 생성.
 *
 * 목적: 2026 개정 시 2025 대비 사라지거나 뭉개진 "구성 세밀함(granularity)" 을
 *       카테고리별로 찾아내 비개발자용 markdown 리포트로 출력.
 *
 * 입력:
 *   - data/_extracted_2025_quotes.json   (2025 견적서 추출 결과)
 *   - data/test_items.json                (현 2026 마스터 — 웹앱 사용 중)
 *   - 2026 원본 마스터 xlsx (시트명/구성 확인용)
 *
 * 출력:
 *   - data/_compare_2025_vs_2026.md
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const q2025 = JSON.parse(fs.readFileSync(path.join(root, 'data', '_extracted_2025_quotes.json'), 'utf8'));
const items2026 = JSON.parse(fs.readFileSync(path.join(root, 'data', 'test_items.json'), 'utf8'));

// ── 2025 파일 → 카테고리 매핑 ──
const cat2025 = (f) => {
  if (/복합제/.test(f)) return '복합제';
  if (/건기식|프로바이오/.test(f)) return '건강기능식품';
  if (/화장품|줄기세포/.test(f)) return '화장품';
  if (/의료기기/.test(f)) return '의료기기';
  if (/백신/.test(f)) return '백신';
  if (/세포치료제/.test(f)) return '세포치료제';
  if (/SEND|CTD|영문|번역/.test(f)) return 'SEND/CTD/번역';
  if (/심혈관/.test(f)) return '심혈관계스크리닝';
  if (/screening|스크리닝/i.test(f)) return '스크리닝';
  if (/안전성약리|hERG/.test(f)) return '안전성약리';
  if (/발암성/.test(f)) return '발암성';
  if (/분포|흡수|배설|약물동태|\bPK\b/.test(f)) return 'PK·분포';
  if (/화학물질|농약|환경|가습기|살생물|인축/.test(f)) return '화학물질·환경';
  if (/점안제/.test(f)) return '점안제';
  if (/metabolism/.test(f)) return 'in vitro metabolism';
  if (/조직병리|병리/.test(f)) return '조직병리';
  if (/경구피하근육|정맥|표준견적서/.test(f)) return '의약품(메인)';
  return '기타';
};

// ── 2026 마스터 파일 prefix → 카테고리 ──
const cat2026 = (key) => {
  if (key.startsWith('독성시험_')) return '의약품(메인)';
  if (key.startsWith('복합제_')) return '복합제';
  if (key.startsWith('백신_')) return '백신';
  if (key.startsWith('SEND_CTD')) return '세포치료제';
  if (key.startsWith('건기식_')) return '건강기능식품';
  if (key.startsWith('화장품_')) return '화장품';
  if (key.startsWith('의료기기_')) return '의료기기';
  if (key.startsWith('스크리닝_')) return '스크리닝';
  if (key.startsWith('심혈관계스크리닝_')) return '심혈관계스크리닝';
  return '기타';
};

// ── 2025 집계 ──
const agg2025 = {}; // cat → { files:Set, sheets:Set, items, priced, sheetNames:Set, itemNames:Set }
for (const file of q2025) {
  if (file.error) continue;
  const c = cat2025(file.fileName);
  agg2025[c] = agg2025[c] || { files: new Set(), sheets: new Set(), items: 0, priced: 0, sheetNames: new Set(), itemNames: new Set() };
  agg2025[c].files.add(file.fileName);
  for (const sh of file.sheets || []) {
    if (sh.itemCount > 0) agg2025[c].sheets.add(file.fileName + '::' + sh.sheet);
    agg2025[c].sheetNames.add(sh.sheet);
    agg2025[c].items += sh.itemCount;
    for (const it of sh.items || []) {
      if (it.price != null) agg2025[c].priced++;
      agg2025[c].itemNames.add(it.testNameFull.replace(/\s+/g, '').slice(0, 50));
    }
  }
}

// ── 2026 집계 ──
const agg2026 = {}; // cat → { items, priced, itemNames:Set }
for (const it of items2026) {
  const c = cat2026(it.key);
  agg2026[c] = agg2026[c] || { items: 0, priced: 0, itemNames: new Set() };
  agg2026[c].items++;
  if (it.priceMfds != null) agg2026[c].priced++;
  agg2026[c].itemNames.add(it.testName.replace(/\s+/g, '').slice(0, 50));
}

// ── 리포트 작성 ──
const L = [];
L.push('# 2025 vs 2026 표준견적서 비교 분석');
L.push('');
L.push('> 목적: 2026 개정 시 2025 대비 누락·간소화된 구성을 찾아 통합 마스터로 복원하기 위한 기준 문서.');
L.push('> 가격·세부내용은 2026 기준이 권위. 구성 세밀함(granularity)은 2025 기준으로 복원.');
L.push('');
L.push('## 1. 카테고리별 항목 수 비교');
L.push('');
L.push('| 카테고리 | 2025 항목 | 2026 항목 | 증감 | 상태 |');
L.push('|---|---:|---:|---:|---|');

const allCats = [...new Set([...Object.keys(agg2025), ...Object.keys(agg2026)])];
const catOrder = ['의약품(메인)', '복합제', '백신', '세포치료제', '건강기능식품', '화장품', '의료기기', '스크리닝', '심혈관계스크리닝', '안전성약리', '발암성', 'PK·분포', '점안제', '화학물질·환경', 'in vitro metabolism', 'SEND/CTD/번역', '조직병리', '기타'];
const sortedCats = allCats.sort((a, b) => {
  const ia = catOrder.indexOf(a), ib = catOrder.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

for (const c of sortedCats) {
  const a = agg2025[c]?.items || 0;
  const b = agg2026[c]?.items || 0;
  const diff = b - a;
  let status;
  if (b === 0 && a > 0) status = '🔴 2026 누락 (신규 추가 필요)';
  else if (a > 0 && b > 0 && b < a * 0.5) status = '🟠 과도 간소화 (복원 필요)';
  else if (a > 0 && b > 0 && b < a) status = '🟡 일부 축소';
  else if (b >= a && a > 0) status = '🟢 유지/확대';
  else status = '— 2026 전용';
  L.push(`| ${c} | ${a || '-'} | ${b || '-'} | ${diff > 0 ? '+' : ''}${diff} | ${status} |`);
}

L.push('');
L.push('## 2. 카테고리별 granularity(세밀함) 차원 분석');
L.push('');
L.push('2025 견적서의 시트명에 인코딩된 구분 축 = 우리가 보존해야 할 granularity.');
L.push('');

for (const c of sortedCats) {
  if (!agg2025[c]) continue;
  const sheetNames = [...agg2025[c].sheetNames].filter(Boolean);
  if (sheetNames.length === 0) continue;
  L.push(`### ${c}`);
  L.push('');
  L.push(`- **2025**: 파일 ${agg2025[c].files.size}개, 항목 ${agg2025[c].items}개 (가격 ${agg2025[c].priced})`);
  L.push(`- **2026**: 항목 ${agg2026[c]?.items || 0}개`);
  L.push(`- **2025 시트 구성** (${sheetNames.length}개): ${sheetNames.slice(0, 30).map(s => `\`${s}\``).join(', ')}`);
  // granularity 축 추론
  const axes = [];
  const joined = sheetNames.join(' ');
  if (/\d종/.test(joined)) axes.push('종수(2종/3종/4종)');
  if (/개별|동시/.test(joined)) axes.push('분석방식(개별분석/동시분석)');
  if (/6\s*point|8\s*point|6point|8point/i.test(joined)) axes.push('TK 포인트(6/8 point)');
  if (/채혈|분석/.test(joined)) axes.push('TK 방식(채혈만/채혈+분석)');
  if (/OECD|MFDS/.test(joined)) axes.push('제출처(MFDS/OECD)');
  if (/경구|피하|근육|정맥|경피/.test(joined)) axes.push('투여경로(경구·피하·근육 / 정맥·경피)');
  if (/2군|3군|4군/.test(joined)) axes.push('군 구성(2군/3군/4군)');
  if (/비글|토끼|SD|rat/i.test(joined)) axes.push('동물종');
  if (/4주|13주|26주|39주|52주/.test(joined)) axes.push('투여기간');
  if (/톤/.test(joined)) axes.push('취급량(톤 구간)');
  if (axes.length) L.push(`- **granularity 축**: ${axes.join(' × ')}`);
  L.push('');
}

L.push('## 3. 2026 완전 누락 카테고리 (신규 모달리티 추가 후보)');
L.push('');
for (const c of sortedCats) {
  const a = agg2025[c]?.items || 0;
  const b = agg2026[c]?.items || 0;
  if (a > 0 && b === 0) {
    L.push(`### 🔴 ${c} — 2025 ${a}개 항목, 2026 없음`);
    const names = [...(agg2025[c].itemNames || [])].slice(0, 15);
    for (const n of names) L.push(`- ${n}`);
    L.push('');
  }
}

const out = path.join(root, 'data', '_compare_2025_vs_2026.md');
fs.writeFileSync(out, L.join('\n'));
console.log('리포트 생성 →', out);
console.log('\n' + L.slice(0, 60).join('\n'));
