'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getModalityConfig } from './modality-config';

export type PriceStandard = 'MFDS' | 'OECD';
export type Currency = 'KRW' | 'USD';

export type Selection = {
  key: string;
  testName: string;
  adminRoute: string | null;
  unitPrice: number;
  quantity: number;
  priority?: '필수' | '권장' | '옵션';
  tag?: string;
  source: 'preset' | 'manual';

  /**
   * 사용자 직접 입력 (override) — 비임상시험 특유의 변수 다양성 대응.
   * 설계 원칙 (2026-05): 자동 정형화가 불가능한 케이스는 사용자가 직접 수정 가능.
   *
   * null/undefined = override 없음 (자동값 사용)
   * 명시적 0 = 0을 그대로 사용 (예: 단회투여의 studyWeeksOverride=0)
   */
  unitPriceOverride?: number | null;       // 가격 수정 (영업 협의·할인 등)
  studyWeeksOverride?: number | null;      // 시험 투여 주차 수정 (F-1 비정형 141건 채움용)
  hamryangCountOverride?: number | null;   // 함량분석 회수 직접 지정
  customNote?: string | null;              // 자유 메모 (견적서 비고란에 출력)
};

export type ClinicalPhase = 'IND1' | 'IND2' | 'NDA';
export type Duration = 'SINGLE' | 'W4' | 'W13' | 'W26' | 'W39' | 'W52';

export type TKOption = {
  sessions: 2 | 3;
  points: 6 | 8;
  sampleOnly: boolean;
};

export type Plan = {
  route: string;
  durations: Duration[];
  phase: ClinicalPhase;
  species: { rodent: boolean; nonRodent: boolean };
  /** Modality-specific feature toggles (DRF, recovery, TK, genotox, ...). */
  addons: Record<string, boolean>;
  /** Modality-specific category toggles (mode='category' modalities). */
  categories: Record<string, boolean>;
  tk: TKOption;
  /** 백신 군 구성(대조1 + 백신 N-1). 2~5군. 자동구성이 해당 군 가격 항목을 고른다. */
  vaccineGroups?: number;
  /** 복합제 분석방식(개별/동시) — 조제물·함량·TK분석 단가를 가른다. */
  comboAnalysis?: '개별' | '동시';
};

