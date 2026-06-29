/**
 * 견적 라인 정립 순서 (assemble.js KIND_ORDER + suggest.ts rank + testGroupOrder 통합).
 *   조제물분석 → 함량분석 → 단회 → DRF → 본시험(반복) → 회복군 → TK
 *   → 유전독성 → 안전성약리 → 종양원성/체내분포/면역원성 → 생식/발암
 *   각 종류 안에서: 설치류 → 비설치류 → 기간(주) 오름차순
 */
import type { LineItem } from './types';

function kindRank(li: LineItem): number {
  const n = li.testName ?? '';
  const r = li.appliedRules.join(' ');
  if (r.includes('R8') || /조제물\s*분석/.test(n)) return 0;
  if (r.includes('R2') || /함량\s*분석/.test(n)) return 1;
  if (/단회|일회|급성/.test(n)) return 2;
  if (/DRF|예비|용량결정/.test(n)) return 3;
  if (/회복/.test(n)) return 5;                       // 본시험(4)보다 뒤 — '반복'보다 먼저 판정
  if (/\bTK\b|독성동태|PK\/TK/i.test(n)) return 6;
  if (/유전독성|Ames|TG\s?4[789]\d?|소핵|염색체이상|복귀돌연변이|MLA|Comet/i.test(n)) return 7;
  if (/안전성약리|hERG|중추신경|호흡기|심혈관|Telemetry|텔레메|CNS/i.test(n)) return 8;
  if (/종양원성|체내분포|생체분포|면역원성/.test(n)) return 9;
  if (/생식|배태자|발암/.test(n)) return 10;
  if (/반복/.test(n)) return 4;                       // 본시험
  return 50;
}
function speciesRank(n: string): number {
  if (/비설치류|비글|토끼|원숭이|monkey|미니피그|개\b|non-?rodent/i.test(n)) return 1;
  if (/설치류|랫|마우스|rat|mouse|rodent/i.test(n)) return 0;
  return 0.5;
}
function weeksOf(n: string): number {
  const m = n.match(/(\d+)\s*주/);
  return m ? Number(m[1]) : 0;
}

/** 정립 순서로 정렬(안정). 원본 배열을 변형하지 않음. */
export function sortLines(lines: LineItem[]): LineItem[] {
  return lines
    .map((li, i) => ({ li, i }))
    .sort((a, b) => {
      const ka = kindRank(a.li), kb = kindRank(b.li);
      if (ka !== kb) return ka - kb;
      const sa = speciesRank(a.li.testName ?? ''), sb = speciesRank(b.li.testName ?? '');
      if (sa !== sb) return sa - sb;
      const wa = weeksOf(a.li.testName ?? ''), wb = weeksOf(b.li.testName ?? '');
      if (wa !== wb) return wa - wb;
      return a.i - b.i;
    })
    .map(x => x.li);
}
