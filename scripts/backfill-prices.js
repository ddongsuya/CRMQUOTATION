/**
 * Backfill priceMfds / priceOecd into data/test_items.json by re-reading the
 * modality-specific v2 master xlsx files. The normalization pipeline that built
 * test_items.json dropped the price columns for these masters; this script
 * patches them back in.
 *
 * Strategy:
 *   - For each v2 xlsx whose master rows are referenced in test_items.json,
 *     iterate every sheet, locate a price column (가격(원) or 3종(원) for 복합제),
 *     build a map: { sheet → { ID → price } }.
 *   - Walk test_items.json; for each entry whose key prefix matches and
 *     priceMfds == null, fill in priceMfds = priceOecd = the looked-up price.
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const RAW_DIR = 'G:/내 드라이브/데이터 정규화/데이터 정규화 (원문 + 주의사항)';
const JSON_PATH = path.join(__dirname, '..', 'data', 'test_items.json');

// Sources to backfill — keyed by the filename prefix used in test_items.json keys.
// 복합제 has tiered pricing (2종/3종/4종); we use 3종 as the canonical default
// (consistent with current 함량분석 logic that multiplies by max(excipientCount,1)).
const SOURCES = [
  '복합제_항목_마스터_추가정규화_v2.xlsx',
  '백신_항목_마스터_추가정규화_v2.xlsx',
  'SEND_CTD_번역_세포치료제_마스터_추가정규화_v2.xlsx',
  '건기식_항목_마스터_통합_추가정규화_v2.xlsx',
  '화장품_항목_마스터_통합_추가정규화_v2.xlsx',
  '의료기기_생물학적안전성_항목_마스터_추가정규화_v2.xlsx',
  '스크리닝_항목_마스터_추가정규화_v2.xlsx',
  '심혈관계스크리닝_항목_마스터_추가정규화_v2.xlsx',
];

const PRICE_COL_PRIORITY = ['3종(원)', '가격(원)', 'MFDS(원)', 'MFDS', 'mfds_price'];
const TIER_COLS = ['2종(원)', '3종(원)', '4종(원)']; // for 복합제 master

function pickPriceColIdx(headers) {
  for (const want of PRICE_COL_PRIORITY) {
    const i = headers.findIndex(h => String(h ?? '').trim() === want);
    if (i >= 0) return { idx: i, name: want };
  }
  return null;
}

function pickTierColIdxs(headers) {
  const result = {};
  for (const col of TIER_COLS) {
    const i = headers.findIndex(h => String(h ?? '').trim() === col);
    if (i >= 0) result[col[0]] = i; // key '2','3','4'
  }
  return Object.keys(result).length === TIER_COLS.length ? result : null;
}

function pickIdColIdx(headers) {
  const i = headers.findIndex(h => String(h ?? '').trim() === 'ID');
  return i;
}

async function buildPriceMap(filename) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(RAW_DIR, filename));
  const map = {}; // sheet → { id → { price, tiers? } }
  for (const ws of wb.worksheets) {
    const headerRow = ws.getRow(1).values;
    const priceCol = pickPriceColIdx(headerRow);
    const tierCols = pickTierColIdxs(headerRow);
    const idIdx = pickIdColIdx(headerRow);
    if (idIdx < 0 || (!priceCol && !tierCols)) continue;
    const sheetMap = {};
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      // IMPORTANT: test_items.json keys use the xlsx ROW NUMBER (1-indexed) as the
      // "id" portion, NOT the value of the ID column. The two differ by one in
      // most masters (header at row 1, ID col starts at 1 for data row 2).
      const id = rowNum;
      const entry = {};
      if (tierCols) {
        const tiers = {};
        for (const [k, idx] of Object.entries(tierCols)) {
          const v = row.getCell(idx).value;
          if (typeof v === 'number' && v > 0) tiers[k] = v;
        }
        if (Object.keys(tiers).length > 0) {
          entry.tiers = tiers;
          // sane single-value fallback = mid tier '3' (or whichever is present, in priority 3>2>4)
          entry.price = tiers['3'] ?? tiers['2'] ?? tiers['4'];
        }
      }
      if (entry.price == null && priceCol) {
        const v = row.getCell(priceCol.idx).value;
        if (typeof v === 'number' && v > 0) entry.price = v;
      }
      if (entry.price != null) sheetMap[String(id)] = entry;
    });
    if (Object.keys(sheetMap).length > 0) {
      map[ws.name] = sheetMap;
      const label = tierCols ? 'tiered(2종/3종/4종)' : `col="${priceCol.name}"`;
      console.log(`  ${filename} :: [${ws.name}] ${label} → ${Object.keys(sheetMap).length} rows priced`);
    }
  }
  return map;
}

async function main() {
  const items = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  console.log(`Loaded ${items.length} items from test_items.json`);

  const allMaps = {}; // filename → { sheet → { id → price } }
  for (const src of SOURCES) {
    console.log(`\nReading ${src} ...`);
    allMaps[src] = await buildPriceMap(src);
  }

  let patched = 0;
  let skippedNoMatch = 0;
  for (const it of items) {
    const [src, sheet, idTail] = it.key.split('#');
    if (!SOURCES.includes(src)) continue;
    // Strip route suffix and @-composite for 독성시험-style ids
    const id = idTail.split('__')[0].split('@')[0];
    const sheetMap = allMaps[src]?.[sheet];
    const entry = sheetMap?.[id];
    if (entry && typeof entry.price === 'number') {
      // Always rewrite for modality-specific masters — previous backfill keyed
      // by ID-column value, which was off-by-one against JSON's row-number ids.
      it.priceMfds = entry.price;
      it.priceOecd = entry.price;
      if (entry.tiers) it.priceTiers = entry.tiers; else delete it.priceTiers;
      patched++;
    } else {
      // No match: clear any stale (wrongly-backfilled) tiers
      if (it.priceTiers) delete it.priceTiers;
      skippedNoMatch++;
    }
  }

  console.log(`\nPatched ${patched} items, ${skippedNoMatch} unmatched`);
  fs.writeFileSync(JSON_PATH, JSON.stringify(items, null, 2));
  console.log(`Wrote ${JSON_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
