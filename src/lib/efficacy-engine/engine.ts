// 효력시험 단가표(74항목) + 동물 구입업체 가격표 + 비용 계산 엔진.
// 원본: design_handoff_efficacy_quotation/efficacy-engine.js
//       (= lib/efficacy-v2/master-data.ts · animal-prices.ts · cost-engine.ts)
// 단가·매핑·계산식은 원본 그대로. 임의 수정 금지.

export type PriceRow = { id: number; category: string; code: string; name: string; price: number; unit: string; note: string };
export type AnimalPriceRow = { vendor: string; strain: string; priceByWeek: Record<string, number> };
export type AgedAnimalRow = { monthAge: number; SD: number; C57BL6N: number; ICR: number };
export type BestPriceRow = { strain: string; ageWeek: string; bestPrice: number; bestVendor: string };

export type ScheduleStep = { duration: number; durationUnit: 'week' | 'day' | 'hour'; type: string };
export type EvalItem = { name: string; enabled: boolean };

export type CostInput = {
  species: string; ageWeeks: number; animalsPerGroup: number; groupCount: number;
  scheduleSteps: ScheduleStep[]; evalItems: EvalItem[]; reportWeeks?: number;
  inductionMethod?: string; isInVitro?: boolean; cellLine?: string; categoryCode?: string; positiveControl?: string;
  animalUnitPrice?: number; animalVendor?: string; housingRate?: number; doseFactor?: number; doseLabel?: string;
};
export type CostItem = {
  id: string; isOverridden: boolean; sortOrder: number;
  category: string; name: string; unitPrice: number; quantity: number; multiplier: number; subtotal: number;
};

