/**
 * One-off analysis of the legacy 2025 standard-quote xlsx files.
 * Extracts per-file structure: sheets, headers, row counts, detected price
 * columns, and a few sample rows. Writes a JSON report + prints a summary.
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DIR = 'G:/내 드라이브/2026년 표준견적서/2025년 표준견적서';
const OUT = path.join(__dirname, '..', 'data', '_analysis_2025_quotes.json');

function cellText(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map(r => r.text).join('');
    if ('text' in v) return v.text;
    if ('result' in v) return v.result;
    if ('formula' in v) return `=${v.formula}`;
    return JSON.stringify(v);
  }
  return v;
}

function rowValues(row) {
  const out = [];
  row.eachCell({ includeEmpty: true }, (cell, col) => { out[col] = cellText(cell.value); });
  return out;
}

const PRICE_RX = /가격|금액|단가|원\)|MFDS|OECD|\(원/;

async function analyzeFile(filePath, fileName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheets = [];
  for (const ws of wb.worksheets) {
    // Find the header row: first row with >= 3 non-empty cells
    let headerRowNum = 1;
    for (let i = 1; i <= Math.min(ws.rowCount, 15); i++) {
      const vals = rowValues(ws.getRow(i)).filter(Boolean);
      if (vals.length >= 3) { headerRowNum = i; break; }
    }
    const headers = rowValues(ws.getRow(headerRowNum)).filter(Boolean);
    const priceCols = headers.filter(h => PRICE_RX.test(String(h)));

    // sample up to 4 data rows after header
    const samples = [];
    for (let i = headerRowNum + 1; i <= Math.min(ws.rowCount, headerRowNum + 6) && samples.length < 4; i++) {
      const vals = rowValues(ws.getRow(i)).filter(Boolean);
      if (vals.length >= 2) samples.push(vals.slice(0, 10));
    }

    // count non-empty data rows
    let dataRows = 0;
    for (let i = headerRowNum + 1; i <= ws.rowCount; i++) {
      if (rowValues(ws.getRow(i)).filter(Boolean).length >= 2) dataRows++;
    }

    sheets.push({
      name: ws.name,
      headerRowNum,
      rowCount: ws.rowCount,
      dataRows,
      headers,
      priceColumns: priceCols,
      samples,
    });
  }
  return { fileName, sheets };
}

async function main() {
  const files = fs.readdirSync(DIR)
    .filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'));
  const report = [];
  for (const f of files) {
    try {
      const r = await analyzeFile(path.join(DIR, f), f);
      report.push(r);
      const totalRows = r.sheets.reduce((s, sh) => s + sh.dataRows, 0);
      console.log(`✓ ${f}`);
      console.log(`    시트 ${r.sheets.length}개 · 데이터 ${totalRows}행`);
      for (const sh of r.sheets) {
        console.log(`    └ [${sh.name}] ${sh.dataRows}행 · 가격컬럼: ${sh.priceColumns.length ? sh.priceColumns.join(', ') : '없음'}`);
      }
    } catch (e) {
      console.log(`✗ ${f} — ${e.message}`);
      report.push({ fileName: f, error: e.message });
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n총 ${files.length}개 파일 분석 완료 → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
