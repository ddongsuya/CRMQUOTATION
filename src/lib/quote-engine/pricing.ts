/**
 * 가격 결정 — docs/quote-engine-binding.md §5 (사용자 확정 2026-06-29).
 *  - 경로그룹: 경구|피하|근육 → 경구피하근육 / 정맥|경피|복강 → 정맥경피 / 그외 → 경구피하근육
 *  - 단일가 폴백: 선택 그룹이 비면 경구피하근육 가격 사용 (라벨은 선택 경로 유지)
 *  - OECD 빈칸: 자동 MFDS 폴백 금지 → 사용자 확인(missing_info)
 */
import type { MasterItem, Standard } from './types';

export function routeGroup(route: string): '경구피하근육' | '정맥경피' {
  return /정맥|경피|복강/.test(route ?? '') ? '정맥경피' : '경구피하근육';
}

export type PriceResult =
  | { ok: true; price: number; fallbackGroup: boolean }
  | { ok: false; level: 'warning' | 'blocker'; reason: string };

export function resolvePrice(item: MasterItem, route: string, std: Standard): PriceResult {
  const group = routeGroup(route);
  const chosen = item.prices[group];
  // 단일가 폴백: 선택 그룹에 값이 하나도 없으면 경구피하근육 박스 사용
  const useFallback = chosen.MFDS == null && chosen.OECD == null && group !== '경구피하근육';
  const box = useFallback ? item.prices['경구피하근육'] : chosen;
  const val = box[std];
  if (val != null) return { ok: true, price: val, fallbackGroup: useFallback };
  if (std === 'OECD') return { ok: false, level: 'warning', reason: 'OECD 가격 미정 — 사용자 확인 필요' };
  return { ok: false, level: 'warning', reason: '가격 미정 / 협의' };
}
