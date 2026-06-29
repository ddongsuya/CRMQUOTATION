/**
 * 파라메트릭 구성 — Plan(모달리티·경로·기간·종·부가시험)에서 426 마스터 항목을 자동 선택.
 * (기존 suggest.ts 로직을 깨끗한 426 필드 = testClass·studyWeeks·species·tkPoints·tkMode로 재구현)
 * 결과를 evaluateQuote 의 selectedItems 로 넘긴다.
 */
import type { MasterItem, Standard, LineItem } from './types';
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
  excipientCount?: number;          // 부형제(비히클) 종수 — 함량/조제물분석 곱
  submissionTarget?: string;        // 국내 / USFDA / EMA — 안전성약리 hERG 변형 선택
  cellType?: 'adult' | 'esc_ipsc';  // 세포치료제 — 성체(26주) / ESC·iPSC(52주)
  vaccineGroups?: number;           // 백신 군구성(2~5군)
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
  if (plan.addons.safetyPharm) {
    // hERG는 제출처별 변형(국내/USFDA) 중 해당 것만
    const usfda = /USFDA|FDA|EMA|해외/i.test(plan.submissionTarget ?? '국내');
    add(items.filter(it => {
      if (!cls(it, '안전성약리')) return false;
      const n = it.testName ?? '';
      if (/hERG/.test(n) && /\(국내\)|\(USFDA\)/.test(n)) return usfda ? /USFDA/.test(n) : /국내/.test(n);
      return true;
    }));
  }
  // 조제물분석·함량분석은 마스터 항목이 아니라 규칙(R2·R8)으로 산출 → composeAnalysisLines 에서 별도 생성
  return out;
}

/** 백신 — 군구성(2~5군)별 4주(3회) 반복 + 회복(옵션) + 면역원성. */
function composeVaccine(items: MasterItem[], plan: ComposePlan): MasterItem[] {
  const g = `${plan.vaccineGroups ?? 2}군`;
  const byGroup = (arr: MasterItem[]) => arr.filter(it => (it.groupComposition ?? '') === g);
  const out = byGroup(items.filter(it => cls(it, '반복투여독성')));
  if (plan.addons.recovery) out.push(...byGroup(items.filter(it => cls(it, '회복군'))));
  if (plan.addons.immunogenicity !== false) out.push(...byGroup(items.filter(it => cls(it, '면역원성'))));
  return out;
}

/** 세포치료제 — 종양원성(성체 26주 / ESC·iPSC 52주 연장 추가) + 체내분포 + 단회관찰 [[줄기세포 규칙]] */
function composeCell(items: MasterItem[], plan: ComposePlan): MasterItem[] {
  const out: MasterItem[] = [];
  out.push(...items.filter(it => cls(it, '종양원성') && /26주/.test(it.testName ?? '')));
  if (plan.cellType === 'esc_ipsc') out.push(...items.filter(it => /52주\s*연장/.test(it.testName ?? '')));
  out.push(...items.filter(it => cls(it, '체내분포')));
  if (plan.durations.includes('SINGLE')) out.push(...items.filter(it => cls(it, '단회투여독성')));
  if (plan.addons.biodistribution) out.push(...items.filter(it => /Spiking/i.test(it.testName ?? '')));
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

// ── 함량분석(R2)·조제물분석(R8) — assemble.js 확정 규칙 포팅 ──
const PRICE_HAMRYANG_UNIT = 1_000_000;       // 함량분석 회당
const PRICE_PREP_UNIT = 10_000_000;          // 조제물분석 그룹당
const PREP_LABEL: Record<string, string> = { in_vivo: '본시험·DRF·TK·회복', genotox: '유전독성', safety_pharm: '안전성약리' };

/** 함량분석 회수: null/0·≤4 → 1, ≤13 → 2, >13(만성) → floor(주/4) */
function hamryangCountForWeeks(w: number | null | undefined): number {
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

/** 구성된 시험 + 부형제 종수로 함량분석·조제물분석 라인 자동 생성 (복합제는 명시항목 사용 → 제외) */
export function composeAnalysisLines(plan: ComposePlan, composed: MasterItem[]): LineItem[] {
  if (plan.modality === '복합제') return [];                 // 복합제는 종수×분석방식 명시 항목
  if (composed.some(it => isAnalysisSelf(it.testName ?? ''))) return []; // 명시 분석항목 있으면 자동 skip
  const excipient = Math.max(plan.excipientCount ?? 1, 1);
  const lines: LineItem[] = [];

  // 함량분석 (R2·R4): Σ회수 × 부형제종수 × 회당단가
  const totalCount = composed.reduce((s, it) => s + (includedForHamryang(it) ? hamryangCountForWeeks(it.studyWeeks) : 0), 0);
  if (totalCount > 0) {
    const price = PRICE_HAMRYANG_UNIT * totalCount * excipient;
    lines.push({ id: '_hamryang', testName: `함량분석 (${totalCount}회${excipient > 1 ? ` × 부형제 ${excipient}종` : ''})`, route: plan.route, unitPrice: price, quantity: 1, amount: price, appliedRules: ['R2 함량분석'], notes: [`회당 ${PRICE_HAMRYANG_UNIT.toLocaleString()} × ${totalCount}회${excipient > 1 ? ` × ${excipient}종` : ''}`] });
  }
  // 조제물분석 (R8): 부형제 그룹별 1000만
  const groups = new Set<string>();
  for (const it of composed) { const g = prepGroup(it); if (g) groups.add(g); }
  for (const g of ['in_vivo', 'genotox', 'safety_pharm']) {
    if (!groups.has(g)) continue;
    const price = PRICE_PREP_UNIT * excipient;
    lines.push({ id: `_prep_${g}`, testName: `투여물질의 조제물 분석 — ${PREP_LABEL[g]}`, route: plan.route, unitPrice: price, quantity: 1, amount: price, appliedRules: ['R8 조제물분석'], notes: excipient > 1 ? [`× 부형제 ${excipient}종`] : [] });
  }
  return lines;
}

export function composeFromPlan(plan: ComposePlan): { id: string; testName: string | null }[] {
  const items = itemsByCategory(plan.modality);
  let picked: MasterItem[];
  if (plan.modality === '복합제') picked = composeCombo(items, plan);
  else if (plan.modality === '백신') picked = composeVaccine(items, plan);
  else if (plan.modality === '세포치료제') picked = composeCell(items, plan);
  else if (plan.modality === '건강기능식품') {
    // 하위유형(개별인정형/프로바이오틱스/한시적식품)으로 먼저 거른 뒤 신약군 로직
    const sub = plan.subtype ?? '개별인정형';
    picked = composeDrug(items.filter(it => !it.subtype || it.subtype === sub), plan);
  }
  else if (plan.modality === '의약품') picked = composeDrug(items, plan);
  else picked = composeGeneric(items, plan);
  // 중복 제거
  const seen = new Set<string>();
  return picked.filter(it => (seen.has(it.id) ? false : seen.add(it.id))).map(it => ({ id: it.id, testName: it.testName }));
}
