/**
 * 2025 표준견적서 vs 앱(test_items.json) 정밀 비교.
 *
 * 카테고리 카운트가 아니라 "시험 family(종·주수·유형) 단위로 앱 전체에서 매칭"하여
 * ① 진짜 누락(앱 어디에도 없음) ② 가격차원 축소(군구성·분석방식) ③ 매핑차이/유지 를 구분한다.
 * 출력: 콘솔 요약 + data/_비교리포트_2025vs앱.xlsx
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = JSON.parse(fs.readFileSync(path.join(root, 'data', '_extracted_2025_quotes.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'data', 'test_items.json'), 'utf8'));

const cat2025 = (f) => {
  if (/복합제/.test(f)) return '복합제';
  if (/건기식|프로바이오/.test(f)) return '건강기능식품';
  if (/화장품|줄기세포/.test(f)) return '화장품';
  if (/의료기기/.test(f)) return '의료기기';
  if (/백신/.test(f)) return '백신';
  if (/세포치료제/.test(f)) return '세포치료제';
  if (/SEND|CTD|영문|번역/.test(f)) return 'SEND·CTD·번역';
  if (/심혈관/.test(f)) return '심혈관계스크리닝';
  if (/screening|스크리닝/i.test(f)) return '스크리닝';
  if (/안전성약리|hERG/.test(f)) return '안전성약리';
  if (/발암성/.test(f)) return '발암성';
  if (/분포|흡수|배설/.test(f)) return 'PK·분포';
  if (/화학물질|농약|환경|가습기|살생물|인축/.test(f)) return '화학물질·환경';
  if (/점안제/.test(f)) return '점안제';
  if (/metabolism/.test(f)) return 'in vitro metabolism';
  if (/조직병리|병리/.test(f)) return '조직병리';
  if (/경구피하근육|정맥|표준견적서/.test(f)) return '의약품(일반독성)';
  return '기타';
};

// ── family 시그니처: 종 | 주수 | 시험유형 ──
function species(n) {
  if (/비설치류|개|beagle|비글|\bdog\b|원숭이|monkey|미니피그|돼지|토끼|rabbit/i.test(n)) return '비설치류';
  if (/설치류|\brat\b|마우스|mouse|랫|SD/i.test(n)) return '설치류';
  return '';
}
function weeks(n) {
  if (/단회|급성|1회 투여|일회/i.test(n) && !/반복/.test(n)) return '단회';
  const m = n.match(/(\d+)\s*주/);
  return m ? m[1] + '주' : '';
}
function ttype(n) {
  if (/회복/.test(n)) return '회복';
  if (/DRF|용량.?결정|예비/i.test(n)) return 'DRF';
  if (/\bTK\b|독성동태/i.test(n)) return 'TK';
  if (/항체형성|면역원성/.test(n)) return '항체/면역원성';
  if (/종양원성|tumorigen/i.test(n)) return '종양원성';
  if (/체내\s*분포|체내분포|biodistrib|QPCR|분포/i.test(n)) return '체내분포';
  if (/Ames|복귀돌연변이|염색체이상|소핵|코멧|comet|MLA|Pig-?a|유전독성/i.test(n)) return '유전독성';
  if (/발암/i.test(n)) return '발암성';
  if (/생식|배태자|수태능|출생|발생독성/i.test(n)) return '생식발생';
  if (/hERG|심혈관|텔레메|telemetry|호흡|중추|CNS|Irwin|안전성약리|Cav|Nav|MEA/i.test(n)) return '안전성약리';
  if (/감작|LLNA|GPMT/i.test(n)) return '감작성';
  if (/피부자극|안자극|안점막|점막|국소|자극/i.test(n)) return '국소/자극';
  if (/세포독성/i.test(n)) return '세포독성';
  if (/이식/i.test(n)) return '이식';
  if (/발열성|엔도톡신|pyrogen/i.test(n)) return '발열성';
  if (/광독성|광감작/i.test(n)) return '광독성';
  if (/조제물|함량|validation|분석/i.test(n)) return '조제물/함량분석';
  if (/흡수|배설|약물동태|\bPK\b|metabolism|대사/i.test(n)) return 'PK/대사';
  if (/반복/.test(n)) return '반복투여';
  if (/단회|급성/.test(n)) return '단회투여';
  return '기타';
}
const sig = (n) => `${species(n)}|${weeks(n)}|${ttype(n)}`;
const core = (n) => String(n || '').split(/\s+-\s+|\s+–\s+|\s+\d+\.\s/)[0].replace(/\s+/g, ' ').trim();

// ── 앱 전역 family 인덱스 ──
const appSigs = new Set();
const appTypeSet = new Set();
for (const it of app) {
  appSigs.add(sig(it.testName));
  appTypeSet.add(ttype(it.testName));
}

// ── 2025 카테고리별 집계 ──
const byCat = {};
for (const f of files) {
  const cat = cat2025(f.fileName || '');
  for (const sh of (f.sheets || [])) {
    for (const it of (sh.items || [])) {
      const name = it.testNameFull || it.testName || '';
      if (!name) continue;
      (byCat[cat] = byCat[cat] || []).push({
        cat, file: f.fileName, sheet: sh.sheet, name: core(name), full: name,
        sig: sig(name), type: ttype(name), sp: species(name), wk: weeks(name),
        price: it.price ?? null,
      });
    }
  }
}

// ── 분류 ──
console.log('카테고리'.padEnd(20), '2025'.padStart(5), 'family'.padStart(7), '앱매칭'.padStart(6), '미매칭'.padStart(6), ' 진단');
console.log('─'.repeat(78));
const report = [];
for (const cat of Object.keys(byCat).sort()) {
  const rows = byCat[cat];
  const fams = new Map(); // sig → {count, found, sample, prices:Set}
  for (const r of rows) {
    const e = fams.get(r.sig) || { count: 0, found: appSigs.has(r.sig), typeFound: appTypeSet.has(r.type), sample: r.name, prices: new Set(), variants: new Set() };
    e.count++; if (r.price) e.prices.add(r.price);
    e.variants.add(r.sheet);
    fams.set(r.sig, e);
  }
  let matched = 0, unmatched = 0;
  const missingFams = [];
  for (const [s, e] of fams) {
    if (e.found) matched++;
    else { unmatched++; if (!e.typeFound) missingFams.push({ sig: s, sample: e.sample, count: e.count }); }
  }
  const collapsed = [...fams.values()].filter(e => e.prices.size >= 2 || e.variants.size >= 2);
  let dx = '✅ 유지';
  if (unmatched > 0 && missingFams.length > 0) dx = '🔴 누락 후보';
  else if (collapsed.length > 0) dx = '🟠 가격차원 축소';
  else if (unmatched > 0) dx = '🟡 변형 매칭필요';
  console.log(cat.padEnd(18), String(rows.length).padStart(5), String(fams.size).padStart(7), String(matched).padStart(6), String(unmatched).padStart(6), ' ' + dx);
  report.push({ cat, rows, fams, matched, unmatched, missingFams, collapsed });
}

// ── 상세: 누락 후보 + 가격축소 ──
console.log('\n\n========== 진짜 누락 후보 (앱에 시험유형 자체가 없음) ==========');
for (const r of report) {
  if (r.missingFams.length === 0) continue;
  console.log(`\n[${r.cat}] 미매칭 family ${r.missingFams.length}종:`);
  for (const m of r.missingFams.slice(0, 12)) console.log('   ·', m.sample, ' (', m.sig, ')');
}

console.log('\n\n========== 가격차원 축소 (2025=여러 변형가, 앱=단일) ==========');
for (const r of report) {
  const col = r.collapsed.filter(e => e.prices.size >= 2 || e.variants.size >= 2);
  if (col.length === 0) continue;
  console.log(`\n[${r.cat}]`);
  for (const e of col.slice(0, 8)) {
    const pr = [...e.prices].sort((a, b) => a - b);
    console.log(`   · ${e.sample} — 변형 ${e.variants.size}종(${[...e.variants].join('/')}), 가격대 ${pr.length ? (pr[0]/1e6)+'~'+(pr[pr.length-1]/1e6)+'백만' : '—'}`);
  }
}

// ── 변형 차원 라벨 (시트명 기반) ──
function dimsOf(variants) {
  const d = new Set();
  for (const v of variants) {
    if (/\d\s*군/.test(v)) d.add('군구성');
    if (/개별|동시/.test(v)) d.add('분석방식(개별/동시)');
    if (/\d\s*point|pt/i.test(v)) d.add('채혈포인트');
    if (/채혈|분석/.test(v)) d.add('채혈/분석범위');
    if (/SEND|CTD|번역/.test(v)) d.add('출력물(SEND/CTD/번역)');
    if (/종/.test(v)) d.add('성분종수');
  }
  return [...d].join(', ') || '경로·조건';
}
const won = (n) => (n ? Math.round(n / 1e6) + '백만' : '—');

// ── xlsx 리포트 ──
const ExcelJS = require('exceljs');
const wb = new ExcelJS.Workbook();
wb.creator = '2025vs앱 정밀비교';
const head = (ws) => { ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };

// 우선순위 점수: 가격차원 축소 변형수 × 가격폭
const prio = (r) => r.collapsed.reduce((s, e) => s + (e.variants.size > 1 ? e.variants.size : 0), 0);

// 시트1 요약
const s1 = wb.addWorksheet('① 요약');
s1.columns = [
  { header: '카테고리', key: 'cat', width: 22 },
  { header: '2025 항목', key: 'n', width: 10 },
  { header: 'family 수', key: 'fam', width: 10 },
  { header: '앱 매칭', key: 'm', width: 9 },
  { header: '미매칭', key: 'u', width: 9 },
  { header: '진단', key: 'dx', width: 18 },
  { header: '복원 우선순위', key: 'p', width: 12 },
  { header: '비고', key: 'note', width: 50 },
];
head(s1);
for (const r of [...report].sort((a, b) => prio(b) - prio(a))) {
  const miss = r.missingFams.length;
  const dx = miss > 0 ? '🔴 누락 후보' : r.collapsed.some(e => e.variants.size > 1) ? '🟠 가격차원 축소' : r.unmatched > 0 ? '🟡 변형 매칭필요' : '✅ 유지';
  const note = miss > 0 ? `앱에 없는 시험유형 ${miss}종 (③시트)` :
    r.collapsed.filter(e => e.variants.size > 1).length ? `변형차원: ${dimsOf(new Set(r.collapsed.flatMap(e => [...e.variants])))}` : '';
  s1.addRow({ cat: r.cat, n: r.rows.length, fam: r.fams.size, m: r.matched, u: r.unmatched, dx, p: prio(r), note });
}

// 시트2 가격차원 축소 상세 (worklist)
const s2 = wb.addWorksheet('② 가격차원 축소 (복원 대상)');
s2.columns = [
  { header: '카테고리', key: 'cat', width: 16 },
  { header: '시험 (대표명)', key: 'name', width: 46 },
  { header: '변형 차원', key: 'dim', width: 28 },
  { header: '변형 수', key: 'v', width: 8 },
  { header: '2025 최저가', key: 'lo', width: 11 },
  { header: '2025 최고가', key: 'hi', width: 11 },
  { header: '변형 목록', key: 'list', width: 60 },
];
head(s2);
for (const r of report) {
  for (const e of r.collapsed) {
    if (e.variants.size < 2 && e.prices.size < 2) continue;
    const pr = [...e.prices].sort((a, b) => a - b);
    s2.addRow({ cat: r.cat, name: e.sample, dim: dimsOf(e.variants), v: e.variants.size,
      lo: pr.length ? won(pr[0]) : '—', hi: pr.length ? won(pr[pr.length - 1]) : '—',
      list: [...e.variants].join(' / ') });
  }
}

// 시트3 미매칭 family (사람 검토 필요)
const s3 = wb.addWorksheet('③ 미매칭 family (검토)');
s3.columns = [
  { header: '카테고리', key: 'cat', width: 16 },
  { header: '구분', key: 'kind', width: 16 },
  { header: '2025 시험명', key: 'name', width: 60 },
  { header: 'family 시그니처', key: 'sig', width: 24 },
  { header: '2025 건수', key: 'c', width: 9 },
];
head(s3);
for (const r of report) {
  for (const [s, e] of r.fams) {
    if (e.found) continue;
    const kind = e.typeFound ? '🟡 유형은 있음(변형 매칭필요)' : '🔴 유형 자체 없음(누락 후보)';
    s3.addRow({ cat: r.cat, kind, name: e.sample, sig: s, c: e.count });
  }
}

// 시트4 백신 상세 / 시트5 복합제 상세 (즉시 복원 참조용)
function detailSheet(name, cat) {
  const ws = wb.addWorksheet(name);
  ws.columns = [
    { header: '시트(변형)', key: 'sheet', width: 14 },
    { header: '시험명(core)', key: 'name', width: 50 },
    { header: '종', key: 'sp', width: 8 },
    { header: '주수', key: 'wk', width: 8 },
    { header: '유형', key: 'tp', width: 14 },
    { header: '2025 가격', key: 'price', width: 14 },
  ];
  head(ws);
  for (const row of (byCat[cat] || [])) {
    ws.addRow({ sheet: row.sheet, name: row.name, sp: row.sp, wk: row.wk, tp: row.type, price: row.price });
  }
}
detailSheet('④ 백신 상세', '백신');
detailSheet('⑤ 복합제 상세', '복합제');

const OUT = path.join(root, 'data', '_비교리포트_2025vs앱.xlsx');
wb.xlsx.writeFile(OUT).then(() => console.log('\n\n✅ 리포트 저장:', OUT));

module.exports = { report, byCat };