// ============================================================
// 내부 단가표 (74개 항목 / 12 카테고리)
// ============================================================
export const PRICE_TABLE: PriceRow[] = [
  { id: 1,  category: '사육비', code: 'HOUSING_RAT',   name: '랫드 사육',        price: 2000,    unit: '/head/일',   note: '' },
  { id: 2,  category: '사육비', code: 'HOUSING_MOUSE', name: '마우스 사육',       price: 1500,    unit: '/head/일',   note: '' },
  { id: 3,  category: '사육비', code: 'HOUSING_GUINEA',name: '기니피그/햄스터',    price: 10000,   unit: '/head/일',   note: '' },
  { id: 4,  category: '사육비', code: 'HOUSING_RABBIT',name: '토끼 사육',        price: 20000,   unit: '/head/일',   note: '' },
  { id: 5,  category: '사육비', code: 'HOUSING_BEAGLE',name: '비글 사육',        price: 30000,   unit: '/head/일',   note: '' },
  { id: 6,  category: '사육비', code: 'HOUSING_PIG',   name: '돼지 사육',        price: 40000,   unit: '/head/일',   note: '' },
  { id: 7,  category: '질환유발모델', code: 'MODEL_CHEM',      name: '화학물질 유도 모델',   price: 30000,   unit: '/head', note: 'Formalin/SNL/CCI 차이' },
  { id: 8,  category: '질환유발모델', code: 'MODEL_TAC',       name: 'TAC 심부전 (최상)',   price: 500000,  unit: '/head', note: '' },
  { id: 9,  category: '질환유발모델', code: 'MODEL_SNL',       name: 'SNL 통증 (상)',      price: 300000,  unit: '/head', note: '' },
  { id: 10, category: '질환유발모델', code: 'MODEL_CCI',       name: 'CCI 통증 (중)',      price: 200000,  unit: '/head', note: '' },
  { id: 11, category: '질환유발모델', code: 'MODEL_MIA',       name: 'MIA 골관절염 (저)',   price: 50000,   unit: '/head', note: '' },
  { id: 12, category: '질환유발모델', code: 'MODEL_AMYLOID',   name: '치매 amyloid beta',  price: 100000,  unit: '/head', note: '뇌실내투여' },
  { id: 13, category: '질환유발모델', code: 'MODEL_PARKINSON', name: '파킨슨 모델',        price: 120000,  unit: '/head', note: '랫드 뇌실질내투여' },
  { id: 14, category: '질환유발모델', code: 'MODEL_HPD',       name: 'HPD 비글견 수술',    price: 5000000, unit: '/head', note: '금속관/클립/기계 별도' },
  { id: 15, category: '질환유발모델', code: 'MODEL_OA_MOUSE',  name: '골관절염 ACLT+DMM(마우스)', price: 100000, unit: '/head', note: '' },
  { id: 16, category: '질환유발모델', code: 'MODEL_OA_RAT',    name: '골관절염 ACLT+DMM(랫드)',  price: 100000, unit: '/head', note: '' },
  { id: 17, category: '질환유발모델', code: 'MODEL_OA_RABBIT', name: '골관절염 ACLT+DMM(토끼)',  price: 200000, unit: '/head', note: '' },
  { id: 18, category: '질환유발모델', code: 'MODEL_OVA',       name: 'OVA 만성천식모델',    price: 100000,  unit: '/head', note: '' },
  { id: 19, category: '투여(소동물)', code: 'ADMIN_PO_IP_IM',   name: '일반(경구/복강/근육)',  price: 5000,    unit: '/head', note: '' },
  { id: 20, category: '투여(소동물)', code: 'ADMIN_IV',         name: '정맥',               price: 20000,   unit: '/head', note: '' },
  { id: 21, category: '투여(소동물)', code: 'ADMIN_IV_INF_SURG',name: '정맥infusion(수술)',  price: 100000,  unit: '/head', note: '' },
  { id: 22, category: '투여(소동물)', code: 'ADMIN_IV_INF_HR',  name: '정맥infusion(시간당)', price: 70000,   unit: '/head/시간', note: '' },
  { id: 23, category: '투여(소동물)', code: 'ADMIN_SPECIAL',    name: '특수(개복/수술)',      price: 300000,  unit: '/head', note: '' },
  { id: 24, category: '투여(대동물)', code: 'ADMIN_LG_PO_IM',   name: '일반(경구/근육)',      price: 10000,   unit: '/head', note: '' },
  { id: 25, category: '투여(대동물)', code: 'ADMIN_LG_IV',      name: '정맥bolus',          price: 30000,   unit: '/head', note: '' },
  { id: 26, category: '투여(대동물)', code: 'ADMIN_LG_INF',     name: '정맥infusion(시간당)', price: 150000,  unit: '/head/시간', note: '' },
  { id: 27, category: '투여(대동물)', code: 'ADMIN_LG_SURG',    name: '특수(개복/수술)',      price: 500000,  unit: '/head', note: '' },
  { id: 28, category: '항암', code: 'TUMOR_SC',      name: '암세포 피하투여',    price: 70000,   unit: '/head', note: '' },
  { id: 29, category: '항암', code: 'TUMOR_IV',      name: '암세포 정맥투여',    price: 100000,  unit: '/head', note: '' },
  { id: 30, category: '항암', code: 'CELL_CULTURE',  name: '세포배양비',        price: 100000,  unit: '/일',    note: '2주 소요' },
  { id: 31, category: '항암', code: 'TUMOR_SIZE',    name: '종양크기측정',      price: 5000,    unit: '/head', note: '' },
  { id: 32, category: '항암', code: 'TUMOR_WEIGHT',  name: '종양무게측정',      price: 5000,    unit: '/head', note: '' },
  { id: 33, category: '항암', code: 'CELL_ATCC',     name: '암세포(ATCC 미국)', price: 2000000, unit: '/vial', note: '' },
  { id: 34, category: '항암', code: 'CELL_DOMESTIC', name: '암세포(국내세포주은행)', price: 300000, unit: '/vial', note: '' },
  { id: 35, category: '체중/체온', code: 'BW_TEMP',   name: '체중&체온(무마취)',  price: 10000,   unit: '/head', note: '' },
  { id: 36, category: '행동평가', code: 'WATER_MAZE', name: 'Water maze',      price: 70000,   unit: '/head', note: '난이도 중' },
  { id: 37, category: '행동평가', code: 'Y_MAZE',     name: 'Y maze',          price: 50000,   unit: '/head', note: '난이도 하' },
  { id: 38, category: '행동평가', code: 'GRIP',       name: 'Grip strength',   price: 70000,   unit: '/head', note: '' },
  { id: 39, category: '행동평가', code: 'ROTAROD',    name: 'Rota-rod',        price: 50000,   unit: '/head', note: '3일 적응' },
  { id: 40, category: '행동평가', code: 'TREADMILL',  name: 'Treadmill',       price: 40000,   unit: '/head', note: '2일 적응' },
  { id: 41, category: '행동평가', code: 'HANGING',    name: 'Hanging test',    price: 90000,   unit: '/head', note: '' },
  { id: 42, category: '행동평가', code: 'PA',         name: 'Passive avoidance', price: 70000, unit: '/head', note: '' },
  { id: 43, category: '행동평가', code: 'RANDALL',    name: 'Randall-Selitto', price: 10000,   unit: '/head', note: '압통' },
  { id: 44, category: '행동평가', code: 'VON_FREY',   name: 'Von Frey',        price: 60000,   unit: '/head', note: '' },
  { id: 45, category: '영상', code: 'MRI_RAT',    name: 'MRI(랫드 1site)', price: 200000,  unit: '/head', note: '' },
  { id: 46, category: '영상', code: 'MRI_RABBIT', name: 'MRI(토끼 1site)', price: 300000,  unit: '/head', note: '' },
  { id: 47, category: '영상', code: 'MRI_TRANS',  name: 'MRI 운송+출장',   price: 2000000, unit: '/회',   note: '외부' },
  { id: 48, category: '영상', code: 'DEXA',       name: 'DEXA',           price: 200000,  unit: '/head', note: '' },
  { id: 49, category: '영상', code: 'MICRO_CT',   name: 'Micro-CT',       price: 250000,  unit: '/head', note: '' },
  { id: 50, category: '영상', code: 'ECHO',       name: '초음파(echo)',     price: 250000,  unit: '/head', note: '' },
  { id: 51, category: '영상', code: 'HEMODY',     name: 'Hemodynamics',   price: 500000,  unit: '/head', note: '' },
  { id: 52, category: '분자생물학/채혈', code: 'PCR',        name: 'PCR',            price: 60000,   unit: '/head', note: '시약포함' },
  { id: 53, category: '분자생물학/채혈', code: 'GASTRIC_PH', name: '위산도측정',       price: 20000,   unit: '/head', note: '' },
  { id: 54, category: '분자생물학/채혈', code: 'GASTRIC_COL',name: '위산채취',        price: 20000,   unit: '/head', note: '' },
  { id: 55, category: '분자생물학/채혈', code: 'BL_BEAGLE',  name: '채혈(비글 경정맥)', price: 20000,   unit: '/head/회', note: '' },
  { id: 56, category: '분자생물학/채혈', code: 'BL_RAT',     name: '채혈(랫드 경정맥)', price: 15000,   unit: '/head/회', note: '' },
  { id: 57, category: '분자생물학/채혈', code: 'BL_PIG',     name: '채혈(돼지 경정맥)', price: 30000,   unit: '/head/회', note: '' },
  { id: 58, category: '분자생물학/채혈', code: 'BL_GLUCOSE', name: '혈당채혈(꼬리끝)',  price: 10000,   unit: '/head/회', note: '' },
  { id: 59, category: '분자생물학/채혈', code: 'BL_NECRO',   name: '채혈(부검시 복대정맥)', price: 15000, unit: '/head/회', note: '' },
  { id: 60, category: '분자생물학/채혈', code: 'PLASMA_CK',  name: '혈장CK분석',       price: 10000,   unit: '/head', note: '' },
  { id: 61, category: '분자생물학/채혈', code: 'QC',         name: 'QC',             price: 200000,  unit: '/head', note: '' },
  { id: 62, category: '분자생물학/채혈', code: 'WESTERN',    name: 'Western blot',   price: 50000,   unit: '/head/단백질1종', note: '항체 별도 60~100만' },
  { id: 63, category: '분자생물학/채혈', code: 'ELISA_LABOR',name: 'ELISA(인건비)',    price: 50000,   unit: '/head', note: '' },
  { id: 64, category: '분자생물학/채혈', code: 'ELISA_KIT',  name: 'ELISA kit',      price: 1000000, unit: '/개',   note: '' },
  { id: 65, category: '분자생물학/채혈', code: 'NECROPSY',   name: '부검(장기무게 등)', price: 20000,   unit: '/head', note: '' },
  { id: 66, category: '조직병리', code: 'HE_MT',      name: 'H&E/MT staining', price: 100000,  unit: '/head', note: '' },
  { id: 67, category: '조직병리', code: 'SAFRANIN',   name: 'Safranin-O',      price: 90000,   unit: '/head', note: '' },
  { id: 68, category: '조직병리', code: 'IHC',        name: 'IHC staining',    price: 200000,  unit: '/head', note: '항체 별도' },
  { id: 69, category: '조직병리', code: 'UNSTAIN',    name: 'Unstain slide',   price: 10000,   unit: '/head', note: '기본3장' },
  { id: 70, category: '조직병리', code: 'UNSTAIN_ADD',name: 'Unstain 추가',     price: 2000,    unit: '/장',   note: '' },
  { id: 71, category: '조직병리', code: 'HISTO_RPT',  name: '조직병리 보고서',    price: 1000000, unit: '/건',   note: '' },
  { id: 72, category: '기타', code: 'REPORT_ETC', name: '보고서+기타', price: 3000000, unit: '/건', note: '영업이익10%반영' },
  { id: 73, category: '양성대조물질', code: 'PC_GABA', name: 'Gabapentin(시그마)', price: 689896, unit: '/EA', note: '1287303, 250mg' },
  { id: 74, category: '양성대조물질', code: 'PC_PREG', name: 'Pregabalin(시그마)', price: 323379, unit: '/EA', note: 'Y0001805' },
];

