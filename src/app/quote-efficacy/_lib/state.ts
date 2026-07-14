/**
 * 효력시험 위저드 상태 + 순수 로직.
 * 원본: design_handoff_efficacy_quotation/효력시험 견적서.dc.html (Component.state / parse / loadModel / cost / quote).
 * 계산식·프리셋 규칙은 원본 그대로. 임의 변경 금지.
 */
import {
  ANIMAL_PRICES, calculateCostByCategory, calculateCostItems, calculateTotalCost,
  getHousingRate, type AnimalPriceRow, type CostItem,
} from '@/lib/efficacy-engine/engine';
import { STUDY_MODELS, type StudyModel } from '@/lib/efficacy-engine/models';
import { DOSE_FREQ, PHASE, speciesWord, uid, type PhaseType } from '@/lib/efficacy-engine/constants';
import { EMPTY_CUSTOMER, type CustomerInfo } from '@/components/quote/CustomerFields';

export type Phase = { id: string; type: PhaseType; label: string; dur: number; unit: 'week' | 'day'; days: number };
export type SubGroup = { id: string; label: string; n: number };
export type Group = { id: string; tag: string; label: string; induct: boolean; subs: SubGroup[] };
export type Endpoint = { id: string; name: string; times: Record<string, boolean> };
export type Params = { vendor: string; strain: string; ageWeeks: number; route: string; freq: string; induction: string };
/** 고객 정보는 독성 모듈과 공유하는 스키마를 그대로 쓴다. */
export type Client = CustomerInfo;

export type EffState = {
  step: number; browseCat: string; search: string; editorOpen: boolean;
  modelId: string; schedule: Phase[]; params: Params; groups: Group[]; endpoints: Endpoint[]; selIdx: number;
  discount: number; margin: number; client: Client;
};

export const INITIAL: EffState = {
  step: 1, browseCat: '', search: '', editorOpen: true,
  modelId: '', schedule: [], params: { vendor: '', strain: '', ageWeeks: 7, route: '경구 (PO)', freq: 'qd', induction: '' },
  groups: [], endpoints: [], selIdx: 0,
  discount: 0.25, margin: 0.1,
  client: EMPTY_CUSTOMER,
};

/** scheduleDurations("1-week"…) → 단계 배열. 첫=순화, 둘째(3단계 이상)=유발, 마지막=관찰, 나머지=투여. */
export function parseSchedule(durations: string[]): Phase[] {
  const n = durations.length;
  return durations.map((d, i) => {
    const m = d.match(/^(\d+)-(week|day|hour)$/);
    const dur = m ? parseInt(m[1]) : 1;
    const unit = (m ? m[2] : 'week') as 'week' | 'day';
    let type: PhaseType;
    if (i === 0) type = 'acclimation';
    else if (i === 1 && n >= 3) type = 'induction';
    else if (i === n - 1) type = 'observation';
    else type = 'administration';
    const days = unit === 'week' ? dur * 7 : unit === 'day' ? dur : 1;
    return { id: uid(), type, label: PHASE[type].label, dur, unit, days };
  });
}

const sub = (n: number): SubGroup[] => [{ id: uid(), label: '전체', n }];

/** 모델 프리셋 → 스케줄·군구성·엔드포인트·동물 파라미터 자동 구성. */
export function loadModelState(id: string): Pick<EffState, 'modelId' | 'selIdx' | 'params' | 'schedule' | 'groups' | 'endpoints'> {
  const m = STUDY_MODELS.find((x) => x.id === id) ?? STUDY_MODELS[0];

  const groups: Group[] = [
    { id: uid(), tag: 'G1', label: '정상군 (Sham)', induct: false, subs: sub(8) },
    { id: uid(), tag: 'G2', label: '유발대조군 (Vehicle)', induct: true, subs: sub(8) },
    { id: uid(), tag: 'G3', label: '시험군 저용량', induct: true, subs: sub(8) },
    { id: uid(), tag: 'G4', label: '시험군 고용량', induct: true, subs: sub(8) },
  ];
  if (m.positiveControl) groups.push({ id: uid(), tag: 'G5', label: '양성대조군', induct: true, subs: sub(8) });

  const endpoints: Endpoint[] = m.evalItemsRaw.split(',').map((x) => x.trim()).filter(Boolean).map((name) => {
    const n = name.toLowerCase();
    const times: Record<string, boolean> = { 관찰: true, 부검: true };
    if (/체중|체온|weight/.test(n)) { times['순화'] = true; times['투여'] = true; }
    if (/유발|induction|score|mankin/.test(n)) times['유발'] = true;
    return { id: uid(), name, times };
  });

  // 동물: 프리셋 종에 맞는 구입업체·주령 자동 선택
  const targetStrain = m.species[0] || m.speciesRaw.split('(')[0].trim();
  const ap: AnimalPriceRow[] = ANIMAL_PRICES;
  const pick = ap.find((a) => a.strain.toLowerCase().includes(targetStrain.toLowerCase().split(' ')[0]))
    ?? ap.find((a) => speciesWord(a.strain) === speciesWord(targetStrain))
    ?? ap[0];
  const weeks = pick ? Object.keys(pick.priceByWeek) : ['7W'];
  const wk = m.ageWeeks ? `${m.ageWeeks}W` : null;
  const week = (wk && pick && pick.priceByWeek[wk]) ? wk : weeks[Math.min(weeks.length - 1, Math.floor(weeks.length / 2))];

  return {
    modelId: m.id, selIdx: 0,
    params: {
      vendor: pick ? pick.vendor : '', strain: pick ? pick.strain : targetStrain,
      ageWeeks: parseInt(week) || m.ageWeeks || 7,
      route: '경구 (PO)', freq: 'qd', induction: (m.inductionMethod || '').replace(/\s*모델$/, ''),
    },
    schedule: parseSchedule(m.scheduleDurations), groups, endpoints,
  };
}

