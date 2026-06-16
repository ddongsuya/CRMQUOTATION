/**
 * Backfill — studyWeeks 의미 정정.
 *
 * 배경 (F-1):
 *   test_items.json 의 기존 `studyWeeks` 는 사실 "견적 진행 기간"(= 동물입고~
 *   최종보고서 제출, 보고서 작성 ~4주 포함) 값이었다. 그런데 suggest.ts /
 *   assemble.js 는 `studyWeeks` 를 "실제 시험 투여 주차"로 가정하여 함량분석
 *   회수·TK 기간 매칭에 사용 → 회수 과다 산출 등 오류.
 *
 * 이 스크립트는:
 *   1. 기존 studyWeeks 값을 `quoteWeeks` 로 보존 (견적서 "기간(주)" 표시용 — 정당한 데이터)
 *   2. `studyWeeks` 를 testName 에서 파싱한 *실제 시험 투여 주차* 로 재설정
 *      - "1주"/"13주" → 1/13
 *      - "단회"/"일회"/"급성" → 0
 *      - 비정형(임신 N-day, 감작 등) → null  ← 사용자가 견적 UI 에서 직접 입력
 *
 * 설계 원칙 (사용자 합의 2026-05):
 *   비임상시험은 변수가 많아 모든 케이스를 자동 정형화할 수 없다. 자동 파싱이
 *   불확실한 항목은 추측하지 않고 null 로 두어 사용자 수동 입력 대상으로 넘긴다.
 *
 * 멱등(idempotent): 재실행해도 quoteWeeks 원본을 보존 (이미 분리됐으면 그대로).
 *
 * Run: `node scripts/backfill-study-weeks.js`
 *      (backfill-prices.js / backfill-detail.js 이후 실행 권장)
 */
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '..', 'data', 'test_items.json');

/**
 * testName 에서 실제 시험 투여 주차를 파싱.
 * @returns {{ weeks: number|null, basis: string }}
 *   weeks: 정수 주차 / 0(단회) / null(비정형 — 사용자 입력 필요)
 *   basis: 파싱 근거 (디버그·리포트용)
 */
function parseStudyWeeks(testName) {
  const name = String(testName || '').trim();
  if (!name) return { weeks: null, basis: 'empty' };

  // 단회/급성 — 투여 1회
  if (/단회|일회|급성|1회 투여|단일 투여/.test(name)) {
    // "단회 투여 후 13주 관찰" 같은 케이스: 투여는 단회지만 관찰기간이 있음.
    // 함량분석·매칭 관점에서 투여 주차는 0.
    return { weeks: 0, basis: 'single-dose' };
  }

  // in vitro / 분석 / 채널 스크리닝 — 동물 투여 없음 → 0
  if (/조제물\s*분석|함량\s*분석|Validation|Ames|복귀돌연변이|염색체이상|소핵|MLA|Comet|hERG|Cav|Nav|MEA|세포독성|3T3|RhE|RhCE|in vitro/i.test(name)) {
    return { weeks: 0, basis: 'in-vitro/analysis' };
  }

  // "N주" 패턴 — 첫 번째 매치를 시험 투여 주차로 (회복군의 "13주 반복 4주 회복" → 13)
  const m = name.match(/(\d+)\s*주/);
  if (m) return { weeks: Number(m[1]), basis: `regex:${m[1]}주` };

  // 비정형 — 임신 N-day, 감작, 야기 등 → 사용자 입력 필요
  return { weeks: null, basis: 'non-standard' };
}

function main() {
  const items = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  console.log(`Loaded ${items.length} items`);

  const stats = { quoteWeeksPreserved: 0, studyWeeksSet: 0, studyWeeksNull: 0, byBasis: {} };
  const needsManualInput = [];

  for (const it of items) {
    // 1) quoteWeeks 보존 (멱등: 이미 분리됐으면 기존 quoteWeeks 유지)
    const originalQuote = (it.quoteWeeks !== undefined && it.quoteWeeks !== null)
      ? it.quoteWeeks
      : it.studyWeeks;          // 최초 실행: 기존 studyWeeks = 견적 진행 기간
    it.quoteWeeks = originalQuote ?? null;
    if (it.quoteWeeks != null) stats.quoteWeeksPreserved++;

    // 2) studyWeeks 재설정 (testName 파싱)
    const { weeks, basis } = parseStudyWeeks(it.testName);
    it.studyWeeks = weeks;
    stats.byBasis[basis] = (stats.byBasis[basis] || 0) + 1;
    if (weeks == null) {
      stats.studyWeeksNull++;
      needsManualInput.push({ key: it.key, testName: it.testName });
    } else {
      stats.studyWeeksSet++;
    }
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(items, null, 2));

  console.log('');
  console.log('── 결과 ──');
  console.log(`  quoteWeeks 보존:       ${stats.quoteWeeksPreserved}`);
  console.log(`  studyWeeks 설정(숫자): ${stats.studyWeeksSet}`);
  console.log(`  studyWeeks = null:     ${stats.studyWeeksNull}  ← 견적 UI 에서 사용자 직접 입력 대상`);
  console.log('');
  console.log('── 파싱 근거 분포 ──');
  for (const [b, n] of Object.entries(stats.byBasis).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${b.padEnd(22)} ${n}`);
  }
  if (needsManualInput.length > 0) {
    console.log('');
    console.log(`── 비정형 (studyWeeks=null) 샘플 — 최대 15건 ──`);
    for (const x of needsManualInput.slice(0, 15)) {
      console.log(`  ${(x.testName || '').slice(0, 50)}`);
    }
    if (needsManualInput.length > 15) console.log(`  ... +${needsManualInput.length - 15}건`);
  }
  console.log('');
  console.log(`Wrote ${JSON_PATH}`);
}

main();
