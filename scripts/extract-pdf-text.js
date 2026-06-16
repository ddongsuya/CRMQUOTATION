/**
 * 로컬 PDF → 텍스트 추출 (pdf-parse).
 * 사용: node scripts/extract-pdf-text.js "<code>" "<pdf경로>"
 * 출력: data/_guidelines_text/<code>.txt
 */
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const [code, inPath] = process.argv.slice(2);
if (!code || !inPath) { console.error('usage: <code> <pdf path>'); process.exit(1); }
const OUT = path.join(__dirname, '..', 'data', '_guidelines_text', code + '.txt');

(async () => {
  const parser = new PDFParse({ data: fs.readFileSync(inPath) });
  const r = await parser.getText();
  fs.writeFileSync(OUT, `[SOURCE] ${path.basename(inPath)}\n[CHARS] ${r.text.length}\n\n${r.text}`);
  console.log(`✓ ${code} → ${OUT} (${r.text.length}자)`);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
