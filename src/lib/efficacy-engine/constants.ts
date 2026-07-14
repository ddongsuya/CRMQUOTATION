// 효력시험 위저드 상수 — 원본: design_handoff_efficacy_quotation/효력시험 견적서.dc.html (L489~517).
// PHASE 색은 DC 값(= 스크린샷 페이즈 스트립과 일치). README §7의 PHASE 항목은 "§engine/DC 참조"로 DC에 위임한다.

export type PhaseType = 'acclimation' | 'induction' | 'administration' | 'observation' | 'analysis' | 'sacrifice' | 'report';

export const PHASE: Record<PhaseType, { label: string; color: string }> = {
  acclimation: { label: '순화', color: '#4a7ba6' },
  induction: { label: '유발', color: '#d1685a' },
  administration: { label: '투여', color: '#3f8fbf' },
  observation: { label: '관찰', color: '#2f9e73' },
  analysis: { label: '분석', color: '#8b6fc4' },
  sacrifice: { label: '부검', color: '#e0953d' },
  report: { label: '보고서', color: '#6b7280' },
};

/** 편집 가능한 단계 유형(보고서 제외) */
export const PHASE_TYPES: PhaseType[] = ['acclimation', 'induction', 'administration', 'observation', 'analysis', 'sacrifice'];

/** 노드 링 색 — 노션 팔레트 순환 */
export const CHEV = ['#4a8bbf', '#d1685a', '#4a9e88', '#d99a3c', '#9a72c4', '#c76b98', '#7d8a5c', '#5b7fb5'];

export const ROUTES = [
  '경구 (PO)', '정맥 (IV)', '정맥 infusion', '복강 (IP)', '피하 (SC)', '근육 (IM)', '경피 (도포)',
  '점안 (안구)', '비강 (IN)', '흡입', '종양내 (IT)', '관절강내 (IA)', '뇌실내 (ICV)', '척수강내 (ITh)', '직장 (PR)',
];

export type DoseFreq = { key: string; label: string; factor: number };
export const DOSE_FREQ: DoseFreq[] = [
  { key: 'qd', label: '1회/1일 (QD)', factor: 1 },
  { key: 'bid', label: '2회/1일 (BID)', factor: 2 },
  { key: 'tid', label: '3회/1일 (TID)', factor: 3 },
  { key: 'qid', label: '4회/1일 (QID)', factor: 4 },
  { key: 'qod', label: '격일 (QOD)', factor: 0.5 },
  { key: 'qw', label: '1회/1주 (QW)', factor: 0.1429 },
  { key: 'biw', label: '2회/1주 (BIW)', factor: 0.2857 },
  { key: 'tiw', label: '3회/1주 (TIW)', factor: 0.4286 },
  { key: 'q2w', label: '1회/2주 (Q2W)', factor: 0.0714 },
  { key: 'single', label: '단회 (Single)', factor: 0.0357 },
];

/** strain 문자열 → 사육비 산정용 종 키워드 */
export function speciesWord(strain: string): string {
  const s = (strain || '').toLowerCase();
  if (/sd|wistar|shr|lewis|rat|f344|zucker/.test(s)) return 'rat';
  if (/c57|balb|icr|dba|nod|nog|scid|nude|hairless|foxn1|cd-1|athymic|mouse/.test(s)) return 'mouse';
  if (/guinea/.test(s)) return 'guinea';
  if (/rabbit|토끼/.test(s)) return 'rabbit';
  if (/beagle|dog/.test(s)) return 'beagle';
  if (/pig|돼지/.test(s)) return 'pig';
  return 'rat';
}

export function uid(): string { return Math.random().toString(36).slice(2, 9); }
export function fmt(n: number): string { return (n || 0).toLocaleString('ko-KR'); }