type WizardState = {
  projectName: string;
  substanceName: string;
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerPhone: string;       // 담당자 연락처
  indication: string;          // 적응증
  submissionTarget: string;    // 제출처 (한국/미국/유럽 규제기관)
  modality: string;
  priceStandard: PriceStandard;
  /** 임상계획에서 "자동 구성"을 실행했는지 — 실시간 견적 표시 여부를 가른다 */
  planApplied: boolean;
  plan: Plan;
  selections: Selection[];
  excipientCount: number;
  currency: Currency;
  exchangeRate: number;
  discountRate: number;
  /** Wizard step (1=project, 2=modality, 3=plan, 4=selections, 5=pricing). */
  step: number;
  patch: (p: Partial<WizardState>) => void;
  setStep: (n: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setModality: (m: string) => void;
  patchPlan: (p: Partial<Plan>) => void;
  toggleDuration: (d: Duration) => void;
  toggleAddon: (id: string) => void;
  toggleCategory: (id: string) => void;
  addSelection: (s: Selection) => void;
  removeSelection: (key: string) => void;
  setQuantity: (key: string, q: number) => void;
  /**
   * Phase C-1/C-3: 특정 selection 의 override 필드를 patch.
   * patch 의 값이 null = override 제거 (자동값으로 복귀).
   * patch 의 값이 숫자/문자열 = 그 값으로 설정.
   * patch 에 없는 키는 그대로 유지.
   */
  setSelectionOverride: (key: string, patch: Partial<Pick<Selection, 'unitPriceOverride' | 'studyWeeksOverride' | 'hamryangCountOverride' | 'customNote'>>) => void;
  replaceSelections: (items: Selection[]) => void;
  reset: () => void;
};

type Actions =
  | 'patch' | 'setStep' | 'nextStep' | 'prevStep' | 'setModality' | 'patchPlan' | 'toggleDuration' | 'toggleAddon' | 'toggleCategory'
  | 'addSelection' | 'removeSelection' | 'setQuantity' | 'setSelectionOverride' | 'replaceSelections' | 'reset';

function defaultsFor(modality: string): Pick<Plan, 'addons' | 'categories' | 'durations'> {
  const cfg = getModalityConfig(modality);
  const addons: Record<string, boolean> = {};
  for (const a of cfg.addons) addons[a.id] = a.defaultOn ?? false;
  const categories: Record<string, boolean> = {};
  for (const c of cfg.categories ?? []) categories[c.id] = c.defaultOn ?? false;
  return { addons, categories, durations: cfg.defaultDurations ?? [] };
}

const initial: Omit<WizardState, Actions> = {
  projectName: '',
  substanceName: '',
  customerName: '',
  customerCompany: '',
  customerEmail: '',
  customerPhone: '',
  indication: '',
  submissionTarget: '한국 (MFDS)',
  modality: '',
  priceStandard: 'MFDS',
  planApplied: false,
  plan: {
    route: '경구',
    phase: 'IND1',
    species: { rodent: true, nonRodent: true },
    ...defaultsFor(''),
    tk: { sessions: 2, points: 8, sampleOnly: false },
    vaccineGroups: 2,
    comboAnalysis: '개별',
  },
  selections: [],
  excipientCount: 0,
  currency: 'KRW',
  exchangeRate: 1400,
  discountRate: 0,
  step: 1,
};

export const useWizard = create<WizardState>()(persist((set) => ({
  ...initial,
  patch: (p) => set(p as WizardState),
  setStep: (n) => set({ step: Math.max(1, Math.min(5, n)) }),
  nextStep: () => set((st) => ({ step: Math.min(5, st.step + 1) })),
  prevStep: () => set((st) => ({ step: Math.max(1, st.step - 1) })),
  setModality: (m) => set((st) => ({
    modality: m,
    plan: { ...st.plan, ...defaultsFor(m) },
    planApplied: false,   // 모달리티 변경 시 자동구성 재실행 필요
  })),
  patchPlan: (p) => set((st) => ({ plan: { ...st.plan, ...p } })),
  toggleDuration: (d) => set((st) => {
    const exists = st.plan.durations.includes(d);
    const next = exists ? st.plan.durations.filter(x => x !== d) : [...st.plan.durations, d];
    return { plan: { ...st.plan, durations: next } };
  }),
  toggleAddon: (id) => set((st) => ({
    plan: { ...st.plan, addons: { ...st.plan.addons, [id]: !st.plan.addons[id] } },
  })),
  toggleCategory: (id) => set((st) => ({
    plan: { ...st.plan, categories: { ...st.plan.categories, [id]: !st.plan.categories[id] } },
  })),
  addSelection: (s) => set((st) =>
    st.selections.find(x => x.key === s.key) ? st : { selections: [...st.selections, s] },
  ),
  removeSelection: (key) => set((st) => ({ selections: st.selections.filter(x => x.key !== key) })),
  setQuantity: (key, q) => set((st) => ({
    selections: st.selections.map(x => x.key === key ? { ...x, quantity: Math.max(1, q) } : x),
  })),
  setSelectionOverride: (key, patch) => set((st) => ({
    selections: st.selections.map(x => x.key === key ? { ...x, ...patch } : x),
  })),
  replaceSelections: (items) => set({ selections: items, planApplied: items.length > 0 }),
  reset: () => set(initial),
}), {
  name: 'chemon-quote-draft',
  storage: createJSONStorage(() => localStorage),
  // Persist only data, not action functions; zustand persist auto-filters by shape.
  // We exclude `step` so refresh restores form data but starts at step 1 — feels safer.
  partialize: (state) => ({
    projectName: state.projectName,
    substanceName: state.substanceName,
    customerName: state.customerName,
    customerCompany: state.customerCompany,
    customerEmail: state.customerEmail,
    customerPhone: state.customerPhone,
    indication: state.indication,
    submissionTarget: state.submissionTarget,
    modality: state.modality,
    priceStandard: state.priceStandard,
    planApplied: state.planApplied,
    plan: state.plan,
    selections: state.selections,
    excipientCount: state.excipientCount,
    currency: state.currency,
    exchangeRate: state.exchangeRate,
    discountRate: state.discountRate,
    // step 은 저장하지 않음 → /quote/new 재진입 시 항상 1단계(프로젝트)부터 시작
  } as Partial<WizardState>),
  version: 2,
  // v1 저장본에 남아있던 step 을 제거 (재진입 시 모달리티 등 중간 단계부터 시작하던 문제)
  migrate: (persisted) => {
    if (persisted && typeof persisted === 'object') {
      const { step: _drop, ...rest } = persisted as Record<string, unknown>;
      return rest as Partial<WizardState>;
    }
    return persisted as Partial<WizardState>;
  },
}));
