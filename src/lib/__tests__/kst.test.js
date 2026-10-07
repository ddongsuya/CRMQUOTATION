/**
 * KST 경계 헬퍼 (src/lib/kst.ts) — 서버가 UTC 여도 '오늘'·'이번 주'·견적번호 월이 한국시간 기준인지.
 * 순수 TS(외부 import 없음)라 node 타입 스트리핑으로 직접 require.
 * 입력은 모두 UTC 시각으로 고정 — 실행 머신의 TZ 와 무관해야 한다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { kstDayStart, kstWeekStart, kstWeekday, kstYearMonth } = require('../kst.ts');

const iso = d => d.toISOString();

test('KST 00:30 (= 전날 UTC 15:30) 의 오늘은 KST 날짜 기준', () => {
  const now = new Date('2026-10-06T15:30:00Z');            // KST 2026-10-07(수) 00:30
  assert.equal(iso(kstDayStart(now)), '2026-10-06T15:00:00.000Z');      // KST 10-07 00:00
  assert.equal(iso(kstDayStart(now, 1)), '2026-10-07T15:00:00.000Z');   // KST 10-08 00:00
});

test('KST 23:59 는 아직 같은 날', () => {
  const now = new Date('2026-10-07T14:59:00Z');            // KST 10-07 23:59
  assert.equal(iso(kstDayStart(now)), '2026-10-06T15:00:00.000Z');
});

test('월요일 KST 08:00 (UTC 로는 일요일) → 이번 주 = 그 월요일 00:00 KST', () => {
  const now = new Date('2026-10-04T23:00:00Z');            // KST 2026-10-05(월) 08:00, UTC 는 일요일
  assert.equal(kstWeekday(now), 1);
  assert.equal(iso(kstWeekStart(now)), '2026-10-04T15:00:00.000Z');     // KST 10-05 00:00
});

test('일요일 KST 23:00 → 이번 주 = 6일 전 월요일', () => {
  const now = new Date('2026-10-11T14:00:00Z');            // KST 2026-10-11(일) 23:00
  assert.equal(kstWeekday(now), 0);
  assert.equal(iso(kstWeekStart(now)), '2026-10-04T15:00:00.000Z');
});

test('월말 경계: UTC 9/30 16:00 = KST 10/1 01:00 → 견적번호 월은 10', () => {
  assert.deepEqual(kstYearMonth(new Date('2026-09-30T16:00:00Z')), { yy: '26', mm: '10' });
  assert.deepEqual(kstYearMonth(new Date('2026-12-31T15:00:00Z')), { yy: '27', mm: '01' });
});
