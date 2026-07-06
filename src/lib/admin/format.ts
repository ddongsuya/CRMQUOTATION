/** 금액(원) → 한글 단위 축약. 억/만 단위, 1자리. 숫자 줄바꿈 방지용으로 문자열 반환. */
export function fmtWon(v: number): string {
  if (!v) return '₩0';
  const abs = Math.abs(v);
  if (abs >= 1e8) return `₩${(v / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `₩${Math.round(v / 1e4).toLocaleString()}만`;
  return `₩${Math.round(v).toLocaleString()}`;
}

/** 단위 분리형 — {num, unit} (KPI 대형 수치에서 unit 작게 표기). */
export function splitWon(v: number): { num: string; unit: string } {
  if (Math.abs(v) >= 1e8) return { num: (v / 1e8).toFixed(1), unit: '억' };
  if (Math.abs(v) >= 1e4) return { num: Math.round(v / 1e4).toLocaleString(), unit: '만' };
  return { num: Math.round(v).toLocaleString(), unit: '' };
}

export const fmtPct = (r: number | null, digits = 1): string =>
  r == null ? '—' : `${(r * 100).toFixed(digits)}%`;

export const fmtInt = (v: number): string => v.toLocaleString();
