/**
 * in vitro 대사·PK (DMPK) 신규 항목 추가 — 2025 'in vitro metabolism 견적서' 기준.
 * 정밀리포트에서 유일하게 "앱에 시험유형 자체가 없던" 카테고리. 7개 in vitro 에세이.
 * 재실행 안전: 기존 대사PK_ 항목 제거 후 재생성.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'test_items.json');
const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const SRC = '대사PK_항목_마스터';

const DEFS = [
  { id: 1, name: 'Caco-2 막투과성 (A-B)', price: 3_000_000, g: 'Caco-2 흡수투과성 (A→B). DMPK 스크리닝' },
  { id: 2, name: '혈장단백결합 시험 (Plasma protein binding, human)', price: 1_500_000, g: 'human plasma 단백결합률 (free fraction)' },
  { id: 3, name: '대사안정성 시험 (Metabolic stability, human microsome/S9, 5~6 point)', price: 2_000_000, g: 'human microsome/S9 대사안정성 (t1/2, CLint)' },
  { id: 4, name: '대사체 확인 시험 (Metabolite ID, human microsome/S9)', price: 1_500_000, g: 'human microsome/S9 주요 대사체 프로파일링' },
  { id: 5, name: 'CYP 저해 시험 9종 (1 dose)', price: 3_500_000, g: 'CYP 9종(1A2,2A6,2B6,2C8,2C9,2C19,2D6,2E1,3A4) 직접저해 (1 dose)' },
  { id: 6, name: 'CYP 저해 시험 TDI 9종 (1 dose)', price: 6_000_000, g: 'CYP 9종 시간의존적 저해(TDI, 1 dose)' },
  { id: 7, name: 'LC-MS/MS 분석 셋팅비 (대사체 1종 기준)', price: 5_000_000, g: '대사체 확인 시험용 LC-MS/MS 분석법 셋팅 (대사체 1종)' },
];

const before = items.length;
let arr = items.filter(x => !(x.key && x.key.startsWith('대사PK_')));
console.log('기존 대사PK 항목 제거:', before - arr.length, '건');

for (const d of DEFS) {
  arr.push({
    key: `${SRC}#대사PK#${d.id}__`,
    masterId: `${SRC}#대사PK#${d.id}`,
    testName: d.name,
    modalityPool: ['in vitro 대사·PK'],
    category: 'in vitro 대사·PK',
    status: '자동',
    adminRoute: null,
    routeGroup: 'NONE',
    adminDuration: null,
    studyWeeks: null,
    priceMfds: d.price,
    priceOecd: d.price,
    isPrerequisite: false,
    sourceFile: SRC,
    sourceSheet: 'in vitro metabolism',
    sourceRow: d.id,
    hamryangApply: null, hamryangCount: null, hamryangUnit: 0,
    hamryangRule: 'in vitro DMPK — 함량분석 대상 아님',
    excipientBranch: null, linkRelation: null, parentTest: null,
    optionality: '의뢰자결정(선택)', linkBasis: null, quoteWeeks: null,
    detail: d.g,
    quoteText: d.name + '\n- ' + d.g,
    guideline: d.g + ' · ICH M3(R2)/S3A 약물동태 보조시험',
    notice: null,
  });
}

const ks = arr.map(x => x.key);
if (new Set(ks).size !== ks.length) { console.error('❌ key 중복'); process.exit(1); }
console.log('in vitro 대사·PK 항목:', DEFS.length, '개 추가');
fs.writeFileSync(FILE, JSON.stringify(arr, null, 2) + '\n', 'utf8');
console.log('✅ 저장 완료 (총', arr.length, '항목)');
