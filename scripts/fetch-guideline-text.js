/**
 * 가이드라인 PDF 다운로드 + 텍스트 추출.
 * 사용: node scripts/fetch-guideline-text.js "<code>" "<url>"
 * 출력: data/_guidelines_text/<code>.txt
 *
 * OECD/ICH 공식 PDF를 직접 받아 pdf-parse 로 텍스트만 뽑아 저장한다.
 * (이미지 렌더링 없이 토큰 절약)
 */
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTDIR = path.join(__dirname, '..', 'data', '_guidelines_text');
fs.mkdirSync(OUTDIR, { recursive: true });

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (research; quote-master-build)' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const [code, url] = process.argv.slice(2);
  if (!code || !url) { console.error('usage: <code> <url>'); process.exit(1); }
  const buf = await download(url);
  const parser = new PDFParse({ data: buf });
  const r = await parser.getText();
  const outPath = path.join(OUTDIR, code.replace(/[^\w가-힣().-]/g, '_') + '.txt');
  fs.writeFileSync(outPath, `[SOURCE URL] ${url}\n[CHARS] ${r.text.length}\n\n${r.text}`);
  console.log(`✓ ${code} → ${outPath} (${r.text.length}자)`);
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