export function getPriceByCode(code: string): PriceRow | undefined { return PRICE_TABLE.find(p => p.code === code); }

export const PRICE_CATEGORIES: string[] = ['사육비','질환유발모델','투여(소동물)','투여(대동물)','항암','체중/체온','행동평가','영상','분자생물학/채혈','조직병리','기타','양성대조물질'];

// ============================================================
// 동물 가격표 (업체 3사) + 최저가/고주령
// ============================================================
export const ANIMAL_PRICES: AnimalPriceRow[] = [
  { vendor: '자바이오', strain: 'BALB/c-nu/ArcGem', priceByWeek: { '4W':50000,'5W':55000,'6W':60000,'7W':65000,'8W':70000 } },
  { vendor: '자바이오', strain: 'BALB/c', priceByWeek: { '3W':16500,'4W':17000,'5W':18500,'6W':19000,'7W':20600,'8W':21500 } },
  { vendor: '자바이오', strain: 'C57BL/6N', priceByWeek: { '3W':16500,'4W':17000,'5W':18500,'6W':19000,'7W':20600,'8W':21500 } },
  { vendor: '자바이오', strain: 'C57BL/6J', priceByWeek: { '3W':17500,'4W':18000,'5W':19200,'6W':19800,'7W':21500,'8W':22500 } },
  { vendor: '자바이오', strain: 'ICR', priceByWeek: { '3W':6500,'4W':7200,'5W':7900,'6W':7900,'7W':7900,'8W':7900 } },
  { vendor: '자바이오', strain: 'SD', priceByWeek: { '3W':16500,'4W':17000,'5W':18500,'6W':19000,'7W':20000,'8W':21000 } },
  { vendor: '오리엔트바이오', strain: 'SD (Crl:CD)', priceByWeek: { '3W':23000,'4W':20300,'5W':24400,'6W':28500,'7W':32500,'8W':36000 } },
  { vendor: '오리엔트바이오', strain: 'Wistar', priceByWeek: { '3W':20900,'4W':23600,'5W':25000,'6W':29300,'7W':33400,'8W':37000 } },
  { vendor: '오리엔트바이오', strain: 'ICR', priceByWeek: { '3W':8300,'4W':7800,'5W':9200,'6W':9700,'7W':11100,'8W':12500 } },
  { vendor: '오리엔트바이오', strain: 'C57BL/6N', priceByWeek: { '3W':25000,'4W':25000,'5W':27800,'6W':29300,'7W':33400,'8W':37000 } },
  { vendor: '오리엔트바이오', strain: 'DBA/1J', priceByWeek: { '3W':41700,'4W':41700,'5W':46000,'6W':48700,'7W':52900,'8W':57100 } },
  { vendor: '오리엔트바이오', strain: 'SKH1-hairless', priceByWeek: { '5W':64000,'6W':64000,'7W':64000,'8W':73800 } },
  { vendor: '오리엔트바이오', strain: 'Foxn1 nu (nude)', priceByWeek: { '5W':64000,'6W':69000,'7W':74000,'8W':79000 } },
  { vendor: '코아텍', strain: 'SD', priceByWeek: { '3W':17000,'4W':18000,'5W':19000,'6W':20000,'7W':22000,'8W':24000,'9W':26000,'10W':29000,'11W':32000,'12W':35000 } },
  { vendor: '코아텍', strain: 'ICR (CD-1)', priceByWeek: { '3W':5300,'4W':5800,'5W':6300,'6W':6800,'7W':7300,'8W':7800,'9W':8300,'10W':9500,'11W':10500,'12W':12000 } },
  { vendor: '코아텍', strain: 'C57BL/6N', priceByWeek: { '3W':17000,'4W':18000,'5W':19000,'6W':20000,'7W':22000,'8W':24000,'9W':26000,'10W':29000,'11W':32000,'12W':35000 } },
  { vendor: '코아텍', strain: 'BALB/c', priceByWeek: { '3W':15000,'4W':16000,'5W':17000,'6W':18000,'7W':20000,'8W':22000,'9W':24000,'10W':26000,'11W':28000,'12W':30000 } },
  { vendor: '코아텍', strain: 'DBA/1J (CBA/J)', priceByWeek: { '3W':29500,'4W':31500,'5W':33500,'6W':35500,'7W':38000,'8W':40500 } },
  { vendor: '코아텍', strain: 'Athymic nu/nu', priceByWeek: { '3W':42000,'4W':53000,'5W':58000,'6W':63000,'7W':69000 } },
  { vendor: '코아텍', strain: 'SCID', priceByWeek: { '4W':95000,'5W':105000,'6W':115000,'7W':130000 } },
  { vendor: '코아텍', strain: 'NOD.SCID', priceByWeek: { '4W':140000,'5W':150000,'6W':160000,'7W':170000 } },
  { vendor: '코아텍', strain: 'NOG', priceByWeek: { '4W':175000,'5W':185000,'6W':195000,'7W':205000 } },
];

