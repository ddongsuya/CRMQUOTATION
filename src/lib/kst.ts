/**
 * 서버용 한국시간(KST, UTC+9) 경계 계산.
 *
 * 왜 필요한가: Vercel 서버는 UTC 로 돈다. `new Date(y, m, d)`·`setHours(0)`·`getDay()` 같은 로컬 시각 API 를
 * 서버에서 쓰면 '오늘'·'이번 주'가 UTC 기준이 되어, KST 0~9시 사이에는 전날로 잡히고(오늘 일정이 비고,
 * 월요일 아침 주간 완료 수가 지난주 것으로 집계) 히트맵 요일 칸이 하루씩 밀린다.
 * 한국은 서머타임이 없으므로 고정 +9시간 오프셋으로 충분하다.
 * (브라우저용 표기는 src/lib/dates.ts — 사용자 PC 로컬 시각이 곧 KST 라 그대로 둔다.)
 *
 * 외부 import 가 없는 순수 함수 — node 테스트에서 직접 require 한다.
 */

export const KST_OFFSET_MS = 9 * 3600_000;
const DAY_MS = 86_400_000;

/** KST 달력 기준 yy·mm (견적번호 접두사용) */
export function kstYearMonth(now: Date): { yy: string; mm: string } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return { yy: String(kst.getUTCFullYear() % 100).padStart(2, '0'), mm: String(kst.getUTCMonth() + 1).padStart(2, '0') };
}

/** now 가 속한 KST 날짜의 00:00(KST) 순간. addDays 로 앞뒤 날짜 경계를 구한다 (내일 0시 = addDays 1). */
export function kstDayStart(now: Date, addDays = 0): Date {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + addDays) - KST_OFFSET_MS);
}

/** KST 요일 (0=일 … 6=토) */
export function kstWeekday(d: Date): number {
  return new Date(d.getTime() + KST_OFFSET_MS).getUTCDay();
}

/** now 가 속한 주(월요일 시작)의 월요일 00:00(KST) 순간 */
export function kstWeekStart(now: Date): Date {
  const mondayOffset = (kstWeekday(now) + 6) % 7;   // 월=0 … 일=6
  return new Date(kstDayStart(now).getTime() - mondayOffset * DAY_MS);
}
