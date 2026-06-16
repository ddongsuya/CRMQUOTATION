/**
 * HWPML(.hwp XML) → 텍스트 추출.
 * MFDS 의약품등의 독성시험기준 고시 원문에서 본문 텍스트를 뽑는다.
 */
const fs = require('fs');
const path = require('path');

const IN = process.argv[2];
const OUT = path.join(__dirname, '..', 'data', '_guidelines_text', 'MFDS_독성시험기준.txt');

let raw = fs.readFileSync(IN, 'utf8');

// HWPML 본문: <P ...> 단락, 그 안에 <TEXT><CHAR>...</CHAR></TEXT>
// 단락 경계를 줄바꿈으로 보존하면서 텍스트만 추출
function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

const lines = [];
// 각 <P ...>...</P> 단락을 한 줄로
const paraRx = /<P\b[^>]*>([\s\S]*?)<\/P>/g;
let m;
while ((m = paraRx.exec(raw)) !== null) {
  const inner = m[1];
  // CHAR 태그 내용 수집 (없으면 TEXT 내 텍스트)
  const chars = [...inner.matchAll(/<CHAR[^>]*>([\s\S]*?)<\/CHAR>/g)].map(x => x[1]);
  let text = chars.length ? chars.join('') : inner.replace(/<[^>]+>/g, '');
  text = decode(text).replace(/\s+/g, ' ').trim();
  if (text) lines.push(text);
}

// 단락 추출이 비면 전체 태그 제거 fallback
let body = lines.join('\n');
if (body.length < 500) {
  body = decode(raw.replace(/<[^>]+>/g, '\n')).replace(/\n{2,}/g, '\n').trim();
}

fs.writeFileSync(OUT, `[SOURCE] MFDS 의약품등의 독성시험기준 고시 제2022-18호\n[CHARS] ${body.length}\n\n${body}`);
console.log(`✓ MFDS 추출 → ${OUT} (${body.length}자, ${lines.length}단락)`);