export const AGED_ANIMAL_PRICES: AgedAnimalRow[] = [
  { monthAge: 3, SD: 35000, C57BL6N: 35000, ICR: 11000 }, { monthAge: 4, SD: 50000, C57BL6N: 40000, ICR: 20000 },
  { monthAge: 5, SD: 64000, C57BL6N: 45000, ICR: 29000 }, { monthAge: 6, SD: 79000, C57BL6N: 51000, ICR: 40000 },
  { monthAge: 7, SD: 94000, C57BL6N: 65000, ICR: 51000 }, { monthAge: 8, SD: 122000, C57BL6N: 94000, ICR: 65000 },
  { monthAge: 9, SD: 165000, C57BL6N: 122000, ICR: 79000 }, { monthAge: 10, SD: 208000, C57BL6N: 151000, ICR: 100000 },
  { monthAge: 11, SD: 251000, C57BL6N: 179000, ICR: 114000 }, { monthAge: 12, SD: 294000, C57BL6N: 208000, ICR: 136000 },
];

export const BEST_PRICE_TABLE: BestPriceRow[] = [
  { strain: 'SD rat', ageWeek: '5W', bestPrice: 18500, bestVendor: '자바이오' },
  { strain: 'SD rat', ageWeek: '6W', bestPrice: 19000, bestVendor: '자바이오' },
  { strain: 'SD rat', ageWeek: '7W', bestPrice: 20000, bestVendor: '자바이오' },
  { strain: 'SD rat', ageWeek: '8W', bestPrice: 21000, bestVendor: '자바이오' },
  { strain: 'ICR', ageWeek: '5W', bestPrice: 6300, bestVendor: '코아텍' },
  { strain: 'ICR', ageWeek: '6W', bestPrice: 6800, bestVendor: '코아텍' },
  { strain: 'ICR', ageWeek: '7W', bestPrice: 7300, bestVendor: '코아텍' },
  { strain: 'ICR', ageWeek: '8W', bestPrice: 7800, bestVendor: '코아텍' },
  { strain: 'C57BL/6N', ageWeek: '5W', bestPrice: 18500, bestVendor: '자바이오' },
  { strain: 'C57BL/6N', ageWeek: '6W', bestPrice: 19000, bestVendor: '자바이오' },
  { strain: 'C57BL/6N', ageWeek: '7W', bestPrice: 20600, bestVendor: '자바이오' },
  { strain: 'C57BL/6N', ageWeek: '8W', bestPrice: 21500, bestVendor: '자바이오' },
  { strain: 'BALB/c', ageWeek: '5W', bestPrice: 17000, bestVendor: '코아텍' },
  { strain: 'BALB/c', ageWeek: '6W', bestPrice: 18000, bestVendor: '코아텍' },
  { strain: 'BALB/c', ageWeek: '7W', bestPrice: 20000, bestVendor: '코아텍' },
  { strain: 'BALB/c', ageWeek: '8W', bestPrice: 21500, bestVendor: '자바이오' },
];

