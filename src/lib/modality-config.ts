/**
 * Per-modality plan configuration.
 *
 * Each modality has its own typical study package; this config drives:
 *   - Which sections of the plan UI show (route, durations, species, phase, ...)
 *   - Which add-on toggles are available (DRF, recovery, TK, genotox, safety pharm,
 *     immunogenicity, tumorigenicity, biodistribution, repro tox, carcinogenicity, ...)
 *   - For category-style modalities (화장품·의료기기·스크리닝), a flat list of
 *     selectable test categories instead of duration-based plan.
 *
 * The auto-suggestion engine (suggest.ts) reads the active addons + chosen
 * categories to drive its finders.
 */
import type { Duration } from './store';

export type AddonId =
  | 'drf'
  | 'recovery'
  | 'tk'
  | 'genotox'
  | 'safetyPharm'
  | 'immunogenicity'   // 백신
  | 'tumorigenicity'   // 세포치료제
  | 'biodistribution'  // 세포치료제
  | 'reproTox'         // 세포치료제
  | 'carcinogenicity'; // 세포치료제

export type AddonDef = { id: AddonId; label: string; defaultOn?: boolean };

export type CategoryId = string; // free-form category id (모달리티 내 의미 부여)
export type CategoryDef = { id: CategoryId; label: string; defaultOn?: boolean };

export type ModalityPlanConfig = {
  /** main UI mode */
  mode: 'drug' | 'category';
  /** which fields visible in plan */
  showRoute: boolean;
  showDurations: boolean;
  showSpecies: boolean;
  showPhase: boolean;
  /** allowed durations subset (default = all 6) */
  durationsAvailable?: Duration[];
  /** durations pre-selected when this modality is chosen (the "standard package").
   *  User can then deselect or add. Falls back to [] if absent. */
  defaultDurations?: Duration[];
  /** add-ons shown (only for mode=drug) */
  addons: AddonDef[];
  /** test categories (only for mode=category) */
  categories?: CategoryDef[];
  /** human-readable note */
  note?: string;
};

const DRUG_FULL: ModalityPlanConfig = {
  mode: 'drug',
  showRoute: true, showDurations: true, showSpecies: true, showPhase: true,
  // IND 1상 표준 = 단회(설치류 예비) + 13주 반복 (기본). User 가 4주/26주 등 추가 선택 가능.
  defaultDurations: ['SINGLE', 'W13'],
  addons: [
    { id: 'drf', label: 'DRF (용량결정)', defaultOn: true },
    { id: 'recovery', label: '회복군', defaultOn: true },
    { id: 'tk', label: 'TK (독성동태)', defaultOn: true },
    { id: 'genotox', label: '유전독성 3종', defaultOn: true },
    { id: 'safetyPharm', label: '안전성약리 core', defaultOn: true },
  ],
};

