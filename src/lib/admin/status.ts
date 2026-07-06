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
