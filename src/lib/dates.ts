/**
 * 날짜 표기 단일화. 화면마다 '2026-09-02' · '9/2' · '9월 2일' · '26.09.02' 가 섞여 있던 것을 세 가지로 고정한다.
 *
 *   fmtDate(x)       → '2026-09-02'        목록·표·입력값 (항상 이 형식)
 *   fmtDateShort(x)  → '9월 2일'            카드·타임라인 같은 좁은 곳(연도는 올해가 아닐 때만 붙음: '2025년 9월 2일')
 *   fmtDateTime(x)   → '2026-09-02 14:30'   기록·미팅 시각
 *   fmtDateLong(x)   → '2026년 9월 2일 (수)' 홈 헤더·문서
 *   dDay(x)          → 'D-3' | 'D-Day' | 'D+2'
 *
 * 모두 로컬(KST) 기준. 입력은 Date | ISO 문자열 | null 을 받고, 비어 있으면 '—' 를 돌려준다.
 * 저장용(ISO yyyy-mm-dd, 로컬 기준)은 toYmd 를 쓴다 — toISOString().slice(0,10) 은 UTC 라 하루가 밀린다.
 */

export type DateLike = Date | string | number | null | undefined;

const EMPTY = '—';

export function toDate(x: DateLike): Date | null {
  if (x == null || x === '') return null;
  const d = x instanceof Date ? x : new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 로컬 기준 yyyy-mm-dd (저장·input[type=date] 값·비교 키) */
export function toYmd(x: DateLike): string {
  const d = toDate(x);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 오늘(로컬) yyyy-mm-dd */
export const todayYmd = () => toYmd(new Date());

export function fmtDate(x: DateLike, empty = EMPTY): string {
  const s = toYmd(x);
  return s || empty;
}

export function fmtDateShort(x: DateLike, empty = EMPTY): string {
  const d = toDate(x);
  if (!d) return empty;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}월 ${d.getDate()}일`
    : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function fmtTime(x: DateLike, empty = EMPTY): string {
  const d = toDate(x);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : empty;
}

export function fmtDateTime(x: DateLike, empty = EMPTY): string {
  const d = toDate(x);
  return d ? `${toYmd(d)} ${fmtTime(d)}` : empty;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
export function fmtDateLong(x: DateLike, empty = EMPTY): string {
  const d = toDate(x);
  return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})` : empty;
}

/** 두 날짜의 로컬 자정 기준 일수 차이 (a - b), 기본 b = 오늘 */
export function diffDays(a: DateLike, b: DateLike = new Date()): number | null {
  const da = toDate(a), db = toDate(b);
  if (!da || !db) return null;
  const A = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
  const B = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime();
  return Math.round((A - B) / 86400000);
}

/** D-day 표기: 대상일이 오늘이면 D-Day, 미래면 D-n, 과거면 D+n */
export function dDay(x: DateLike, empty = EMPTY): string {
  const n = diffDays(x);
  if (n == null) return empty;
  if (n === 0) return 'D-Day';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

/** 상대 표기(기록 타임라인용): 오늘·어제·n일 전·그 외 fmtDateShort */
export function fmtRelative(x: DateLike, empty = EMPTY): string {
  const n = diffDays(x);
  if (n == null) return empty;
  if (n === 0) return '오늘';
  if (n === -1) return '어제';
  if (n === 1) return '내일';
  if (n < 0 && n >= -6) return `${-n}일 전`;
  if (n > 0 && n <= 6) return `${n}일 후`;
  return fmtDateShort(x, empty);
}
