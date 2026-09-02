/**
 * 금액 표기 헬퍼 — CRM 화면은 공급가(VAT 별도) 기준. 구 데이터에 totalAfterDiscount 가 없으면 총액/1.1 로 역산.
 * (예전엔 같은 식이 6곳에 복사돼 있어 VAT 정책이 바뀌면 화면마다 어긋날 위험이 있었다.)
 */
export type MoneyLike = { totalAfterDiscount?: number | null; grandTotal?: number | null };

/** 공급가. 둘 다 없으면 null (표시 측에서 '—'). */
export function supplyTotal(q: MoneyLike): number | null {
  if (q.totalAfterDiscount != null) return q.totalAfterDiscount;
  if (q.grandTotal != null) return q.grandTotal > 0 ? Math.round(q.grandTotal / 1.1) : 0;
  return null;
}
/** 합산용 — null 은 0. */
export const supplyOrZero = (q: MoneyLike): number => supplyTotal(q) ?? 0;
