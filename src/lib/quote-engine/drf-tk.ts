/**
 * DRF 독성동태(약식 · non-GLP) 산출 — 룰 PF-004 (data/rules_catalog.yaml parameters 가 단일 진실 원천).
 *
 *   샘플 수 = 회차 × ( 시험군 point × 군당 마리수 × 시험군 수 + 대조군 point × 군당 마리수 )
 *   동물 수 = 군당 마리수 × 전체 군수 × (1 + 여유), 올림
 *   사육 일수 = DRF 주차 × 7 + 순화(설치류 7일 · 비설치류 14일)
 *   금액 = (동물 + 사육 + 채혈 + 분석 + QC·검량선 + 보고서) × (1 + 영업이익), 만 원 절사
 *   비설치류는 DRF 동물 공용 → 동물·사육 미과금.
 *
 * fs 를 쓰지 않는 순수 모듈 — 인쇄 상세(details 라우트)·엔진(compose)·테스트가 같은 함수를 쓴다.
 */

export type DrfTkSpecies = 'rodent' | 'nonRodent';
export type DrfTkGroupMode = 'ALL' | 'CONTROL_HIGH' | 'CUSTOM';
export type DrfTkInclude = 'animals' | 'housing' | 'bleeding' | 'analysis' | 'qc' | 'report';

export type DrfTkPlan = {
  enabled: boolean;
  groupMode: DrfTkGroupMode;          // DRF 전군 / 대조군+최고용량군 / 직접
  customTestGroups?: number;          // CUSTOM 일 때 시험군 수
  points: number;                     // 시험군 채혈 point (6 · 8)
  sessions: number;                   // 채혈 회차 (2 · 3)
  controlPoints?: number;             // 대조군 point (기본: 룰 3)
  animalsPerSexPerGroup?: Partial<Record<DrfTkSpecies, number>>;
  include?: Partial<Record<DrfTkInclude, boolean>>;   // false 면 미과금 (협의)
};

export type SpeciesParams = {
  animal_unit: number | null; housing_unit_per_day: number; acclimation_days: number;
  animals_per_sex_per_group: number; charge_animals: boolean; charge_housing: boolean;
  cross_bleeding: boolean;            // true = point당 암수 절반씩 교차채혈 → point당 채혈 마리수 = 군당 마리수/2 (설치류)
};
export type DrfTkParams = {
  margin: number; spare_ratio: number; rounding_krw: number; control_points: number;
  bleeding_unit: number; analysis_unit: number; qc_calibration_fixed: number; report_fixed: number;
  rodent: SpeciesParams; non_rodent: SpeciesParams;
  sessions: Record<string, string[]>;
  default_test_groups: number;
};

export type DrfTkComponent = { key: DrfTkInclude; label: string; formula: string; amount: number; charged: boolean };
export type DrfTkResult = {
  species: DrfTkSpecies; drfWeeks: number;
  testGroups: number; perSex: number; perGroup: number; bledPerPoint: number; animalsTotal: number; animalsSpare: number;
  points: number; controlPoints: number; sessions: number; sessionLabels: string[];
  samplesTestPerSession: number; samplesControlPerSession: number; samples: number;
  housingDays: number;
  components: DrfTkComponent[]; subtotal: number; margin: number; total: number;
  testName: string; groupComposition: string; detail: string; notice: string;
};

export const DRF_TK_DEFAULT_PLAN: DrfTkPlan = { enabled: false, groupMode: 'ALL', customTestGroups: 4, points: 6, sessions: 2, include: {} };

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** 룰 파라미터 검증 — 카탈로그에서 읽은 객체가 필수 키를 갖는지. 없으면 throw (추측 금지). */
export function assertDrfTkParams(p: unknown): DrfTkParams {
  const o = p as Partial<DrfTkParams> | null;
  const req = ['margin', 'spare_ratio', 'rounding_krw', 'control_points', 'bleeding_unit', 'analysis_unit', 'qc_calibration_fixed', 'report_fixed', 'rodent', 'non_rodent', 'sessions', 'default_test_groups'] as const;
  for (const k of req) if (o == null || (o as Record<string, unknown>)[k] === undefined) throw new Error(`PF-004 parameters.${k} 누락 (data/rules_catalog.yaml)`);
  return o as DrfTkParams;
}