export const animalEntry = (vendor: string, strain: string): AnimalPriceRow | undefined =>
  ANIMAL_PRICES.find((a) => a.vendor === vendor && a.strain === strain);

export function animalPrice(p: Params): number {
  const e = animalEntry(p.vendor, p.strain);
  if (!e) return 0;
  return e.priceByWeek[`${p.ageWeeks}W`] || Object.values(e.priceByWeek)[0] || 0;
}

export const groupTotal = (g: Group): number => g.subs.reduce((a, x) => a + (Number(x.n) || 0), 0);
export const totalAnimalsOf = (groups: Group[]): number => groups.reduce((a, g) => a + groupTotal(g), 0);
export const totalDaysOf = (schedule: Phase[]): number => schedule.reduce((a, p) => a + p.days, 0) || 1;
export const durLabel = (p: Phase): string => (p.unit === 'week' ? `${Math.round(p.days / 7)}주` : `${p.days}일`);

/** 투여 단계 합계 → "N주" */
export function dosingWeeks(schedule: Phase[]): string {
  const d = schedule.filter((p) => p.type === 'administration').reduce((a, p) => a + p.days, 0);
  return d ? `${Math.ceil(d / 7)}주` : '—';
}

/** 엔드포인트 매트릭스 열 = 스케줄 단계 라벨(중복 제거) + 부검 */
export function timeCols(schedule: Phase[]): string[] {
  const labels = schedule.map((p) => p.label);
  const uniq = labels.filter((v, i) => labels.indexOf(v) === i);
  if (!uniq.includes('부검')) uniq.push('부검');
  return uniq;
}

export type CostResult = { items: CostItem[]; total: number; byCat: { name: string; value: number }[] };

/** 원가 산출 — 엔진 호출부. DC cost()와 인자 구성 동일. */
export function computeCost(s: EffState, m: StudyModel): CostResult {
  const totalAnimals = totalAnimalsOf(s.groups);
  const freq = DOSE_FREQ.find((f) => f.key === s.params.freq) ?? DOSE_FREQ[0];
  const items = calculateCostItems({
    species: s.params.strain, ageWeeks: Number(s.params.ageWeeks) || 7,
    animalsPerGroup: totalAnimals, groupCount: 1,
    scheduleSteps: s.schedule.map((p) => ({ duration: p.dur, durationUnit: p.unit, type: p.type })),
    evalItems: s.endpoints.map((e) => ({ name: e.name, enabled: true })),
    reportWeeks: m.reportWeeks, inductionMethod: s.params.induction, isInVitro: m.isInVitro,
    cellLine: m.cellLine, categoryCode: m.categoryCode, positiveControl: m.positiveControl,
    animalUnitPrice: animalPrice(s.params), animalVendor: s.params.vendor,
    housingRate: getHousingRate(speciesWord(s.params.strain)),
    doseFactor: freq.factor, doseLabel: (freq.label.match(/\(([^)]+)\)/) || [])[1] || freq.label,
  });
  return { items, total: calculateTotalCost(items), byCat: calculateCostByCategory(items) };
}

export type QuoteTotals = { wp: number; disc: number; vat: number; marginAmt: number; discAmt: number; vatAmt: number };

/** 원가 → 견적가(+영업이익) → 할인가 → VAT 포함. */
export function computeQuote(total: number, margin: number, discount: number): QuoteTotals {
  const wp = Math.round(total * (1 + margin));
  const disc = Math.round(wp * (1 - discount));
  const vat = Math.round(disc * 1.1);
  return { wp, disc, vat, marginAmt: wp - total, discAmt: wp - disc, vatAmt: vat - disc };
}

export const findModel = (id: string): StudyModel => STUDY_MODELS.find((x) => x.id === id) ?? STUDY_MODELS[0];
