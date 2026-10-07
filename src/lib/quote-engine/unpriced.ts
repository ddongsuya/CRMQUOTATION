/**
 * 가격 미정 라인 판정 — 저장 API(서버 차단)와 위저드 화면(버튼 비활성·안내)이 같은 기준을 쓰도록 한 곳에 둔다.
 *
 * 왜 필요한가:
 *  엔진은 가격을 정할 수 없는 항목(예: OECD 가격 빈칸)을 unitPrice=null + missing_info 로 돌려준다
 *  (CLAUDE.md 절대 규칙 — MFDS 로 자동 폴백 금지, 사용자에게 되묻는다).
 *  그런데 저장 라우트가 `unitPrice ?? 0` 으로 저장해 ₩0 라인이 포함된 견적이 그대로 발행될 수 있었다.
 *  사용자가 단가를 직접 입력(unitPriceOverrides)하면 엔진이 unitPrice 를 채우므로 여기서 걸리지 않는다.
 *
 * 타입 import 만 쓴다 — 클라이언트 번들·node 테스트에서 그대로 쓸 수 있게.
 */
import type { LineItem, Addon } from './types';

export type UnpricedEntry = { id: string; name: string; kind: 'line' | 'addon' };

/** 단가가 정해지지 않은 견적 라인·채택 옵션 목록. 비어 있으면 저장·발행 가능. */
export function findUnpricedLines(q: { lineItems: LineItem[]; addons?: Addon[] }): UnpricedEntry[] {
  const out: UnpricedEntry[] = [];
  for (const li of q.lineItems) {
    if (li.unitPrice == null || !Number.isFinite(li.unitPrice)) out.push({ id: li.id, name: li.testName, kind: 'line' });
  }
  // 채택했지만 협의 단가를 넣지 않은 옵션도 엔진이 0원으로 계상한다 — 같은 이유로 ₩0 발행을 막는다.
  for (const a of q.addons ?? []) {
    if (a.priceMissing) out.push({ id: a.targetId ? `${a.ruleId}:${a.targetId}` : a.ruleId, name: a.name, kind: 'addon' });
  }
  return out;
}

/** 사용자에게 보여줄 한국어 안내 — 항목명을 나열한다(너무 길면 앞 5건 + 외 N건). */
export function unpricedErrorMessage(list: UnpricedEntry[]): string {
  const names = list.map(e => e.name);
  const shown = names.slice(0, 5).join(', ') + (names.length > 5 ? ` 외 ${names.length - 5}건` : '');
  return `단가가 정해지지 않은 항목이 ${list.length}건 있어 저장할 수 없습니다: ${shown}. 단가를 직접 입력하거나 항목을 삭제한 뒤 다시 저장해 주세요.`;
}
