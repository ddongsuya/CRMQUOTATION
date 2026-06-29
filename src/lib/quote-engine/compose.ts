/**
 * 파라메트릭 구성 — Plan(모달리티·경로·기간·종·부가시험)에서 426 마스터 항목을 자동 선택.
 * (기존 suggest.ts 로직을 깨끗한 426 필드 = testClass·studyWeeks·species·tkPoints·tkMode로 재구현)
 * 결과를 evaluateQuote 의 selectedItems 로 넘긴다.
 */
import type { MasterItem, Standard } from './types';
import { itemsByCategory } from './master';

export type ComposePlan = {
  modality: string;                 // category
  standard: Standard;
  route: string;
  durations: string[];              // SINGLE · W4 · W13 · W26 · W39 · W52
  species: { rodent: boolean; nonRodent: boolean };
  addons: Record<string, boolean>;  // drf · recovery · tk · genotox · safetyPharm
  tk?: { points?: number; sampleOnly?: boolean; sessions?: number };
  componentCount?: number;          // 복합제 종수
  comboAnalysis?: '개별' | '동시';  // 복합제 분석방식
  subtype?: string;
};

const DUR_WEEKS: Record<string, number> = { W2: 2, W4: 4, W13: 13, W26: 26, W39: 39, W52: 52 };

function speciesMatch(it: MasterItem, sp: { rodent: boolean; nonRodent: boolean }): boolean {
  const s = it.species ?? '';
  if (/비설치류/.test(s)) return sp.nonRodent;
  if (/설치류|rat|마우스/i.test(s)) return sp.rodent;
  return true; // 종 무관 항목
}
const cls = (it: MasterItem, ...names: string[]) => names.some(n => (it.testClass ?? '').includes(n));

/** 신약군(의약품 등) 풀패키지 구성 */
function composeDrug(items: MasterItem[], plan: ComposePlan): MasterItem[] {
  const out: MasterItem[] = [];
  const sp = plan.species;
  const add = (arr: MasterItem[]) => out.push(...arr);

  if (plan.durations.includes('SINGLE'))
    // 단회는 회사 표준상 설치류 예비시험 1건만 (비설치류·DE법·회복·스크리닝 제외)
    add(items.filter(it => cls(it, '단회투여독성') && /설치류/.test(it.species ?? '') && !/비설치류/.test(it.species ?? '')
      && !/DE법|회복|스크리닝/.test(it.testName ?? '')).slice(0, 1));

  for (const d of plan.durations) {
    if (d === 'SINGLE') continue;
    const w = DUR_WEEKS[d];
    if (!w) continue;
    add(items.filter(it => cls(it, '반복투여독성') && it.studyWeeks === w && speciesMatch(it, sp)));        // 본시험
    if (plan.addons.drf) {
      const drfW = w >= 13 ? 4 : 2;   // 일반 용량결정 DRF만 (생식 배태자 DRF 제외)
      add(items.filter(it => (it.testClass ?? '') === 'DRF(용량결정)' && !/생식|배태자/.test(it.testName ?? '')
        && (it.studyWeeks === drfW || it.studyWeeks == null) && speciesMatch(it, sp)));
    }
    if (plan.addons.recovery)
      add(items.filter(it => cls(it, '회복군') && it.studyWeeks === w && speciesMatch(it, sp)));
    if (plan.addons.tk) {
      const pts = `${plan.tk?.points ?? 8}point`;
      const wantMode = plan.tk?.sampleOnly ? '채혈만' : '채혈+분석';
      const sessions = plan.tk?.sessions ?? 2;   // TK 회차(2회/3회) — 명시된 회차만
      add(items.filter(it => cls(it, 'TK') && it.studyWeeks === w && it.tkPoints === pts
        && (it.tkMode == null || it.tkMode === wantMode) && speciesMatch(it, sp)
        && (!/\(\d+회\)/.test(it.testName ?? '') || (it.testName ?? '').includes(`(${sessions}회)`))));
    }
  }
  if (plan.addons.genotox)  // 표준 3종
    add(items.filter(it => cls(it, '유전독성') && /Ames|TG471|염색체이상|TG473|소핵|TG474/.test(it.testName ?? '')));
  if (plan.addons.safetyPharm)
    add(items.filter(it => cls(it, '안전성약리')));
  // 조제물·함량분석 자동 1건
  add(items.filter(it => cls(it, '조제물') && /조제물/.test(it.testName ?? '')).slice(0, 1));
  return out;
}

/** 복합제 — 종수 × 분석방식으로 패키지 선택 */
function composeCombo(items: MasterItem[], plan: ComposePlan): MasterItem[] {
  const want = `${plan.componentCount ?? 2}종`;
  const anal = plan.comboAnalysis ?? '개별';
  return items.filter(it => it.componentCount === want && it.analysisMethod === anal);
}

/** 그 외 모달리티 — 단일가 표준 시험(본시험·단회·유전독성 등)을 기간·종으로 느슨히 구성 */
function composeGeneric(items: MasterItem[], plan: ComposePlan): MasterItem[] {
  const sp = plan.species;
  return items.filter(it => {
    if (cls(it, '보고서', '서비스')) return false;
    if (plan.durations.includes('SINGLE') && cls(it, '단회')) return speciesMatch(it, sp);
    for (const d of plan.durations) { const w = DUR_WEEKS[d]; if (w && it.studyWeeks === w) return speciesMatch(it, sp); }
    if (plan.addons.genotox && cls(it, '유전독성')) return true;
    return false;
  });
}

export function composeFromPlan(plan: ComposePlan): { id: string; testName: string | null }[] {
  const items = itemsByCategory(plan.modality);
  let picked: MasterItem[];
  if (plan.modality === '복합제') picked = composeCombo(items, plan);
  else if (plan.modality === '의약품') picked = composeDrug(items, plan);
  else picked = composeGeneric(items, plan);
  // 중복 제거
  const seen = new Set<string>();
  return picked.filter(it => (seen.has(it.id) ? false : seen.add(it.id))).map(it => ({ id: it.id, testName: it.testName }));
}