export const MODALITY_PLAN_CONFIG: Record<string, ModalityPlanConfig> = {
  // ─── 신약군 (10) — 풀 IND 패키지 ───────────────────────
  '합성신약': DRUG_FULL,
  '생물의약품': DRUG_FULL,
  '항암제': DRUG_FULL,
  '펩타이드': DRUG_FULL,
  '바이오시밀러': DRUG_FULL,
  'ADC': DRUG_FULL,
  '이중특이항체': DRUG_FULL,
  '방사성의약품': DRUG_FULL,
  '유전자치료제': DRUG_FULL,
  '핵산치료제': DRUG_FULL,

  // ─── 세포치료제 — 종양원성/체내분포/생식독성/발암성 추가 ──
  '세포치료제': {
    mode: 'drug',
    showRoute: true, showDurations: true, showSpecies: true, showPhase: true,
    durationsAvailable: ['SINGLE', 'W13', 'W26', 'W52'],
    defaultDurations: ['SINGLE', 'W26'], // 회사 표준: 단회 13주 관찰 + 성체 26주 관찰
    addons: [
      { id: 'recovery', label: '회복군', defaultOn: false },
      { id: 'tumorigenicity', label: '종양원성 (26주/52주)', defaultOn: true },
      { id: 'biodistribution', label: '체내분포', defaultOn: true },
      { id: 'reproTox', label: '생식독성', defaultOn: false },
      { id: 'carcinogenicity', label: '발암성', defaultOn: false },
      { id: 'genotox', label: '유전독성', defaultOn: true },
      { id: 'safetyPharm', label: '안전성약리', defaultOn: true },
      { id: 'tk', label: 'PK/TK', defaultOn: true },
    ],
    note: '성체 유래 26주 / ESC·iPSC 유래 52주 관찰 (회사 표준)',
  },

  // ─── 복합제 — 설치류 13주, 성분 종수×분석방식(개별/동시)로 가격 산정 ───
  '복합제': {
    mode: 'drug',
    showRoute: true, showDurations: false, showSpecies: false, showPhase: false,
    defaultDurations: ['W13'],
    addons: [
      { id: 'drf', label: '4주 DRF', defaultOn: true },
      { id: 'recovery', label: '회복군 (4주)', defaultOn: true },
      { id: 'tk', label: 'TK (독성동태)', defaultOn: true },
    ],
    note: '설치류 단독 · 13주 반복 기준. 성분 종수(2/3/4)와 분석방식(개별/동시)로 단가 결정',
  },

  // ─── 백신 — 4주(3회) 반복 + 면역원성 ───────────────────
  '백신': {
    mode: 'drug',
    showRoute: true, showDurations: false, showSpecies: false, showPhase: false,
    addons: [
      { id: 'recovery', label: '회복군 (4주)', defaultOn: true },
      { id: 'immunogenicity', label: '면역원성 (항체형성)', defaultOn: true },
    ],
    note: '백신 표준: 4주(1회/2주, 총 3회) 반복투여',
  },

  // ─── 건강기능식품 — 단회/13주 + 유전독성 (안전성약리·TK 없음) ─
  '건강기능식품': {
    mode: 'drug',
    showRoute: true, showDurations: true, showSpecies: false, showPhase: false,
    durationsAvailable: ['SINGLE', 'W4', 'W13', 'W26'],
    // 건기식 표준 패키지: 급성(단회) + 4주 DRF + 13주 반복 + 4주 회복 + 유전독성 3종
    // → 단회 + 13주 선택 시 dispatcher 가 W13 의 DRF/회복도 함께 자동 매칭함.
    defaultDurations: ['SINGLE', 'W13'],
    addons: [
      { id: 'drf', label: 'DRF', defaultOn: true },
      { id: 'recovery', label: '회복군', defaultOn: true },
      { id: 'genotox', label: '유전독성 3종', defaultOn: true },
    ],
    note: '설치류 단독. 안전성약리·TK 표준 없음',
  },

  // ─── 화장품 — 대체법(in vitro) 카테고리 ─────────────────
  '화장품': {
    mode: 'category',
    showRoute: false, showDurations: false, showSpecies: false, showPhase: false,
    addons: [],
    categories: [
      { id: 'singleDose', label: '단회투여 독성', defaultOn: true },
      { id: 'genotox', label: '유전독성 3종', defaultOn: true },
      { id: 'skinIrritation', label: '피부자극 (RhE)', defaultOn: true },
      { id: 'skinSensitization', label: '피부감작 (LLNA)', defaultOn: true },
      { id: 'eyeIrritation', label: '안점막자극 (RhCE)', defaultOn: true },
      { id: 'phototox', label: '광독성 (3T3 NRU)', defaultOn: false },
      { id: 'photosensitization', label: '광감작 (Harber)', defaultOn: false },
      { id: 'repeatDermal', label: '경피 반복투여 (4주 DRF / 13주)', defaultOn: false },
    ],
    note: '대체법(in vitro) 중심',
  },

  // ─── 의료기기 (ISO10993) — ISO 카테고리 ────────────────
  '의료기기(ISO10993)': {
    mode: 'category',
    showRoute: false, showDurations: false, showSpecies: false, showPhase: false,
    addons: [],
    categories: [
      { id: 'cytotoxicity', label: '세포독성 (10993-5)', defaultOn: true },
      { id: 'sensitization', label: '감작성 (GPMT)', defaultOn: true },
      { id: 'irritation', label: '자극성 (피내·피부·안·구강)', defaultOn: true },
      { id: 'systemicToxicity', label: '급성 전신독성', defaultOn: true },
      { id: 'subAcute', label: '아급성 (4주)', defaultOn: false },
      { id: 'subChronic', label: '아만성 (13주)', defaultOn: false },
      { id: 'genotox', label: '유전독성 (Ames/CA/MN/MLA)', defaultOn: true },
      { id: 'implantation', label: '이식시험', defaultOn: false },
      { id: 'pyrogen', label: '발열성 (엔도톡신)', defaultOn: false },
      { id: 'hemocompat', label: '혈액적합성', defaultOn: false },
    ],
    note: 'ISO 10993 시리즈 — 제품 카테고리에 따라 선택',
  },

  // ─── 스크리닝 — 빠른 1차 ────────────────────────────────
  '스크리닝': {
    mode: 'category',
    showRoute: false, showDurations: false, showSpecies: false, showPhase: false,
    addons: [],
    categories: [
      { id: 'singleDoseScreen', label: '단회투여 스크리닝', defaultOn: true },
      { id: 'repeat2wkScreen', label: '2주 반복 스크리닝', defaultOn: false },
      { id: 'genotoxScreen', label: '유전독성 스크리닝 3종', defaultOn: true },
      { id: 'cytotoxScreen', label: '세포독성 스크리닝', defaultOn: false },
      { id: 'hergScreen', label: 'hERG 스크리닝', defaultOn: false },
    ],
  },

  // ─── in vitro 대사·PK (DMPK) — 약물동태 보조 in vitro 패널 ───
  'in vitro 대사·PK': {
    mode: 'category',
    showRoute: false, showDurations: false, showSpecies: false, showPhase: false,
    addons: [],
    categories: [
      { id: 'metstab', label: '대사안정성 (microsome/S9)', defaultOn: true },
      { id: 'cyp', label: 'CYP 저해 9종 (1 dose)', defaultOn: true },
      { id: 'cyptdi', label: 'CYP 저해 TDI 9종', defaultOn: false },
      { id: 'ppb', label: '혈장단백결합 (human)', defaultOn: false },
      { id: 'caco2', label: 'Caco-2 막투과성 (A-B)', defaultOn: false },
      { id: 'metid', label: '대사체 확인 (microsome/S9)', defaultOn: false },
      { id: 'lcmsms', label: 'LC-MS/MS 셋팅비 (대사체)', defaultOn: false },
    ],
    note: 'in vitro DMPK — 필요한 에세이를 선택. 투여·동물 없음',
  },

  // ─── 심혈관계 스크리닝 ──────────────────────────────────
  '심혈관계스크리닝': {
    mode: 'category',
    showRoute: false, showDurations: false, showSpecies: false, showPhase: false,
    addons: [],
    categories: [
      { id: 'hergCh', label: 'hERG screening', defaultOn: true },
      { id: 'cav12', label: 'Cav1.2 screening', defaultOn: false },
      { id: 'nav15', label: 'Nav1.5 screening', defaultOn: false },
      { id: 'mea', label: 'MEA (hiPSC-CM)', defaultOn: false },
      { id: 'beaglePilot', label: '비글 예비시험', defaultOn: false },
      { id: 'telemetry', label: 'Telemetry', defaultOn: false },
    ],
  },
};

export function getModalityConfig(modality: string): ModalityPlanConfig {
  return MODALITY_PLAN_CONFIG[modality] ?? DRUG_FULL;
}

/**
 * 준비 중(coming soon) 모달리티 — 데이터/가이드라인 정비 전이라 견적 흐름 대신
 * "준비 중입니다" 안내를 띄운다. (화평법·살생물제·농약 등은 톤수/규제 매트릭스 정비 후 오픈)
 */
export const COMING_SOON_MODALITIES = [
  '화학물질(K-REACH)',
  '살생물제(K-BPR)',
  '농약',
  '인축독성',
] as const;

export function isComingSoon(modality: string): boolean {
  return (COMING_SOON_MODALITIES as readonly string[]).includes(modality);
}

/** 유효한 모달리티 key 전체 (모달리티 템플릿 편집기에서 선택 가능한 후보) */
export function allModalityKeys(): string[] {
  return [...Object.keys(MODALITY_PLAN_CONFIG), ...COMING_SOON_MODALITIES];
}
