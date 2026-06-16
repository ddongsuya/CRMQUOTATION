/**
 * Extract test items + prices from the legacy 2025 standard-quote xlsx files.
 *
 * These are actual quote documents (not normalized masters), so each sheet has:
 *   - a header block (견적서, 의뢰기관, 견적가 등)
 *   - a table starting at a "번호 | 시험항목 | 동물종 | 투여기간 | 투여경로 | 기간 | 가격(원)" row
 *
 * Strategy per sheet:
 *   1. Find the table header row (contains both "시험항목" and "가격")
 *   2. Map columns: 번호 / 시험항목 / 동물종 / 투여기간 / 투여경로 / 기간(주) / 가격(원)
 *   3. Read each data row until blank/footer
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DIR = 'G:/내 드라이브/2026년 표준견적서/2025년 표준견적서';
const OUT = path.join(__dirname, '..', 'data', '_extracted_2025_quotes.json');

function ct(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map(r => r.text).join('');
    if ('result' in v) return v.result;
    if ('text' in v) return v.text;
    if ('formula' in v) return null; // skip formula cells we can't resolve
    return null;
  }
  return v;
}
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function findHeaderRow(ws) {
  for (let i = 1; i <= Math.min(ws.rowCount, 40); i++) {
    const row = ws.getRow(i);
    let hasItem = false, hasPrice = false, hasNo = false;
    for (let c = 1; c <= 25; c++) {
      const t = norm(ct(row.getCell(c).value));
      if (/시험\s*항목|시험항목/.test(t)) hasItem = true;
      if (/가격|금액|단가/.test(t)) hasPrice = true;
      if (/^번호$|^No\.?$/i.test(t)) hasNo = true;
    }
    if (hasItem && (hasPrice || hasNo)) return i;
  }
  return -1;
}

function mapColumns(ws, headerRow) {
  const row = ws.getRow(headerRow);
  const cols = {};
  for (let c = 1; c <= 30; c++) {
    const t = norm(ct(row.getCell(c).value));
    if (!t) continue;
    if (cols.no == null && /^번호$|^No/i.test(t)) cols.no = c;
    else if (cols.item == null && /시험\s*항목|시험항목/.test(t)) cols.item = c;
    else if (cols.species == null && /동물종|동물\s*종/.test(t)) cols.species = c;
    else if (cols.duration == null && /투여\s*기간/.test(t)) cols.duration = c;
    else if (cols.route == null && /투여\s*경로/.test(t)) cols.route = c;
    else if (cols.weeks == null && /기간.*주|주\)/.test(t)) cols.weeks = c;
    else if (cols.price == null && /가격|금액|단가/.test(t)) cols.price = c;
  }
  return cols;
}

function extractSheet(ws) {
  const headerRow = findHeaderRow(ws);
  if (headerRow < 0) return { items: [], headerRow: -1 };
  const cols = mapColumns(ws, headerRow);
  if (cols.item == null) return { items: [], headerRow, cols };

  const items = [];
  let blanks = 0;
  for (let i = headerRow + 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const item = norm(ct(row.getCell(cols.item).value));
    // price: scan a small window around the mapped price col (merged cells)
    let price = null;
    if (cols.price != null) {
      for (let c = cols.price; c <= cols.price + 2; c++) {
        const v = ct(row.getCell(c).value);
        if (typeof v === 'number' && v > 0) { price = v; break; }
      }
    }
    if (!item) {
      if (++blanks > 4) break;
      continue;
    }
    blanks = 0;
    // skip footer-ish rows
    if (/합\s*계|소\s*계|총\s*액|부가세|VAT|비고|특이사항|안내|※/.test(item)) continue;
    items.push({
      no: cols.no ? ct(row.getCell(cols.no).value) : null,
      testName: item.length > 120 ? item.slice(0, 120) + '…' : item,
      testNameFull: item,
      species: cols.species ? norm(ct(row.getCell(cols.species).value)) : null,
      duration: cols.duration ? norm(ct(row.getCell(cols.duration).value)) : null,
      route: cols.route ? norm(ct(row.getCell(cols.route).value)) : null,
      weeks: cols.weeks ? ct(row.getCell(cols.weeks).value) : null,
      price,
    });
  }
  return { items, headerRow, cols };
}

async function main() {
  const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'));
  const report = [];
  for (const f of files) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(DIR, f));
      const sheets = [];
      for (const ws of wb.worksheets) {
        const { items, cols } = extractSheet(ws);
        sheets.push({ sheet: ws.name, itemCount: items.length, cols, items });
      }
      const total = sheets.reduce((s, sh) => s + sh.itemCount, 0);
      const priced = sheets.reduce((s, sh) => s + sh.items.filter(i => i.price != null).length, 0);
      report.push({ fileName: f, totalItems: total, pricedItems: priced, sheets });
      console.log(`✓ ${f.slice(0, 50).padEnd(50)} 항목 ${total} (가격 ${priced})`);
    } catch (e) {
      console.log(`✗ ${f} — ${e.message}`);
      report.push({ fileName: f, error: e.message });
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  const grandTotal = report.reduce((s, r) => s + (r.totalItems || 0), 0);
  const grandPriced = report.reduce((s, r) => s + (r.pricedItems || 0), 0);
  console.log(`\n총 항목 ${grandTotal}개 (가격 보유 ${grandPriced}개) → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
