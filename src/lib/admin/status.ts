/** 견적 상태 → 한글 라벨·상태점 색(components.css 규약). */
export const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '작성중', color: 'var(--muted-soft)' },
  ISSUED: { label: '발행', color: 'var(--accent)' },
  SENT: { label: '발송', color: 'var(--status-sent)' },
  REVIEWED: { label: '검토', color: 'var(--sat)' },
  ACCEPTED: { label: '수주', color: 'var(--success)' },
  REJECTED: { label: '반려', color: 'var(--error)' },
};
export const quoteStatus = (s: string) => QUOTE_STATUS[s] ?? { label: s, color: 'var(--muted-soft)' };

/**
 * 견적 결론 — 통제 어휘(임정모 지정). 견적 현황 결론 드롭다운 값.
 * 계약 체결=수주, 타기관 선정=반려, 그 외=진행 중.
 */
export const CONCLUSIONS = ['비교견적용', '내부 검토중', '결과 대기중', '예산확보', '타기관 선정', '계약 체결'] as const;
export type Conclusion = (typeof CONCLUSIONS)[number];

/** 결론 → 파이프라인 상태. */
export function statusFromConclusion(c: string | null | undefined): string {
  if (!c) return 'SENT';
  if (/계약\s*체결|수주/.test(c)) return 'ACCEPTED';
  if (/타\s*기관/.test(c)) return 'REJECTED';
  return 'SENT';
}

/** 자유 텍스트 결론 → 통제 어휘 정규화(임포트용). 미매칭은 원문 유지. */
export function normalizeConclusion(raw: string | null | undefined): string | null {
  const c = (raw ?? '').trim();
  if (!c) return null;
  if (/계약\s*체결/.test(c)) return '계약 체결';
  if (/타\s*기관/.test(c)) return '타기관 선정';
  if (/예산/.test(c)) return '예산확보';
  if (/대기|과제\s*신청|결과/.test(c)) return '결과 대기중';
  if (/내부\s*검토/.test(c)) return '내부 검토중';
  if (/비교/.test(c)) return '비교견적용';
  return c;
}
