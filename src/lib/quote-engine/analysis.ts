/**
 * 함량분석(R2)·조제물분석(R8) 산출 — assemble.js 확정 규칙 포팅.
 *
 * 왜 compose.ts 에서 분리했나:
 *  예전에는 compose 단계(자동 구성 직후)에서 이 라인을 미리 계산해 엔진에 extraLines 로 넘겼다.
 *  그래서 step4 에서 사용자가 시험을 삭제·수량 변경·수동 추가해도 분석 라인은 그대로 남아
 *  (예: 유전독성 3종을 지워도 조제물분석-유전독성 1,000만이 계속 청구) 견적이 실제 시험과 어긋났다.
 *  이제 엔진이 최종 라인(삭제·수량·수동추가·면제·선행 반영 후)으로 이 함수를 호출한다.
 *  레거시 assemble.js 와 같은 의미 — 함량분석 회수는 Σ(회수 × 수량), 조제물분석은 실제 선택된 시험의 그룹별 1회.
 *
 * 이 파일은 타입 import 만 쓴다 — node 타입 스트리핑으로 테스트에서 직접 require 할 수 있게.
 */
import type { MasterItem, LineItem, AnalysisPlan } from './types';

const PRICE_HAMRYANG_UNIT = 1_000_000;       // 함량분석 회당
const PRICE_PREP_UNIT = 10_000_000;          // 조제물분석 그룹당
const PREP_LABEL: Record<string, string> = { in_vivo: '본시험·DRF·TK·회복', genotox: '유전독성', safety_pharm: '안전성약리' };

/** 함량분석 회수: null/0·≤4 → 1, ≤13 → 2, >13(만성) → floor(주/4) */
export function hamryangCountForWeeks(w: number | null | undefined): number {
  if (w == null || w === 0) return 1;
  if (w <= 4) return 1;
  if (w <= 13) return 2;
  return Math.floor(w / 4);
}
const isAnalysisSelf = (n: string) => /조제물\s*분석|함량\s*분석|Validation/i.test(n);
/** 함량분석 포함 여부 (회복·분석자체 제외 / 본시험·DRF·TK·유전독성·안전성약리 포함) */
function includedForHamryang(it: MasterItem): boolean {
  const n = it.testName ?? '';
  if (isAnalysisSelf(n) || /회복/.test(n)) return false;
  if (/\bTK\b|독성동태|DRF|예비|용량결정/i.test(n)) return true;
  if (/유전독성|Ames|TG471|복귀돌연변이|염색체이상|TG473|소핵|TG474|MLA|TG490|Comet/i.test(n)) return true;
  if (/안전성약리|hERG|Cav|Nav|MEA|중추신경|호흡기계|Telemetry/i.test(n)) return true;
  if (/세포독성|3T3|RhE|RhCE|GPMT|LLNA|면역원성|항체형성|발열성|혈액적합성|이식|감작/i.test(n)) return false;
  if (/반복|단회|일회|급성/.test(n)) return true;
  return false;
}
/** 조제물분석 부형제 그룹 (in_vivo / genotox / safety_pharm) */
function prepGroup(it: MasterItem): string | null {
  const n = it.testName ?? '';
  if (isAnalysisSelf(n) || /회복/.test(n)) return null;
  if (/유전독성|Ames|TG471|복귀돌연변이|염색체이상|TG473|소핵|TG474|MLA|TG490|Comet/i.test(n)) return 'genotox';
  if (/안전성약리|hERG|Cav|Nav|MEA|중추신경|호흡기계|Telemetry/i.test(n)) return 'safety_pharm';
  if (/반복|단회|일회|급성|\bTK\b|독성동태|DRF|예비|용량결정/i.test(n)) return 'in_vivo';
  return null;
}

/** 분석 라인 산출 대상 — 견적에 실제로 남은 마스터 항목과 그 수량. autoAdded = 룰이 자동 추가한 선행·동반 라인. */
export type AnalysisSelection = { item: MasterItem; quantity: number; autoAdded?: boolean };

/**
 * 최종 선택 시험 + 부형제 종수로 함량분석·조제물분석 라인 생성 (복합제는 명시항목 사용 → 제외).
 *  · 함량분석: Σ(회수 × 수량) × 부형제종수 × 회당단가 — assemble.js R3/R4 와 동일 (수량 2 = 같은 시험 2건 → 분석도 2배)
 *  · 조제물분석: 부형제 그룹별 1회 × 부형제종수 — 수량과 무관 (assemble.js R8 와 동일)
 */
export function composeAnalysisLines(plan: AnalysisPlan, selected: AnalysisSelection[]): LineItem[] {
  if (plan.modality === '복합제') return [];                 // 복합제는 종수×분석방식 명시 항목
  // 사용자가 분석 항목을 명시적으로 고른 경우만 자동 산출을 건너뛴다 (assemble.js: "사용자가 명시적으로 추가했으면 skip").
  // 룰이 자동 추가한 동반 라인(예: SB-002 카테터 → '투여물질의 조제물 분석' med-34, 단가 null)까지 skip 조건에 넣으면
  // 자동 산출 함량·조제물분석이 통째로 사라져 금액이 비게 된다 — 이전 동작(자동 산출 유지)을 보존한다.
  if (selected.some(s => !s.autoAdded && isAnalysisSelf(s.item.testName ?? ''))) return [];
  const excipient = Math.max(plan.excipientCount ?? 1, 1);
  const lines: LineItem[] = [];

  // 함량분석 (R2·R4)
  const totalCount = selected.reduce((sum, s) => {
    if (!includedForHamryang(s.item)) return sum;
    const q = Number.isFinite(s.quantity) && s.quantity > 0 ? s.quantity : 1;
    return sum + hamryangCountForWeeks(s.item.studyWeeks) * q;
  }, 0);
  if (totalCount > 0) {
    const price = PRICE_HAMRYANG_UNIT * totalCount * excipient;
    lines.push({ id: '_hamryang', testName: `함량분석 (${totalCount}회${excipient > 1 ? ` × 부형제 ${excipient}종` : ''})`, route: plan.route, testClass: '함량·조제물분석', unitPrice: price, quantity: 1, amount: price, appliedRules: ['R2 함량분석'], notes: [`회당 ${PRICE_HAMRYANG_UNIT.toLocaleString()} × ${totalCount}회${excipient > 1 ? ` × ${excipient}종` : ''}`] });
  }
  // 조제물분석 (R8): 부형제 그룹별 1000만
  const groups = new Set<string>();
  for (const s of selected) { const g = prepGroup(s.item); if (g) groups.add(g); }
  for (const g of ['in_vivo', 'genotox', 'safety_pharm']) {
    if (!groups.has(g)) continue;
    const price = PRICE_PREP_UNIT * excipient;
    lines.push({ id: `_prep_${g}`, testName: `투여물질의 조제물 분석 — ${PREP_LABEL[g]}`, route: plan.route, testClass: '함량·조제물분석', unitPrice: price, quantity: 1, amount: price, appliedRules: ['R8 조제물분석'], notes: excipient > 1 ? [`× 부형제 ${excipient}종`] : [] });
  }
  return lines;
}