export function computeDrfTk(species: DrfTkSpecies, drfWeeks: number, plan: DrfTkPlan, params: DrfTkParams): DrfTkResult {
  const sp = species === 'rodent' ? params.rodent : params.non_rodent;
  const testGroups = plan.groupMode === 'ALL' ? params.default_test_groups
    : plan.groupMode === 'CONTROL_HIGH' ? 1
    : Math.max(1, Math.floor(plan.customTestGroups ?? params.default_test_groups));
  const perSex = plan.animalsPerSexPerGroup?.[species] ?? sp.animals_per_sex_per_group;
  const perGroup = perSex * 2;
  const groups = testGroups + 1;
  const animalsTotal = perGroup * groups;
  const animalsSpare = Math.ceil(animalsTotal * (1 + params.spare_ratio));
  const points = plan.points;
  const controlPoints = plan.controlPoints ?? params.control_points;
  const sessions = plan.sessions;
  const sessionLabels = params.sessions[String(sessions)] ?? Array.from({ length: sessions }, (_, i) => `${i + 1}회차`);
  // point당 채혈 마리수 — 설치류는 교차채혈(암수 3+3=6), 비설치류는 전 개체(2)
  const bledPerPoint = sp.cross_bleeding ? perGroup / 2 : perGroup;
  const samplesTestPerSession = points * bledPerPoint * testGroups;
  const samplesControlPerSession = controlPoints * bledPerPoint;
  const samples = (samplesTestPerSession + samplesControlPerSession) * sessions;
  const housingDays = drfWeeks * 7 + sp.acclimation_days;

  const inc = (k: DrfTkInclude, ruleDefault: boolean) => (plan.include?.[k] ?? true) && ruleDefault;
  const comps: DrfTkComponent[] = [];
  const push = (key: DrfTkInclude, label: string, formula: string, amount: number, charged: boolean) =>
    comps.push({ key, label, formula, amount: charged ? amount : 0, charged });
  push('animals', '동물 구입', sp.animal_unit != null ? `${animalsSpare}마리 × ${won(sp.animal_unit)}` : 'DRF 동물 공용', (sp.animal_unit ?? 0) * animalsSpare, inc('animals', sp.charge_animals && sp.animal_unit != null));
  push('housing', '사육', `${animalsSpare}마리 × ${won(sp.housing_unit_per_day)} × ${housingDays}일(순화 ${sp.acclimation_days}일 포함)`, animalsSpare * sp.housing_unit_per_day * housingDays, inc('housing', sp.charge_housing));
  push('bleeding', '채혈', `${samples}샘플 × ${won(params.bleeding_unit)}`, samples * params.bleeding_unit, inc('bleeding', true));
  push('analysis', '분석(LC/MS/MS)', `${samples}샘플 × ${won(params.analysis_unit)}`, samples * params.analysis_unit, inc('analysis', true));
  push('qc', 'QC·검량선', '고정', params.qc_calibration_fixed, inc('qc', true));
  push('report', '보고서(약식)', '고정', params.report_fixed, inc('report', true));
  const subtotal = comps.reduce((s, c) => s + c.amount, 0);
  const raw = subtotal * (1 + params.margin);
  const total = Math.floor(raw / params.rounding_krw) * params.rounding_krw;

  const spName = species === 'rodent' ? '설치류' : '비설치류';
  const testName = `${spName} ${drfWeeks}주 DRF 독성동태 시험 : ${sessions}회 채혈, ${points} points (non-GLP)`;
  const groupComposition = `대조군 1, 시험군 ${testGroups}`;
  const sessionLines = sessionLabels.map((lb) =>
    `- ${lb}: 시험군 ${points} point × ${bledPerPoint}마리 × ${testGroups}군 = ${samplesTestPerSession} point / 대조군 ${controlPoints} point × ${bledPerPoint}마리 × 1군 = ${samplesControlPerSession} point`);
  const costLines = comps.map((c) => `- ${c.label}: ${c.charged ? `${c.formula} = ${won(c.amount)}` : `${c.formula} (미과금)`}`);
  const detail = [
    `- 암수 각각 ${perSex}마리/군${species === 'rodent' ? ' (point당 암수 3마리씩 교차채혈)' : ' (DRF 동물 공용)'}`,
    `- ${groupComposition}`,
    `1. 채혈 [ 총 ${samples} point ]`,
    ...sessionLines,
    '2. 분석 진행',
    '- LC/MS/MS 기준',
    '- QC 및 검량선 확인 (Full Validation · ISR 미실시)',
    '3. 산출 근거',
    ...costLines,
    `- 소계 ${won(subtotal)} × (1 + 영업이익 ${Math.round(params.margin * 100)}%) = ${won(Math.round(raw))} → ${won(total)} (만 원 절사)`,
  ].join('\n');
  const notice = 'non-GLP 로 수행되며 정식 보고서 대신 약식 결과 보고서를 제공합니다. 군 구성·채혈 point 는 의뢰자 협의로 조정 가능합니다.';

  return {
    species, drfWeeks, testGroups, perSex, perGroup, bledPerPoint, animalsTotal, animalsSpare,
    points, controlPoints, sessions, sessionLabels, samplesTestPerSession, samplesControlPerSession, samples,
    housingDays, components: comps, subtotal, margin: params.margin, total,
    testName, groupComposition, detail, notice,
  };
}

/** 라인 id — 저장(QuoteItem.testItemKey)·인쇄 상세 조회가 같은 키를 쓴다. */
export const drfTkLineId = (species: DrfTkSpecies, drfWeeks: number) => `_drftk_${species}_${drfWeeks}w`;
export const isDrfTkLineId = (id: string) => id.startsWith('_drftk_');

/** 본시험 기간 목록 → DRF 주차 집합 (composeDrug 와 동일 규칙: 13주 이상이면 4주 DRF, 그 외 2주). */
export function drfWeeksFor(durations: string[]): number[] {
  const W: Record<string, number> = { W2: 2, W4: 4, W13: 13, W26: 26, W39: 39, W52: 52 };
  const out = new Set<number>();
  for (const d of durations) { const w = W[d]; if (w) out.add(w >= 13 ? 4 : 2); }
  return [...out].sort((a, b) => a - b);
}
