/**
 * Extend test_items.json with long-form descriptive fields pulled from the
 * raw master xlsx files. Adds:
 *   detail     ← "상세 설명"
 *   notice     ← "주의사항"
 *   quoteText  ← "원문(견적서)"
 *   guideline  ← "가이드라인 핵심내용" (falls back to ICH/MFDS/OECD TG composite)
 *
 * Run after backfill-prices.js. Idempotent — overwrites detail fields each run.
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const RAW_DIR = 'G:/내 드라이브/데이터 정규화/데이터 정규화 (원문 + 주의사항)';
const JSON_PATH = path.join(__dirname, '..', 'data', 'test_items.json');

const SOURCES = [
  '독성시험_항목_마스터_추가정규화_v2.xlsx',
  '복합제_항목_마스터_추가정규화_v2.xlsx',
  '백신_항목_마스터_추가정규화_v2.xlsx',
  'SEND_CTD_번역_세포치료제_마스터_추가정규화_v2.xlsx',
  '건기식_항목_마스터_통합_추가정규화_v2.xlsx',
  '화장품_항목_마스터_통합_추가정규화_v2.xlsx',
  '의료기기_생물학적안전성_항목_마스터_추가정규화_v2.xlsx',
  '스크리닝_항목_마스터_추가정규화_v2.xlsx',
  '심혈관계스크리닝_항목_마스터_추가정규화_v2.xlsx',
];

const HEADER_MAP = {
  detail:    ['상세 설명', '상세설명'],
  notice:    ['주의사항'],
  quoteText: ['원문(견적서)', '원문'],
  guidelineCore: ['가이드라인 핵심내용', '가이드라인'],
  ich:       ['ICH 가이드라인', 'ICH'],
  mfds:      ['MFDS 고시/기준', 'MFDS'],
  oecdTg:    ['OECD TG'],
};

function colIndex(headers, candidates) {
  for (const want of candidates) {
    const i = headers.findIndex(h => String(h ?? '').trim() === want);
    if (i >= 0) return i;
  }
  return -1;
}

function cellText(v) {
  if (v == null) return null;
  if (typeof v === 'object' && 'richText' in v) return v.richText.map(r => r.text).join('');
  return String(v).trim() || null;
}

async function buildDetailMap(filename) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(RAW_DIR, filename));
  const map = {}; // sheet → { id → {detail, notice, quoteText, guideline} }
  for (const ws of wb.worksheets) {
    const headers = ws.getRow(1).values;
    const idIdx = headers.findIndex(h => String(h ?? '').trim() === 'ID');
    if (idIdx < 0) continue;
    const cols = {};
    for (const [field, cands] of Object.entries(HEADER_MAP)) {
      cols[field] = colIndex(headers, cands);
    }
    if (Object.values(cols).every(i => i < 0)) continue;
    const sheetMap = {};
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      // JSON keys reference xlsx ROW NUMBER (see note in backfill-prices.js)
      const id = rowNum;
      const raw = {};
      for (const [field, idx] of Object.entries(cols)) {
        if (idx < 0) continue;
        const v = cellText(row.getCell(idx).value);
        if (v) raw[field] = v;
      }
      // Compose final entry: detail/notice/quoteText pass-through;
      // guideline is a composite of available regulatory references.
      const entry = {};
      if (raw.detail) entry.detail = raw.detail;
      if (raw.notice) entry.notice = raw.notice;
      if (raw.quoteText) entry.quoteText = raw.quoteText;
      const guideParts = [raw.guidelineCore, raw.oecdTg && `OECD TG: ${raw.oecdTg}`, raw.ich && `ICH: ${raw.ich}`, raw.mfds && `MFDS: ${raw.mfds}`].filter(Boolean);
      if (guideParts.length > 0) entry.guideline = guideParts.join(' · ');
      if (Object.keys(entry).length > 0) sheetMap[String(id)] = entry;
    });
    if (Object.keys(sheetMap).length > 0) {
      map[ws.name] = sheetMap;
      console.log(`  ${filename} :: [${ws.name}] enriched ${Object.keys(sheetMap).length} rows`);
    }
  }
  return map;
}

async function main() {
  const items = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  console.log(`Loaded ${items.length} items`);
  const allMaps = {};
  for (const src of SOURCES) {
    console.log(`\nReading ${src} ...`);
    allMaps[src] = await buildDetailMap(src);
  }

  let patched = 0;
  for (const it of items) {
    const [src, sheet, idTail] = it.key.split('#');
    if (!SOURCES.includes(src)) continue;
    const idFull = idTail.split('__')[0];
    // Strip route suffix from composite IDs like "6@경구" → "6" (used by 독성시험 master)
    const idBare = idFull.split('@')[0];
    const entry = allMaps[src]?.[sheet]?.[idFull] ?? allMaps[src]?.[sheet]?.[idBare];
    if (!entry) continue;
    for (const k of ['detail', 'notice', 'quoteText', 'guideline']) {
      if (entry[k]) it[k] = entry[k];
    }
    patched++;
  }
  console.log(`\nPatched ${patched} items with detail fields`);
  fs.writeFileSync(JSON_PATH, JSON.stringify(items, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
