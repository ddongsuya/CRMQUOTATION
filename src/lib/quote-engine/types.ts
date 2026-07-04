/**
 * 견적 규칙 엔진 v2 — 타입.
 * 데이터: data/master_items.v2.json (426항목, 보강완료 통합마스터)
 *        data/rules_catalog.v1.json (33룰)
 * 설계: docs/quote-engine-binding.md
 */

export type Standard = 'MFDS' | 'OECD';
export type PriceBox = { MFDS: number | null; OECD: number | null };

export type MasterItem = {
  id: string;
  category: string;
  testClass: string | null;
  testName: string | null;
  species: string | null;
  dosingPeriod: string | null;
  studyWeeks: number | null;
  componentCount: string | null;   // "2종" 등
  analysisMethod: string | null;   // 개별 / 동시
  tkPoints: string | null;         // "6point" 등
  tkMode: string | null;           // 채혈만 / 채혈+분석
  groupComposition: string | null;
  prices: { 경구피하근육: PriceBox; 정맥경피: PriceBox };
  hamryangApply: string | null;
  hamryangCount: string | null;
  guidelineCode: string | null;
  detail: string | null;
  guidelineSummary: string | null;
  notice: string | null;
  dataSource: string | null;
  reviewStatus: string | null;
  memo: string | null;
  srcRow: number | string;
  subtype?: string | null;          // 건기식 하위유형(개별인정형/프로바이오틱스/한시적식품)
};

export type QuoteInput = {
  category: string;                 // 모달리티 (= file_type 대응)
  standard: Standard;               // 제출처 가격기준
  route: string;                    // 투여경로 (경구·피하·정맥·경피 등)
  submissionTarget?: string;        // 국내 / USFDA / EMA
  selectedItems: { id: string; quantity?: number }[];
  customerConditions?: Record<string, boolean>;   // WV/SB/CG 트리거 토글
  requestedAddons?: Record<string, boolean>;      // AD(optional) 채택 여부
  combinationCount?: number;        // 복합제 종수
  extraLines?: LineItem[];          // 계산 산출 라인(함량분석·조제물분석 R2/R8) — 마스터 항목 아님
  quantityOverrides?: Record<string, number>;   // step4 수량 조정 (라인 id → 수량)
  removedIds?: string[];            // step4 삭제한 라인 id
};

export type LineItem = {
  id: string;
  testName: string;
  route: string;                    // 사용자가 고른 경로 그대로 표시
  testClass?: string | null;        // 시험 분류 (step4 그룹핑)
  unitPrice: number | null;
  quantity: number;
  amount: number | null;
  appliedRules: string[];
  notes: string[];
  isPrereq?: boolean;               // 선행 자동추가 라인
};

export type MissingInfo = { id?: string; level: 'blocker' | 'warning'; message: string };
export type WaivedItem = { id: string; testName: string; ruleId: string; reason: string };
export type Addon = { ruleId: string; name: string; price: number; optional: boolean; note?: string };
export type DocRequirement = { ruleId: string; document: string; mandatory: boolean };

export type Quote = {
  input: QuoteInput;
  lineItems: LineItem[];
  waivedItems: WaivedItem[];
  addons: Addon[];
  prerequisitesAdded: LineItem[];
  documentRequirements: DocRequirement[];
  totals: { lineItemsKrw: number; addonsKrw: number; subtotalKrw: number };
  missingInfo: MissingInfo[];
  metaNotes: string[];
  ruleLog: { step: string; msg: string }[];
};
