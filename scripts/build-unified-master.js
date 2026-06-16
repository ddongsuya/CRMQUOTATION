/**
 * 통합 마스터 xlsx 생성기.
 *
 * 입력:
 *   - data/test_items.json              (2026 — 가격·세부내용 권위 기준)
 *   - data/_extracted_2025_quotes.json  (2025 — granularity 복원 + 누락 카테고리)
 *
 * 출력:
 *   - data/통합_시험항목_마스터_v1.xlsx
 *       시트1) 📖 사용 가이드      — 비개발자용 활용·검토 방법
 *       시트2) 📑 컬럼 설명         — 각 헤더의 의미
 *       시트3) 📋 전체 마스터       — 통합 데이터 (1행=1시험, 4가격 컬럼)
 *       시트4) 🔍 2025vs2026 비교  — 카테고리별 증감
 *
 * 규칙:
 *   - 가격/세부내용 = 2026 기준 (권위)
 *   - granularity(종수/분석방식/TK/군구성) = 2025 기준 복원
 *   - 2026 누락 카테고리(화학물질·점안제·발암성 등) = 2025 데이터 + 검수필요 플래그
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const items2026 = JSON.parse(fs.readFileSync(path.join(root, 'data', 'test_items.json'), 'utf8'));
const q2025 = JSON.parse(fs.readFileSync(path.join(root, 'data', '_extracted_2025_quotes.json'), 'utf8'));
const OUT = path.join(root, 'data', '통합_시험항목_마스터_v1.xlsx');

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const nkey = (s) => String(s ?? '').replace(/\s+/g, '');

// ── 가이드라인 사전 로드 (data/_guidelines.json) ──
let GUIDELINES = [];
try {
  GUIDELINES = JSON.parse(fs.readFileSync(path.join(root, 'data', '_guidelines.json'), 'utf8')).guidelines || [];
} catch (e) { console.warn('가이드라인 파일 없음:', e.message); }

// ── MFDS 시험설계 규칙 로드 (data/_mfds_design_rules.json) ──
let MFDS_RULES = [];
try {
  MFDS_RULES = JSON.parse(fs.readFileSync(path.join(root, 'data', '_mfds_design_rules.json'), 'utf8')).rules || [];
} catch (e) { console.warn('MFDS 규칙 파일 없음:', e.message); }

// ── 모달리티별 가이드라인 로드 (data/_modality_guidelines.json) ──
let MODALITIES = [];
try {
  MODALITIES = JSON.parse(fs.readFileSync(path.join(root, 'data', '_modality_guidelines.json'), 'utf8')).modalities || [];
} catch (e) { console.warn('모달리티 가이드라인 파일 없음:', e.message); }

// 시험명 → 해당 가이드라인 코드 자동 매핑 (시험명/분류 키워드 기반)
function matchGuidelines(testName, category, classification) {
  const n = String(testName || '');
  const hits = new Set();
  const add = (code) => { if (GUIDELINES.find(g => g.code === code)) hits.add(code); };

  // 유전독성
  if (/Ames|TG471|복귀돌연변이|에임스/i.test(n)) add('OECD TG 471');
  if (/염색체이상|TG473|chromosom/i.test(n)) add('OECD TG 473');
  if (/소핵|TG474|micronucleus/i.test(n)) { add('OECD TG 474'); if (/in vitro/i.test(n)) add('OECD TG 487'); }
  if (/MLA|TG490|thymidine|mouse lymphoma/i.test(n)) add('OECD TG 490');
  if (/Comet|코멧|TG489/i.test(n)) add('OECD TG 489');
  if (/Pig-a|TG470/i.test(n)) add('OECD TG 470');
  if (/유전독성/i.test(n)) add('ICH S2(R1)');

  // 일반독성 (기간 기반)
  if (/4주|28일|28-day/i.test(n) && /반복/i.test(n)) add('OECD TG 407');
  if (/13주|90일|90-day/i.test(n) && /반복/i.test(n)) { if (/비설치류|개|비글|dog/i.test(n)) add('OECD TG 409'); else add('OECD TG 408'); }
  if (/단회|급성|acute/i.test(n) && !/등급/i.test(n)) add('OECD TG 420');
  if (/등급법|toxic class/i.test(n)) add('OECD TG 423');
  if (/반복|단회|DRF|회복|TK/i.test(n)) add('ICH M3(R2)');
  if (/26주|39주|만성|chronic/i.test(n)) add('ICH S4');

  // 생식발생
  if (/배태자|prenatal|EFD/i.test(n)) add('OECD TG 414');
  if (/수태능|fertility|생식.*스크리닝/i.test(n)) add('OECD TG 421');
  if (/발달신경|neurotox.*develop/i.test(n)) add('OECD TG 426');
  if (/생식|배태자|수태능|출생|태반이행/i.test(n)) add('ICH S5(R3)');

  // 발암성
  if (/발암성|carcinogen/i.test(n)) { add('OECD TG 451'); add('ICH S1A'); add('ICH S1C(R2)'); }
  if (/52주|만성/i.test(n)) add('OECD TG 452');

  // 안전성약리·TK
  if (/중추신경|호흡기|심혈관|텔레메|Telemetry|안전성약리/i.test(n)) add('ICH S7A');
  if (/hERG|QT|IKr/i.test(n)) add('ICH S7B');
  if (/\bTK\b|독성동태|toxicokinetic|채혈/i.test(n)) add('ICH S3A');
  if (/면역독성|immunotox/i.test(n)) add('ICH S8');

  // 국소·감작·대체법
  if (/피부자극/i.test(n)) { add('OECD TG 404'); if (/RhE|reconstruct|대체/i.test(n)) add('OECD TG 439'); }
  if (/안자극|안점막/i.test(n)) { add('OECD TG 405'); if (/RhCE|cornea|대체/i.test(n)) add('OECD TG 492'); }
  if (/감작/i.test(n)) { add('OECD TG 406'); if (/LLNA|림프절|BrdU/i.test(n)) add('OECD TG 442B'); }
  if (/광독성|phototox/i.test(n)) { add('OECD TG 432'); add('ICH S10'); }
  if (/광감작/i.test(n)) add('ICH S10');

  // 생물의약품
  if (category === '생물의약품' || /항체|재조합|biolog/i.test(n)) add('ICH S6(R1)');

  return [...hits];
}

// 가이드라인 코드 → "OECD TG 408, ICH S4" 형태 문자열
function guidelineRefs(testName, category, classification) {
  const codes = matchGuidelines(testName, category, classification);
  return codes.join(', ');
}

// ── 함량분석 룰 (회사 합의 2026-05, engine/assemble.js 와 동일) ──
function hamryangCountForWeeks(weeks) {
  if (weeks == null || weeks === '' ) return 1;
  const w = Number(weeks);
  if (!Number.isFinite(w) || w === 0) return 1;  // 단회
  if (w <= 2) return 1;
  if (w <= 4) return 2;
  if (w <= 13) return 2;                          // 13주 = 회사 합의 2회
  return Math.floor(w / 4);                        // 26주↑ 4주마다
}

// 함량분석 적용여부(O/X) + 회수 산출
function hamryangApply(testName, classification, weeks) {
  const n = String(testName || '');
  // 제외: 회복군 / 조제물·함량분석 자체 / 보고서·서비스
  if (/회복/.test(n)) return { apply: 'X', count: 0, note: '본시험 약 공유' };
  if (/조제물\s*분석|함량\s*분석|Validation/i.test(n)) return { apply: 'X', count: 0, note: '분석 항목 자체' };
  if (/SEND|CTD|번역|영문|보고서/i.test(n)) return { apply: 'X', count: 0, note: '시험 아님(서비스)' };
  // 포함: 본시험·DRF·TK·유전독성·안전성약리 (동물투여 또는 in vitro 노출)
  if (/반복|단회|급성|DRF|예비|\bTK\b|독성동태|채혈|종양원성|발암|배태자|수태능|생식|출생|체내분포/i.test(n)) {
    return { apply: 'O', count: hamryangCountForWeeks(weeks), note: '' };
  }
  if (/Ames|TG471|염색체이상|TG473|소핵|TG474|MLA|Comet|유전독성/i.test(n)) {
    return { apply: 'O', count: 1, note: 'in vitro 노출농도 검증(GLP)' };
  }
  if (/안전성약리|hERG|중추신경|호흡기|심혈관|텔레메|Telemetry/i.test(n)) {
    return { apply: 'O', count: 1, note: 'in vitro/in vivo 노출농도 검증' };
  }
  // 국소·세포독성·면역원성 등 — 회사 미명시
  return { apply: '', count: '', note: '' };
}

// ── 2026 카테고리 매핑 ──
const cat2026 = (key) => {
  if (key.startsWith('독성시험_')) return '의약품';
  if (key.startsWith('복합제_')) return '복합제';
  if (key.startsWith('백신_')) return '백신';
  if (key.startsWith('SEND_CTD')) return '세포치료제';
  if (key.startsWith('건기식_')) return '건강기능식품';
  if (key.startsWith('화장품_')) return '화장품';
  if (key.startsWith('의료기기_')) return '의료기기';
  if (key.startsWith('스크리닝_')) return '스크리닝';
  if (key.startsWith('심혈관계스크리닝_')) return '심혈관계스크리닝';
  return '기타';
};

// ── 2025 파일 → 카테고리 ──
const cat2025 = (f) => {
  if (/복합제/.test(f)) return '복합제';
  if (/건기식|프로바이오/.test(f)) return '건강기능식품';
  if (/화장품|줄기세포/.test(f)) return '화장품';
  if (/의료기기/.test(f)) return '의료기기';
  if (/백신/.test(f)) return '백신';
  if (/세포치료제/.test(f)) return '세포치료제';
  if (/SEND|CTD|영문|번역/.test(f)) return 'SEND·CTD·번역';
  if (/심혈관/.test(f)) return '심혈관계스크리닝';
  if (/screening|스크리닝/i.test(f)) return '스크리닝';
  if (/안전성약리|hERG/.test(f)) return '안전성약리';
  if (/발암성/.test(f)) return '발암성';
  if (/분포|흡수|배설|약물동태|\bPK\b/.test(f)) return 'PK·분포';
  if (/화학물질|농약|환경|가습기|살생물|인축/.test(f)) return '화학물질·환경';
  if (/점안제/.test(f)) return '점안제';
  if (/metabolism/.test(f)) return 'in vitro metabolism';
  if (/조직병리|병리/.test(f)) return '조직병리';
  if (/경구피하근육|정맥|표준견적서/.test(f)) return '의약품';
  return '기타';
};

// 경로 → 그룹: 경구·피하·근육 = A그룹 / 정맥·경피 = B그룹
const routeGroup = (route) => {
  if (/정맥|경피/.test(route || '')) return 'B';   // 정맥경피
  return 'A';                                       // 경구피하근육 (기본)
};

// granularity 추출 (testName 기반)
function granularity(name) {
  const g = {};
  const m종 = name.match(/(\d)\s*종/);
  if (m종) g.species_count = m종[1] + '종';
  if (/개별\s*분석|개별분석/.test(name)) g.analysis = '개별분석';
  else if (/동시\s*분석|동시분석/.test(name)) g.analysis = '동시분석';
  const mPt = name.match(/(\d+)\s*point|（?(\d+)\s*pt/i);
  if (mPt) g.tk_point = (mPt[1] || mPt[2]) + 'point';
  if (/채혈까지|채혈만/.test(name)) g.tk_mode = '채혈만';
  else if (/채혈.*분석|분석시험/.test(name)) g.tk_mode = '채혈+분석';
  const m군 = name.match(/(\d)\s*군/);
  if (m군) g.group_count = m군[1] + '군';
  return g;
}

// 시험 분류 (testName/category 기반)
function classify(name, category) {
  if (/조제물\s*분석|함량\s*분석|Validation/i.test(name)) return '조제물·함량분석';
  if (/단회|급성|일회/.test(name)) return '단회투여독성';
  if (/DRF|용량결정|예비/i.test(name)) return 'DRF(용량결정)';
  if (/회복/.test(name)) return '회복군';
  if (/\bTK\b|독성동태|동태|PK\/TK|채혈/i.test(name)) return 'TK(독성동태)';
  if (/반복/.test(name)) return '반복투여독성';
  if (/Ames|TG471|복귀돌연변이|염색체이상|TG473|소핵|TG474|유전독성|MLA|Comet/i.test(name)) return '유전독성';
  if (/안전성약리|hERG|중추|호흡|심혈관|텔레메|Telemetry|Cav|Nav|MEA/i.test(name)) return '안전성약리';
  if (/종양원성/.test(name)) return '종양원성';
  if (/체내분포|분포|QPCR/.test(name)) return '체내분포';
  if (/생식|배태자|수태능|출생/.test(name)) return '생식독성';
  if (/발암/.test(name)) return '발암성';
  if (/면역원성|항체형성/.test(name)) return '면역원성';
  if (/세포독성|감작|자극|이식|발열|혈액적합/.test(name)) return '국소·생물학적안전성';
  if (/SEND|CTD|번역|영문/i.test(name)) return '보고서·서비스';
  return category || '기타';
}

const studyWeeks = (it) => {
  if (typeof it.studyWeeks === 'number') return it.studyWeeks;
  const m = (it.testName || '').match(/(\d+)\s*주/);
  if (m) return Number(m[1]);
  if (/단회|급성/.test(it.testName || '')) return 0;
  return null;
};

// ──────────────────────────────────────────────
// 1) 2026 의약품·기타 → 피벗 (경로그룹 × MFDS/OECD = 4가격)
// ──────────────────────────────────────────────
const rows = [];

// 2026 항목을 (카테고리 + 시험명정규화 + granularity) 로 그룹핑하여 4가격 피벗
const groups = new Map();
for (const it of items2026) {
  const category = cat2026(it.key);
  const g = granularity(it.testName);
  const gkey = [category, nkey(it.testName), g.tk_point || '', g.tk_mode || '', g.group_count || ''].join('|');
  if (!groups.has(gkey)) {
    groups.set(gkey, {
      category, item: it, gran: g,
      priceA_M: null, priceA_O: null, priceB_M: null, priceB_O: null,
      tiers: it.priceTiers || null,
    });
  }
  const grp = groups.get(gkey);
  const rg = routeGroup(it.adminRoute);
  if (rg === 'A') { grp.priceA_M = it.priceMfds ?? grp.priceA_M; grp.priceA_O = it.priceOecd ?? grp.priceA_O; }
  else { grp.priceB_M = it.priceMfds ?? grp.priceB_M; grp.priceB_O = it.priceOecd ?? grp.priceB_O; }
}

for (const grp of groups.values()) {
  const it = grp.item;
  const base = {
    카테고리: grp.category,
    시험분류: classify(it.testName, grp.category),
    시험항목명: norm(it.testName),
    동물종: it.testName.match(/설치류|비설치류|SD\s*rat|비글|토끼|개|원숭이|마우스|nude/i)?.[0] || '',
    투여기간: it.adminDuration || (studyWeeks(it) != null ? (studyWeeks(it) === 0 ? '단회' : `${studyWeeks(it)}주`) : ''),
    시험기간_주: studyWeeks(it),
    종수: grp.gran.species_count || '',
    분석방식: grp.gran.analysis || '',
    TK포인트: grp.gran.tk_point || '',
    TK방식: grp.gran.tk_mode || '',
    군구성: grp.gran.group_count || '',
    가이드라인_코드: guidelineRefs(it.testName, grp.category),
    상세설명: it.detail || it.quoteText || '',
    가이드라인_요약: it.guideline || '',
    주의사항: it.notice || '',
    데이터출처: '2026',
    검수상태: '',
    비고: '',
  };
  // 함량분석 룰 적용
  const _wk = studyWeeks(it);
  const _ham = hamryangApply(it.testName, base.시험분류, _wk);
  base.함량분석_적용 = _ham.apply;
  base.함량분석_횟수 = _ham.count === '' ? '' : (_ham.count + (typeof _ham.count === 'number' ? '회' : ''));

  // 복합제: priceTiers 있으면 2종/3종/4종 3행으로 전개
  if (grp.tiers && (grp.tiers['2'] || grp.tiers['3'] || grp.tiers['4'])) {
    for (const t of ['2', '3', '4']) {
      if (grp.tiers[t] == null) continue;
      rows.push({
        ...base,
        종수: `${t}종`,
        가격_경구피하근육_MFDS: grp.tiers[t],
        가격_경구피하근육_OECD: grp.tiers[t],
        가격_정맥경피_MFDS: '',
        가격_정맥경피_OECD: '',
        비고: '복합제 종수별 단가 (2026 priceTiers). 분석방식(개별/동시)는 2025 기준 추가 검토 필요',
        검수상태: '확인필요',
      });
    }
  } else {
    rows.push({
      ...base,
      가격_경구피하근육_MFDS: grp.priceA_M ?? '',
      가격_경구피하근육_OECD: grp.priceA_O ?? '',
      가격_정맥경피_MFDS: grp.priceB_M ?? '',
      가격_정맥경피_OECD: grp.priceB_O ?? '',
    });
  }
}

// ──────────────────────────────────────────────
// 2) 2026 누락 카테고리 → 2025 데이터 보강
// ──────────────────────────────────────────────
// 2026 에서 진짜로 누락된 카테고리만 (발암성·안전성약리·SEND 등은 2026 의약품/세포치료제 마스터에 이미 포함됨)
const MISSING_CATS = new Set(['점안제', '화학물질·환경', 'in vitro metabolism', 'PK·분포']);

// 2025 견적서는 시험항목 셀에 세부내용까지 한 셀에 들어있음 → 시험명 / 상세설명 분리
function splitName(full) {
  const f = norm(full);
  // 첫 줄바꿈 또는 첫 " - " 기준 분리
  const m = f.match(/^(.+?)\s*(?:\n|\s-\s)(.+)$/s);
  if (m) return { name: norm(m[1]).slice(0, 80), detail: norm(m[2]) };
  return { name: f.slice(0, 80), detail: '' };
}

const seen2025 = new Set();
for (const file of q2025) {
  if (file.error) continue;
  const category = cat2025(file.fileName);
  if (!MISSING_CATS.has(category)) continue; // 2026 에 있는 카테고리는 위에서 처리됨
  for (const sh of file.sheets || []) {
    for (const it of sh.items || []) {
      const { name, detail } = splitName(it.testNameFull);
      if (name.length < 4) continue;
      const dedup = category + '|' + nkey(name).slice(0, 40) + '|' + (it.price || '');
      if (seen2025.has(dedup)) continue;
      seen2025.add(dedup);
      const g = granularity(it.testNameFull);
      rows.push({
        카테고리: category,
        시험분류: classify(name, category),
        시험항목명: name,
        동물종: it.species || '',
        투여기간: it.duration || '',
        시험기간_주: typeof it.weeks === 'number' ? it.weeks : '',
        종수: g.species_count || '',
        분석방식: g.analysis || '',
        TK포인트: g.tk_point || '',
        TK방식: g.tk_mode || '',
        군구성: g.group_count || '',
        가격_경구피하근육_MFDS: it.price ?? '',
        가격_경구피하근육_OECD: '',
        가격_정맥경피_MFDS: '',
        가격_정맥경피_OECD: '',
        함량분석_적용: hamryangApply(name, classify(name, category), typeof it.weeks === 'number' ? it.weeks : null).apply,
        함량분석_횟수: (() => { const h = hamryangApply(name, classify(name, category), typeof it.weeks === 'number' ? it.weeks : null); return h.count === '' ? '' : h.count + '회'; })(),
        가이드라인_코드: guidelineRefs(name, category),
        상세설명: detail,
        가이드라인_요약: '',
        주의사항: '',
        데이터출처: '2025 (2026 미개정)',
        검수상태: '확인필요',
        비고: `2026 표준견적서에서 누락된 카테고리 — 2025 가격 사용, 2026 단가 재확인 필요`,
      });
    }
  }
}

// ── 정렬 ──
const catOrder = ['의약품', '복합제', '백신', '세포치료제', '건강기능식품', '화장품', '의료기기', '스크리닝', '심혈관계스크리닝', '안전성약리', '발암성', 'PK·분포', '점안제', '화학물질·환경', 'in vitro metabolism', 'SEND·CTD·번역', '조직병리', '기타'];
rows.sort((a, b) => {
  const ci = catOrder.indexOf(a.카테고리) - catOrder.indexOf(b.카테고리);
  if (ci !== 0) return ci;
  const wi = (a.시험기간_주 || 0) - (b.시험기간_주 || 0);
  if (wi !== 0) return wi;
  return a.시험항목명.localeCompare(b.시험항목명);
});

// ══════════════════════════════════════════════
// xlsx 생성
// ══════════════════════════════════════════════
const wb = new ExcelJS.Workbook();
wb.creator = '코아스템켐온 견적 시스템';
wb.created = new Date(2026, 4, 1);

const FONT = { name: 'Malgun Gothic', size: 10 };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
const HEADER_FONT = { name: 'Malgun Gothic', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };

// ── 시트1: 사용 가이드 ──
const guide = wb.addWorksheet('📖 사용 가이드');
guide.columns = [{ width: 4 }, { width: 100 }];
const guideLines = [
  ['', '통합 시험항목 마스터 — 사용 가이드'],
  ['', ''],
  ['', '■ 이 파일은 무엇인가요?'],
  ['', '코아스템켐온 견적서 자동 생성(CRM)을 위한 시험항목 마스터 데이터입니다.'],
  ['', '2025년까지 쓰던 표준견적서와 2026년 개정본을 비교·병합하여 만들었습니다.'],
  ['', ''],
  ['', '■ 데이터 기준'],
  ['', '· 가격 / 세부내용 = 2026년 개정본 기준 (최신)'],
  ['', '· 구성 세밀함(종수·분석방식·TK·군구성 등) = 2025년 기준으로 복원'],
  ['', '· 2026년에서 누락된 카테고리(점안제·화학물질·발암성 등) = 2025년 데이터로 채움 → "검수상태=확인필요"'],
  ['', ''],
  ['', '■ 가격 컬럼 4개의 의미 (중요)'],
  ['', '시험 기준과 가격은 [투여경로 그룹] × [제출처] 2축으로 나뉩니다.'],
  ['', '· 경로그룹 A = 경구·피하·근육  /  경로그룹 B = 정맥·경피'],
  ['', '· 제출처 = MFDS(식약처) / OECD — 제출처마다 시험 기준이 달라 가격이 다릅니다.'],
  ['', '  → 가격_경구피하근육_MFDS / _OECD / 가격_정맥경피_MFDS / _OECD'],
  ['', '· 경로 구분이 없는 카테고리(in vitro 등)는 "경구피하근육" 칸만 채웁니다.'],
  ['', ''],
  ['', '■ 어떻게 검토하나요?'],
  ['', '1. "검수상태 = 확인필요" 행을 먼저 확인하세요. (2025 출처이거나 가격 재확인 필요)'],
  ['', '2. 복합제 행: 종수(2/3/4종)별로 분리되어 있습니다. 분석방식(개별/동시)은 2025 기준 추가 검토가 필요합니다.'],
  ['', '3. 빈 가격 칸 = 해당 경로/제출처 조합의 가격이 아직 없음을 의미합니다. 필요 시 채워주세요.'],
  ['', '4. "데이터출처" 컬럼으로 2026 / 2025 출처를 구분할 수 있습니다.'],
  ['', ''],
  ['', ''],
  ['', '■ 함량분석 컬럼 (회사 합의 룰 2026-05)'],
  ['', '· 함량분석_적용: O = 투여물질 함량분석 대상 / X = 비대상(회복군·분석항목 자체·서비스)'],
  ['', '· 함량분석_횟수: 기간 기반 — 단회 1회, 4주 2회, 13주 2회(회사합의), 26주↑ floor(주/4) (26→6, 39→9, 52→13)'],
  ['', '· 유전독성·안전성약리(in vitro)도 1회 적용 (GLP 노출농도 검증). TK 위성군은 본시험과 별도 합산.'],
  ['', '· 함량분석 회당 100만원 / 조제물분석(Validation)은 별도 항목.'],
  ['', ''],
  ['', '■ 가이드라인 컬럼'],
  ['', '· 가이드라인_코드: 이 시험의 근거 가이드라인 (OECD TG / ICH / MFDS). "📚 가이드라인 사전" 시트에서 상세 확인'],
  ['', '· 가이드라인_요약: 시험 핵심내용 한 줄 (2026 데이터)'],
  ['', ''],
  ['', '■ 시트 구성'],
  ['', '· 📑 컬럼 설명 : 각 열(헤더)이 무슨 의미인지'],
  ['', '· 📋 전체 마스터 : 실제 데이터 (이 시트를 검토/수정)'],
  ['', '· 📚 가이드라인 사전 : 37종 가이드라인 체크리스트 (공식 원문 기반, PDF 링크 포함)'],
  ['', '· 🧪 시험설계 규칙 : 모달리티별 종·마리수·경로·기간·선후행·조건부 규칙 (의약품 별표 + 세포·유전자·의료기기 등 가이드라인 원문)'],
  ['', '· 🏷 모달리티별 가이드라인 : 제품 종류별 규제근거·필수시험구성 (상태=필요는 추가 확보 대상)'],
  ['', '· 🔍 2025vs2026 비교 : 카테고리별 항목 수 증감'],
];
guideLines.forEach((r, i) => {
  const row = guide.addRow(r);
  row.getCell(2).font = i === 0 ? { name: 'Malgun Gothic', size: 14, bold: true, color: { argb: 'FF4F46E5' } }
    : /^■/.test(r[1]) ? { name: 'Malgun Gothic', size: 11, bold: true } : FONT;
  row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
});

// ── 시트2: 컬럼 설명 ──
const colDoc = wb.addWorksheet('📑 컬럼 설명');
colDoc.columns = [{ header: '컬럼명', width: 24 }, { header: '의미', width: 60 }, { header: '예시', width: 24 }];
const colDefs = [
  ['카테고리', '모달리티(제품 종류). 의약품/복합제/백신/세포치료제/...', '의약품'],
  ['시험분류', '시험 성격 구분. 단회/반복/DRF/회복/TK/유전독성/...', 'DRF(용량결정)'],
  ['시험항목명', '견적서에 표시되는 시험 이름', '설치류 13주 반복투여 독성'],
  ['동물종', '사용 동물', 'SD rat / 비글 / 토끼'],
  ['투여기간', '약물 투여 기간', '13주 / 단회'],
  ['시험기간_주', '시험 전체 기간(주). 함량분석 횟수 계산 기준', '13'],
  ['종수', '복합제 전용 — 활성성분 개수', '2종/3종/4종'],
  ['분석방식', '복합제 전용 — 개별분석/동시분석', '개별분석'],
  ['TK포인트', 'TK(독성동태) 채혈 시점 수', '6point/8point'],
  ['TK방식', '채혈만 vs 채혈+분석', '채혈+분석'],
  ['군구성', '백신 등 — 시험군 수', '2군/3군/4군'],
  ['가격_경구피하근육_MFDS', '경로그룹 A(경구·피하·근육) · 제출처 MFDS 단가(원)', '92000000'],
  ['가격_경구피하근육_OECD', '경로그룹 A · 제출처 OECD 단가(원)', '92000000'],
  ['가격_정맥경피_MFDS', '경로그룹 B(정맥·경피) · 제출처 MFDS 단가(원)', '112000000'],
  ['가격_정맥경피_OECD', '경로그룹 B · 제출처 OECD 단가(원)', '112000000'],
  ['함량분석_적용', '투여물질 함량분석 대상 여부 (O/X). 회사 합의 룰', 'O'],
  ['함량분석_횟수', '함량분석 횟수(기간 기반). 단회1·4주2·13주2·26주↑ floor(주/4)', '2회'],
  ['가이드라인_코드', '근거 가이드라인 코드 (📚 가이드라인 사전 참조)', 'OECD TG 408, ICH S4'],
  ['상세설명', '시험 세부 내용(군구성·마리수·검사항목 등) — 2026 기준', '암수 각각 10마리/군...'],
  ['가이드라인_요약', '가이드라인 핵심내용 한 줄(2026 데이터)', '90일 반복투여...'],
  ['주의사항', '협의·견적수정 필요 사항', '[협의필요] 군 구성...'],
  ['데이터출처', '이 행의 출처(2026 / 2025)', '2026'],
  ['검수상태', '검토 필요 표시', '확인필요'],
  ['비고', '추가 메모', ''],
];
colDoc.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });
colDefs.forEach(d => { const r = colDoc.addRow(d); r.eachCell(c => { c.font = FONT; c.alignment = { wrapText: true, vertical: 'top' }; }); });

// ── 시트3: 전체 마스터 ──
const master = wb.addWorksheet('📋 전체 마스터');
const COLS = [
  ['카테고리', 12], ['시험분류', 16], ['시험항목명', 38], ['동물종', 10], ['투여기간', 10], ['시험기간_주', 9],
  ['종수', 7], ['분석방식', 10], ['TK포인트', 9], ['TK방식', 10], ['군구성', 8],
  ['가격_경구피하근육_MFDS', 18], ['가격_경구피하근육_OECD', 18], ['가격_정맥경피_MFDS', 16], ['가격_정맥경피_OECD', 16],
  ['함량분석_적용', 11], ['함량분석_횟수', 11], ['가이드라인_코드', 26], ['상세설명', 50], ['가이드라인_요약', 30], ['주의사항', 30],
  ['데이터출처', 14], ['검수상태', 10], ['비고', 40],
];
master.columns = COLS.map(([h, w]) => ({ header: h, key: h, width: w }));
master.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
master.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];

for (const r of rows) {
  const row = master.addRow(r);
  row.eachCell((c, col) => {
    c.font = FONT;
    c.alignment = { wrapText: true, vertical: 'top' };
    const header = COLS[col - 1][0];
    if (/^가격_/.test(header) && typeof c.value === 'number') c.numFmt = '#,##0';
  });
  if (r.검수상태 === '확인필요') {
    row.getCell(23).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  }
}
master.autoFilter = { from: 'A1', to: { row: 1, column: COLS.length } };

// ── 시트: 가이드라인 사전 ──
const gd = wb.addWorksheet('📚 가이드라인 사전');
const GCOLS = [
  ['코드', 16], ['시험명(국문)', 30], ['카테고리', 18], ['버전', 22], ['목적', 44],
  ['체크리스트(요구사항)', 60], ['함량분석 관련', 40], ['공식 원문 URL', 50], ['신뢰도', 12],
];
gd.columns = GCOLS.map(([h, w]) => ({ header: h, width: w }));
gd.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
gd.views = [{ state: 'frozen', ySplit: 1 }];
for (const g of GUIDELINES) {
  const checklist = Object.entries(g.checklist || {})
    .filter(([k]) => k !== '투여기간_주')
    .map(([k, v]) => `· ${k}: ${v}`).join('\n');
  const row = gd.addRow([
    g.code, g.title_ko, g.category, g.version, g.purpose,
    checklist, g['함량분석_관련'] || '', g.official_url, g.confidence,
  ]);
  row.eachCell((c, col) => {
    c.font = FONT;
    c.alignment = { wrapText: true, vertical: 'top' };
    if (col === 8 && g.official_url) { c.value = { text: g.official_url, hyperlink: g.official_url }; c.font = { name: 'Malgun Gothic', size: 9, color: { argb: 'FF2563EB' }, underline: true }; }
  });
}
gd.autoFilter = { from: 'A1', to: { row: 1, column: GCOLS.length } };

// ── 시트: 시험설계 규칙 (모달리티 전체) ──
const dr = wb.addWorksheet('🧪 시험설계 규칙');
const DCOLS = [
  ['시험', 24], ['근거 (별표/가이드라인)', 40], ['시험동물(종·마리수)', 48], ['투여경로', 42],
  ['투여기간·관찰', 38], ['용량단계', 30], ['선후행·조건부 규칙', 56], ['독성동태(TK)', 24],
];
dr.columns = DCOLS.map(([h, w]) => ({ header: h, width: w }));
dr.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
dr.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
// 안내 행
const note = dr.addRow(['모달리티별 시험설계 규제 근거 — 의약품(독성시험기준 별표1~13) + 세포·유전자·의료기기·생물의약품·백신·바이오시밀러·보툴리눔·화장품 가이드라인 원문. 견적 시험설계의 직접 근거', '', '', '', '', '', '', '']);
dr.mergeCells(`A2:H2`);
note.getCell(1).font = { name: 'Malgun Gothic', size: 9, italic: true, color: { argb: 'FF6B7280' } };
for (const r of MFDS_RULES) {
  const row = dr.addRow([
    r.시험, r.별표, r['시험동물'], r.투여경로, r['투여기간_관찰'], r.용량단계, r['선후행_조건부'], r.TK,
  ]);
  row.eachCell(c => { c.font = FONT; c.alignment = { wrapText: true, vertical: 'top' }; });
  // 의약품(별표) vs 모달리티 구분 색상
  if (!/^별표/.test(r.별표)) row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
}
dr.autoFilter = { from: 'A1', to: { row: 1, column: DCOLS.length } };

// ── 시트: 모달리티별 가이드라인 ──
const pf = wb.addWorksheet('🏷 모달리티별 가이드라인');
const PCOLS = [['상위분류', 20], ['모달리티', 26], ['하위분류', 20], ['규제근거', 52], ['필수 시험구성', 56], ['출처', 36], ['상태', 14]];
pf.columns = PCOLS.map(([h, w]) => ({ header: h, width: w }));
pf.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
pf.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }];
const pNote = pf.addRow(['독성시험이 필요한 모달리티(제품 종류)별 규제근거·필수 시험구성. 추후 이 가이드라인에 근거해 견적 플랫폼 구성. 상태=필요는 원문 추가 확보 대상', '', '', '', '', '', '']);
pf.mergeCells('A2:G2');
pNote.getCell(1).font = { name: 'Malgun Gothic', size: 9, italic: true, color: { argb: 'FF6B7280' } };
for (const p of MODALITIES) {
  const row = pf.addRow([p.상위분류, p.모달리티, p.하위분류, (p.규제근거 || []).join('\n'), p.필수시험구성, p.출처, p.상태]);
  row.eachCell(c => { c.font = FONT; c.alignment = { wrapText: true, vertical: 'top' }; });
  const stCell = row.getCell(7);
  if (p.상태 === '필요') stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  else if (/부분/.test(p.상태)) stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  else stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
}
pf.autoFilter = { from: 'A1', to: { row: 1, column: PCOLS.length } };

// ── 시트: 비교 ──
const cmp = wb.addWorksheet('🔍 2025vs2026 비교');
cmp.columns = [{ header: '카테고리', width: 22 }, { header: '2025 항목', width: 12 }, { header: '2026 항목', width: 12 }, { header: '상태', width: 30 }];
cmp.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });
const c25 = {}, c26 = {};
for (const f of q2025) { if (f.error) continue; const c = cat2025(f.fileName); c25[c] = (c25[c] || 0) + (f.totalItems || 0); }
for (const it of items2026) { const c = cat2026(it.key); c26[c] = (c26[c] || 0) + 1; }
const allC = [...new Set([...Object.keys(c25), ...Object.keys(c26)])].sort((a, b) => (catOrder.indexOf(a) + 1 || 99) - (catOrder.indexOf(b) + 1 || 99));
for (const c of allC) {
  const a = c25[c] || 0, b = c26[c] || 0;
  let st = '🟢 유지/확대';
  if (b === 0 && a > 0) st = '🔴 2026 누락 → 2025로 복원';
  else if (a > 0 && b < a * 0.5) st = '🟠 과도 간소화 → 복원 필요';
  else if (a > 0 && b < a) st = '🟡 일부 축소';
  const row = cmp.addRow([c, a || '-', b || '-', st]);
  row.eachCell(cell => { cell.font = FONT; });
}

wb.xlsx.writeFile(OUT).then(() => {
  console.log('✅ 통합 마스터 생성 완료 →', OUT);
  console.log(`   전체 마스터 행 수: ${rows.length}`);
  const byCat = {};
  for (const r of rows) byCat[r.카테고리] = (byCat[r.카테고리] || 0) + 1;
  console.log('   카테고리별:', JSON.stringify(byCat, null, 0));
  const needReview = rows.filter(r => r.검수상태 === '확인필요').length;
  console.log(`   검수필요 행: ${needReview}`);
});
