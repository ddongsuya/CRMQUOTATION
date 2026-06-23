/**
 * 시험 일정 간트차트 스케줄러 (회사 실무 규칙).
 *
 * 동물실험기간 = quoteWeeks − 순화(1주) − 보고서(반복·회복 8주 / 그 외 4주).
 *   · 조제물분석: 예비1 + 본시험3 = 4주(고정) + 보고서 4주.
 *   · TK: quoteWeeks 안에 TK validation(생체시료분석) 4주가 포함 → 동물 = qw−1−4−4.
 * 배치(critical path):
 *   조제물 본시험 끝(=4주) ┬ 단회 → DRF → TK Validation(4주) → 반복(회복)+TK 동시
 *                          └ 유전독성 · 안전성약리 (조제물 끝 시점 시작)
 *   같은 역할의 설치류·비설치류는 같은 시점에 시작(병렬), 각자 길이만큼.
 *
 * 모든 길이는 기본값일 뿐, 사용자가 직접 편집할 수 있다(커스텀 간트 도구).
 */

export type GanttRole = 'PREP' | 'SINGLE' | 'DRF' | 'REPEAT' | 'TK' | 'GENOTOX' | 'SAFETY' | 'OTHER';

export type GanttTask = {
  id: string;
  name: string;
  role: GanttRole;
  animalWeeks: number;   // 동물실험기간 (바 본체)
  reportWeeks: number;   // 보고서 작성기간 (꼬리)
};

export type ScheduledBar = GanttTask & {
  startWeek: number;         // 동물실험 시작 (주)
  endWeek: number;           // 동물실험 끝
  validationStart?: number;  // TK validation(생체시료분석) 4주 블록 시작 (TK만)
};

export const ROLE_LABEL: Record<GanttRole, string> = {
  PREP: '조제물분석', SINGLE: '단회', DRF: 'DRF', REPEAT: '반복·회복', TK: 'TK', GENOTOX: '유전독성', SAFETY: '안전성약리', OTHER: '기타',
};

const TK_VALIDATION_WEEKS = 4;
const PREP_ANIMAL_WEEKS = 4;   // 예비1 + 본시험3
const PREP_REPORT_WEEKS = 4;

/** 시험명 → 역할 분류 */
export function classifyRole(name: string): GanttRole {
  const n = name || '';
  if (/조제물\s*분석|함량\s*분석/.test(n)) return 'PREP';
  if (/유전독성|Ames|에임스|소핵|염색체이상|코멧|복귀돌연변이|TG\s?4[789]\d/i.test(n)) return 'GENOTOX';
  if (/안전성\s*약리|hERG|중추신경|호흡기|심혈관|텔레메|telemetry|IKr|\bQT\b/i.test(n)) return 'SAFETY';
  if (/\bTK\b|독성동태|tk\(/i.test(n)) return 'TK';
  if (/DRF|용량\s*결정|용량설정/i.test(n)) return 'DRF';
  if (/회복|반복\s*투여|반복투여/.test(n)) return 'REPEAT';
  if (/단회|급성|일회/.test(n)) return 'SINGLE';
  return 'OTHER';
}

/** quoteWeeks(견적기간) → 기본 동물기간·보고서기간. quoteWeeks 없으면 역할별 fallback. */
export function defaultDurations(role: GanttRole, quoteWeeks: number | null | undefined): { animalWeeks: number; reportWeeks: number } {
  if (role === 'PREP') return { animalWeeks: PREP_ANIMAL_WEEKS, reportWeeks: PREP_REPORT_WEEKS };
  const report = role === 'REPEAT' ? 8 : 4;
  const qw = (quoteWeeks != null && quoteWeeks > 0) ? quoteWeeks : null;
  if (qw == null) {
    // 견적기간 없는 시험 fallback(편집 가능): 단회 2 / 유전·약리 4 / 기타 4
    const fb: Record<GanttRole, number> = { PREP: 4, SINGLE: 2, DRF: 4, REPEAT: 13, TK: 13, GENOTOX: 4, SAFETY: 7, OTHER: 4 };
    return { animalWeeks: fb[role], reportWeeks: report };
  }
  const subtract = 1 + report + (role === 'TK' ? TK_VALIDATION_WEEKS : 0); // 순화1 + 보고서 (+ TK validation4)
  return { animalWeeks: Math.max(1, qw - subtract), reportWeeks: report };
}

/**
 * 배치 — 각 시험의 동물실험 startWeek 계산.
 * 역할 그룹별 끝나는 시점을 기준으로 다음 그룹을 잇는다.
 */
export function schedule(tasks: GanttTask[]): ScheduledBar[] {
  const by = (r: GanttRole) => tasks.filter(t => t.role === r);
  const groupEnd = (start: number, list: GanttTask[]) => list.length ? Math.max(...list.map(t => start + t.animalWeeks)) : start;

  // 조제물분석: 0주 시작, 본시험 끝 = animalWeeks(기본 4)
  const prep = by('PREP');
  const prepEnd = prep.length ? Math.max(...prep.map(t => t.animalWeeks)) : PREP_ANIMAL_WEEKS;
  const anchor = prep.length ? prepEnd : 0;   // 조제물 없으면 0주부터

  const single = by('SINGLE');
  const singleEnd = groupEnd(anchor, single);

  const drf = by('DRF');
  const drfStart = single.length ? singleEnd : anchor;
  const drfEnd = groupEnd(drfStart, drf);

  const tk = by('TK');
  const tkValStart = drf.length ? drfEnd : drfStart;            // DRF 끝 → TK validation
  const tkValEnd = tk.length ? tkValStart + TK_VALIDATION_WEEKS : tkValStart;

  const repeat = by('REPEAT');
  const repeatStart = tk.length ? tkValEnd : (drf.length ? drfEnd : anchor);

  const place = (t: GanttTask, start: number, extra?: Partial<ScheduledBar>): ScheduledBar =>
    ({ ...t, startWeek: start, endWeek: start + t.animalWeeks, ...extra });

  const out: ScheduledBar[] = [];
  for (const t of tasks) {
    switch (t.role) {
      case 'PREP': out.push(place(t, 0)); break;
      case 'GENOTOX':
      case 'SAFETY': out.push(place(t, anchor)); break;
      case 'SINGLE': out.push(place(t, anchor)); break;
      case 'DRF': out.push(place(t, drfStart)); break;
      case 'TK': out.push(place(t, repeatStart, { validationStart: tkValStart })); break;
      case 'REPEAT': out.push(place(t, repeatStart)); break;
      default: out.push(place(t, anchor)); break;
    }
  }
  return out;
}

/** 전체 일정 길이(주) — 동물 + 보고서 최대 끝. */
export function totalWeeks(bars: ScheduledBar[]): number {
  if (!bars.length) return 0;
  return Math.max(...bars.map(b => b.endWeek + b.reportWeeks));
}
