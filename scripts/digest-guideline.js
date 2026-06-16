/**
 * 가이드라인 텍스트에서 "요구사항 관련 문단"만 추출하여 digest 생성.
 * 전문을 다 읽지 않고 체크리스트 작성에 필요한 핵심만 뽑는다.
 *
 * 사용: node scripts/digest-guideline.js <code>
 * 입력: data/_guidelines_text/<code>.txt
 * 출력: data/_guidelines_digest/<code>.txt  (콘솔에도 출력)
 */
const fs = require('fs');
const path = require('path');

const code = process.argv[2];
if (!code) { console.error('usage: <code>'); process.exit(1); }

const IN = path.join(__dirname, '..', 'data', '_guidelines_text', code + '.txt');
const OUTDIR = path.join(__dirname, '..', 'data', '_guidelines_digest');
fs.mkdirSync(OUTDIR, { recursive: true });

const raw = fs.readFileSync(IN, 'utf8');
const sourceUrl = (raw.match(/\[SOURCE URL\]\s*(.+)/) || [])[1] || '';
const body = raw.replace(/^\[SOURCE URL\][^\n]*\n\[CHARS\][^\n]*\n\n/, '');

// 문단 분리 (빈 줄 또는 번호 매김 기준)
const paras = body.split(/\n\s*\n|\n(?=\d{1,3}\.\s)/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 30);

// 요구사항 키워드 (영문 가이드라인 기준)
const KW = [
  // 시험계/동물
  /\b(at least|minimum of|five strains|strains? (should|of)|cell lines?|TK6|L5178Y|animals? (per|of|should)|per group|per (dose|concentration)|\/sex|rodents?|mice|rats?)\b/i,
  // 농도/용량
  /\b(concentrations?|dose(s| levels?| range)?|mg\/plate|µl\/plate|mg\/kg|highest (dose|concentration)|maximum (dose|concentration|tolerated)|limit dose|analysable concentrations?)\b/i,
  // 기간/노출
  /\b(treatment (period|duration|time)|exposure (period|time|duration)|administration|hours?|incubat\w+|sampling time|harvest|for \d+ (h|hours|days|weeks))\b/i,
  // 대조군
  /\b(positive control|negative control|vehicle control|solvent control|concurrent control|untreated control)\b/i,
  // 대사활성
  /\b(metabolic activation|S9|post-mitochondrial|exogenous metabolic)\b/i,
  // 반복
  /\b(replicate|duplicate|triplicate|parallel cultures?|in duplicate|in triplicate)\b/i,
  // 판정/허용기준
  /\b(acceptance criteria|valid(ity)?|positive (result|response)|negative result|criteria for|considered (positive|negative|clearly))\b/i,
  // 시험물질 농도분석 (함량분석 관련)
  /\b(concentration of the test|stability|homogeneity|purity|analy[sz]ed|formulation|actual concentration|precipitat\w+|solubility)\b/i,
];

const picked = [];
const seen = new Set();
for (const p of paras) {
  let hits = 0;
  for (const rx of KW) if (rx.test(p)) hits++;
  if (hits >= 2) {                       // 2개 이상 키워드 매칭 문단만
    const k = p.slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(p.length > 600 ? p.slice(0, 600) + '…' : p);
  }
}

// 앞부분 INTRODUCTION/purpose 문단도 1~2개 포함
const intro = paras.slice(0, 6).filter(p => /\b(purpose|principle|detect|identif|evaluat|assess|measur)\b/i.test(p)).slice(0, 2);

const out = [
  `# ${code} digest`,
  `SOURCE: ${sourceUrl}`,
  `(원문 ${body.length}자 → 핵심 ${picked.length}문단 추출)`,
  '',
  '## 목적/원리',
  ...intro.map(p => '- ' + (p.length > 400 ? p.slice(0, 400) + '…' : p)),
  '',
  '## 요구사항 관련 문단',
  ...picked.map((p, i) => `[${i + 1}] ${p}`),
].join('\n');

const outPath = path.join(OUTDIR, code + '.txt');
fs.writeFileSync(outPath, out);
console.log(`✓ ${code} digest → ${picked.length}문단 (${out.length}자) → ${outPath}`);