export function getAnimalPrice(species: string, ageWeeks: number): number {
  const weekKey = `${ageWeeks}W`;
  const s = (species || '').toLowerCase();
  const best = BEST_PRICE_TABLE.find(b => b.strain.toLowerCase().includes(s) || s.includes(b.strain.toLowerCase()));
  if (best && best.ageWeek === weekKey) return best.bestPrice;
  let lowest: number | null = null;
  for (const e of ANIMAL_PRICES) {
    const strain = e.strain.toLowerCase();
    if (!strain.includes(s) && !s.includes(strain)) continue;
    const p = e.priceByWeek[weekKey];
    if (p != null && (lowest === null || p < lowest)) lowest = p;
  }
  if (lowest !== null) return lowest;
  for (const e of ANIMAL_PRICES) {
    const strain = e.strain.toLowerCase();
    if (!strain.includes(s) && !s.includes(strain)) continue;
    const weeks = Object.keys(e.priceByWeek).map(k => parseInt(k)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (!weeks.length) continue;
    const closest = weeks.reduce((prev, curr) => Math.abs(curr - ageWeeks) < Math.abs(prev - ageWeeks) ? curr : prev);
    const p = e.priceByWeek[`${closest}W`];
    if (p != null) return p;
  }
  if (ageWeeks >= 48) {
    const m = Math.round(ageWeeks / 4.3);
    const aged = AGED_ANIMAL_PRICES.find(a => a.monthAge === m);
    if (aged) { if (s.includes('sd') || s.includes('rat')) return aged.SD ?? 25000; if (s.includes('c57')) return aged.C57BL6N ?? 25000; if (s.includes('icr')) return aged.ICR ?? 25000; }
  }
  if (s.includes('db/db')) return 220000;
  if (s.includes('nc/nga')) return 85000;
  if (s.includes('als') || s.includes('transgenic')) return 340000;
  if (s.includes('shr')) return 30000;
  if (s.includes('lewis')) return 25000;
  if (s.includes('wistar')) return 20000;
  if (s.includes('btbr')) return 250000;
  if (s.includes('beagle') || s.includes('dog')) return 2000000;
  if (s.includes('pig') || s.includes('yucatan')) return 3000000;
  return 25000;
}

export function getHousingRate(species: string): number {
  const s = (species || '').toLowerCase();
  if (s.includes('rat')) return 2000;
  if (s.includes('mouse') || s.includes('mice')) return 1500;
  if (s.includes('guinea')) return 10000;
  if (s.includes('rabbit') || s.includes('토끼')) return 20000;
  if (s.includes('beagle') || s.includes('dog')) return 30000;
  if (s.includes('pig') || s.includes('돼지')) return 40000;
  return 2000;
}

// ============================================================
// 비용 계산 엔진 (cost-engine.ts 포팅)
// ============================================================
let sortCounter = 0;
function uid() { return Math.random().toString(36).slice(2, 10); }
function stepToDays(step: ScheduleStep): number { if (step.durationUnit === 'week') return step.duration * 7; if (step.durationUnit === 'day') return step.duration; return 1; }
export function calculateTotalDays(steps: ScheduleStep[]): number { return steps.reduce((s, x) => s + stepToDays(x), 0); }
export function calculateTotalWeeks(steps: ScheduleStep[]): number { return Math.ceil(calculateTotalDays(steps) / 7); }

function getInductionCost(method: string, species: string): { code: string; name: string; price: number } | null {
  if (!method) return null;
  const m = method.toLowerCase();
  const P = (c: string, def: number): number => getPriceByCode(c)?.price ?? def;
  if (m.includes('tac') || m.includes('transverse aortic')) return { code: 'MODEL_TAC', name: 'TAC 심부전 모델', price: P('MODEL_TAC', 500000) };
  if (m.includes('snl')) return { code: 'MODEL_SNL', name: 'SNL 통증 모델', price: P('MODEL_SNL', 300000) };
  if (m.includes('cci') || m.includes('chronic constriction')) return { code: 'MODEL_CCI', name: 'CCI 통증 모델', price: P('MODEL_CCI', 200000) };
  if (m.includes('mia') || m.includes('monosodium')) return { code: 'MODEL_MIA', name: 'MIA 골관절염', price: P('MODEL_MIA', 50000) };
  if (m.includes('amyloid') || m.includes('뇌실내')) return { code: 'MODEL_AMYLOID', name: '치매 amyloid beta', price: P('MODEL_AMYLOID', 100000) };
  if (m.includes('6-ohda') || m.includes('6-hydroxydopamine')) return { code: 'MODEL_PARKINSON', name: '파킨슨 모델', price: P('MODEL_PARKINSON', 120000) };
  if (m.includes('aclt') || m.includes('십자인대')) {
    const s = species.toLowerCase();
    if (s.includes('rabbit') || s.includes('토끼')) return { code: 'MODEL_OA_RABBIT', name: '골관절염 ACLT(토끼)', price: P('MODEL_OA_RABBIT', 200000) };
    if (s.includes('rat')) return { code: 'MODEL_OA_RAT', name: '골관절염 ACLT(랫드)', price: P('MODEL_OA_RAT', 100000) };
    return { code: 'MODEL_OA_MOUSE', name: '골관절염 ACLT(마우스)', price: P('MODEL_OA_MOUSE', 100000) };
  }
  if (m.includes('ovalbumin') || m.includes('ova')) return { code: 'MODEL_OVA', name: 'OVA 만성천식모델', price: P('MODEL_OVA', 100000) };
  if (m.includes('hpd')) return { code: 'MODEL_HPD', name: 'HPD 비글견 수술', price: P('MODEL_HPD', 5000000) };
  if (m.includes('stz') || m.includes('streptozotocin') || m.includes('bleomycin') || m.includes('scopolamine') || m.includes('loperamide') || m.includes('cyp') || m.includes('collagen') || m.includes('carrageenan') || m.includes('aspirin') || m.includes('hcl') || m.includes('에탄올') || m.includes('formalin') || m.includes('capsaicin') || m.includes('lps') || m.includes('dncb') || m.includes('phenol') || m.includes('citric'))
    return { code: 'MODEL_CHEM', name: '화학물질 유도 모델', price: P('MODEL_CHEM', 30000) };
  if (m.includes('수술') || m.includes('폐색') || m.includes('적출') || m.includes('mcao') || m.includes('절개') || m.includes('결찰') || m.includes('contusion') || m.includes('nephrectomy'))
    return { code: 'MODEL_CCI', name: '수술 기반 모델', price: P('MODEL_CCI', 200000) };
  return { code: 'MODEL_CHEM', name: '질환유발', price: 30000 };
}

function getAdminPrice(species: string): { code: string; price: number; isLarge: boolean } {
  const s = species.toLowerCase();
  if (s.includes('beagle') || s.includes('dog') || s.includes('pig') || s.includes('돼지') || s.includes('yucatan'))
    return { code: 'ADMIN_LG_PO_IM', price: getPriceByCode('ADMIN_LG_PO_IM')?.price ?? 10000, isLarge: true };
  return { code: 'ADMIN_PO_IP_IM', price: getPriceByCode('ADMIN_PO_IP_IM')?.price ?? 5000, isLarge: false };
}

function matchEvalToPrice(evalName: string): { code: string; category: string; price: number } {
  const n = evalName.toLowerCase();
  const P = (c: string, def: number): number => getPriceByCode(c)?.price ?? def;
  if (n.includes('h&e') || n.includes('collagen') || n.includes('masson') || n.includes('mt ')) return { code: 'HE_MT', category: '조직병리', price: P('HE_MT', 100000) };
  if (n.includes('safranin')) return { code: 'SAFRANIN', category: '조직병리', price: P('SAFRANIN', 90000) };
  if (n.includes('ihc')) return { code: 'IHC', category: '조직병리', price: P('IHC', 200000) };
  if (n.includes('조직병리') || n.includes('histol') || n.includes('stain')) return { code: 'HE_MT', category: '조직병리', price: P('HE_MT', 100000) };
  if (n.includes('micro-ct') || n.includes('micro ct')) return { code: 'MICRO_CT', category: '영상', price: P('MICRO_CT', 250000) };
  if (n.includes('mri')) return { code: 'MRI_RAT', category: '영상', price: P('MRI_RAT', 200000) };
  if (n.includes('dexa')) return { code: 'DEXA', category: '영상', price: P('DEXA', 200000) };
  if (n.includes('초음파') || n.includes('echo')) return { code: 'ECHO', category: '영상', price: P('ECHO', 250000) };
  if (n.includes('수미로') || n.includes('water maze') || n.includes('morris')) return { code: 'WATER_MAZE', category: '행동평가', price: P('WATER_MAZE', 70000) };
  if (n.includes('y maze')) return { code: 'Y_MAZE', category: '행동평가', price: P('Y_MAZE', 50000) };
  if (n.includes('rotarod') || n.includes('rota-rod')) return { code: 'ROTAROD', category: '행동평가', price: P('ROTAROD', 50000) };
  if (n.includes('von frey')) return { code: 'VON_FREY', category: '행동평가', price: P('VON_FREY', 60000) };
  if (n.includes('grip')) return { code: 'GRIP', category: '행동평가', price: P('GRIP', 70000) };
  if (n.includes('passive avoidance')) return { code: 'PA', category: '행동평가', price: P('PA', 70000) };
  if (n.includes('treadmill')) return { code: 'TREADMILL', category: '행동평가', price: P('TREADMILL', 40000) };
  if (n.includes('hanging')) return { code: 'HANGING', category: '행동평가', price: P('HANGING', 90000) };
  if (n.includes('randall')) return { code: 'RANDALL', category: '행동평가', price: P('RANDALL', 10000) };
  if (n.includes('행동') || n.includes('bbb')) return { code: 'WATER_MAZE', category: '행동평가', price: 70000 };
  if (n.includes('pcr') || n.includes('rt-pcr')) return { code: 'PCR', category: '분자생물학', price: P('PCR', 60000) };
  if (n.includes('western')) return { code: 'WESTERN', category: '분자생물학', price: P('WESTERN', 50000) };
  if (n.includes('elisa')) return { code: 'ELISA_LABOR', category: '분자생물학', price: P('ELISA_LABOR', 50000) };
  if (n.includes('hydroxyproline')) return { code: 'ELISA_LABOR', category: '분자생물학', price: 50000 };
  if (n.includes('종양부피') || n.includes('종양크기') || n.includes('tumor')) return { code: 'TUMOR_SIZE', category: '항암', price: P('TUMOR_SIZE', 5000) };
  if (n.includes('종양무게')) return { code: 'TUMOR_WEIGHT', category: '항암', price: P('TUMOR_WEIGHT', 5000) };
  if (n.includes('혈액') || n.includes('혈당') || n.includes('혈장') || n.includes('blood') || n.includes('hematol')) return { code: 'BL_NECRO', category: '채혈', price: P('BL_NECRO', 15000) };
  if (n.includes('부검') || n.includes('장기무게') || n.includes('necropsy')) return { code: 'NECROPSY', category: '부검', price: P('NECROPSY', 20000) };
  if (n.includes('체중') || n.includes('체온')) return { code: 'BW_TEMP', category: '체중/체온', price: P('BW_TEMP', 10000) };
  if (n.includes('위액') || n.includes('위산') || n.includes('ph')) return { code: 'GASTRIC_PH', category: '분자생물학', price: P('GASTRIC_PH', 20000) };
  if (n.includes('요역동학') || n.includes('hemodynamics')) return { code: 'HEMODY', category: '영상', price: P('HEMODY', 500000) };
  return { code: 'MISC', category: '측정', price: 30000 };
}

export function calculateCostItems(input: CostInput): CostItem[] {
  sortCounter = 0;
  const items: CostItem[] = [];
  const totalAnimals = input.animalsPerGroup * input.groupCount;
  const totalDays = calculateTotalDays(input.scheduleSteps);
  const totalWeeks = calculateTotalWeeks(input.scheduleSteps);
  const isOncology = input.categoryCode === 'XIII';
  const isInVitro = input.isInVitro ?? false;
  const push = (o: Omit<CostItem, 'id' | 'isOverridden' | 'sortOrder'>) => items.push({ id: uid(), isOverridden: false, sortOrder: sortCounter++, ...o });

  if (!isInVitro) {
    const ap = (input.animalUnitPrice != null && input.animalUnitPrice > 0) ? input.animalUnitPrice : getAnimalPrice(input.species, input.ageWeeks);
    const apName = input.animalVendor ? `${input.species} ${input.ageWeeks}주령 (${input.animalVendor})` : `${input.species} ${input.ageWeeks}주령`;
    push({ category: '동물비', name: apName, unitPrice: ap, quantity: totalAnimals, multiplier: 1, subtotal: ap * totalAnimals });
    const hr = (input.housingRate != null && input.housingRate > 0) ? input.housingRate : getHousingRate(input.species);
    push({ category: '사육비', name: `사육비 (${hr.toLocaleString()}원/head/일 × ${totalDays}일)`, unitPrice: hr, quantity: totalAnimals, multiplier: totalDays, subtotal: hr * totalAnimals * totalDays });
  }
  const induction = getInductionCost(input.inductionMethod ?? '', input.species);
  if (induction && !isInVitro) push({ category: '질환유발모델', name: induction.name, unitPrice: induction.price, quantity: totalAnimals, multiplier: 1, subtotal: induction.price * totalAnimals });

  if (isOncology && input.cellLine) {
    const cultureDays = 14, cp = getPriceByCode('CELL_CULTURE')?.price ?? 100000;
    push({ category: '항암', name: `세포배양 (${input.cellLine}, ${cultureDays}일)`, unitPrice: cp, quantity: 1, multiplier: cultureDays, subtotal: cp * cultureDays });
    const cell = getPriceByCode('CELL_DOMESTIC')?.price ?? 300000;
    push({ category: '항암', name: `세포주 (${input.cellLine})`, unitPrice: cell, quantity: 1, multiplier: 1, subtotal: cell });
    const tp = getPriceByCode('TUMOR_SC')?.price ?? 70000;
    push({ category: '항암', name: '암세포 피하투여', unitPrice: tp, quantity: totalAnimals, multiplier: 1, subtotal: tp * totalAnimals });
  }
  if (isInVitro && input.cellLine) {
    const cp = getPriceByCode('CELL_CULTURE')?.price ?? 100000;
    push({ category: '세포실험', name: `세포배양 (${input.cellLine})`, unitPrice: cp, quantity: 1, multiplier: totalDays, subtotal: cp * totalDays });
  }
  if (!isInVitro) {
    const admin = getAdminPrice(input.species);
    const adminDays = input.scheduleSteps.filter(s => s.type === 'administration').reduce((s, x) => s + stepToDays(x), 0) || Math.max(Math.round(totalDays * 0.4), 7);
    const doseFactor = input.doseFactor != null && input.doseFactor > 0 ? input.doseFactor : 1;
    const doseCount = Math.max(1, Math.round(adminDays * doseFactor));
    const adminName = input.doseLabel ? `시험물질 투여 (${adminDays}일 · ${input.doseLabel} · ${doseCount}회)` : `시험물질 투여 (${adminDays}일 · ${doseCount}회)`;
    push({ category: '투여', name: adminName, unitPrice: admin.price, quantity: totalAnimals, multiplier: doseCount, subtotal: admin.price * totalAnimals * doseCount });
    const bw = getPriceByCode('BW_TEMP')?.price ?? 10000;
    push({ category: '체중/체온', name: `체중측정 (주1회 × ${totalWeeks}회)`, unitPrice: bw, quantity: totalAnimals, multiplier: totalWeeks, subtotal: bw * totalAnimals * totalWeeks });
  }
  for (const ev of input.evalItems.filter(e => e.enabled)) {
    const matched = matchEvalToPrice(ev.name);
    const qty = isInVitro ? 1 : totalAnimals;
    push({ category: matched.category, name: ev.name, unitPrice: matched.price, quantity: qty, multiplier: 1, subtotal: matched.price * qty });
  }
  if (!isInVitro) {
    const np = getPriceByCode('NECROPSY')?.price ?? 20000;
    push({ category: '부검', name: '부검 (장기무게 등)', unitPrice: np, quantity: totalAnimals, multiplier: 1, subtotal: np * totalAnimals });
  }
  const rp = getPriceByCode('REPORT_ETC')?.price ?? 3000000;
  push({ category: '기타', name: '보고서 작성 및 기타', unitPrice: rp, quantity: 1, multiplier: 1, subtotal: rp });
  return items;
}

export function calculateTotalCost(items: CostItem[]): number { return items.reduce((s, x) => s + x.subtotal, 0); }
export function calculateCostByCategory(items: CostItem[]): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  for (const it of items) map[it.category] = (map[it.category] || 0) + it.subtotal;
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}
