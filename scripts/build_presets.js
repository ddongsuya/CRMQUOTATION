/**
 * 모달리티 × 시나리오 프리셋 초안 생성기
 *
 * 입력: data/test_items.json
 * 출력: data/modality_presets.json  (seed.ts 가 그대로 DB에 적재)
 *
 * 프리셋 정의는 (testNamePattern, route?, priority) 로 선언하고,
 * 해당하는 TestItem key를 실제 데이터에서 resolve 해서 저장한다.
 *
 * priority: "필수" | "권장" | "옵션"
 */
const fs = require('fs');
const path = require('path');

const ITEMS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/test_items.json'), 'utf8'));

/** helper: (patternList, modalityFilter, route?) → matching TestItem keys */
function find(patterns, modality, route) {
    const rxs = patterns.map(p => new RegExp(p));
    return ITEMS.filter(it => {
        if (!it.testName) return false;
        if (modality && !it.modalityPool.includes(modality)) return false;
        if (route) {
            if (route === '__ANY__') { /* ok */ }
            else if (it.adminRoute !== route) return false;
        }
        return rxs.some(rx => rx.test(it.testName));
    }).map(it => ({ key: it.key, testName: it.testName, adminRoute: it.adminRoute, studyWeeks: it.studyWeeks }));
}

/** 표준 패키지 빌더들 — 모달리티별 build 함수 */

// ─ 단회투여 (rodent + non-rodent) ─────────────────
const p단회 = (mod, route) => find(['단회', '일회'], mod, route).filter(x => !/회복/.test(x.testName));

// ─ DRF (1~2주, 용량결정) ─────────────────
const pDRF = (mod, route) => find(['DRF|예비|용량결정'], mod, route);

// ─ 반복투여 N주 ─────────────────
const p반복 = (mod, route, weeks) => find([
    `${weeks}주\\s*반복`,
    `반복.*${weeks}\\s*주`,
], mod, route);

// ─ TK (본시험 기간 동기) ─────────────────
const pTK = (mod, route, weeks) => find([
    `\\bTK\\b.*${weeks}주`,
    `${weeks}주.*\\bTK\\b`,
    `독성동태.*${weeks}주`,
    `${weeks}주.*독성동태`,
], mod, route);

// ─ 회복군 add-on ─────────────────
const p회복 = (mod, route, weeks) => find([`${weeks}주.*회복`, `회복.*${weeks}`], mod, route);

// ─ 함량분석/조제물분석 ─────────────────
const p함량 = (mod, route) => find(['조제물\\s*분석|함량분석$'], mod, route);

// ─ 유전독성 3종 ─────────────────
const p유전독성 = (mod) => [
    ...find(['복귀돌연변이|Ames|에임스'], mod),
    ...find(['염색체이상|염색체\\s*이상|in\\s*vitro\\s*소핵'], mod),
    ...find(['소핵시험|골수\\s*소핵|in\\s*vivo\\s*소핵'], mod),
];

// ─ 안전성약리 core battery ─────────────────
const p안전성약리 = (mod) => [
    ...find(['hERG|허그'], mod),
    ...find(['중추|CNS|Irwin'], mod),
    ...find(['호흡\\s*(기능|계)'], mod),
    ...find(['텔레메|심혈관.*개'], mod),
];

// ─ 종양원성 (세포/유전자) ─────────────────
const p종양원성 = (mod, weeks) => find([`종양원성.*${weeks}`, `${weeks}.*종양원성`, '종양원성'], mod);

// ─ 생체분포 / 면역원성 ─────────────────
const p생체분포 = (mod) => find(['생체분포|biodistribution'], mod);
const p면역원성 = (mod) => find(['면역원성|immunogen'], mod);

// ─ ISO10993 series ─────────────────
const pISO = (...codes) => find(codes.map(c => `${c}`), '의료기기(ISO10993)');

// ─ 결과 dedupe ─────────────────
const uniq = arr => {
    const seen = new Set();
    return arr.filter(x => {
        if (!x || seen.has(x.key)) return false;
        seen.add(x.key);
        return true;
    });
};

/** compose: items[] → defaultTests with priority */
const compose = (...groups) => uniq(groups.flat().filter(Boolean))
    .map(x => ({ key: x.key, testName: x.testName, adminRoute: x.adminRoute, priority: x.priority || '필수' }));

const mark = (priority, items) => items.map(x => ({ ...x, priority }));

// ─────────────────────────────────────────────────────────
// Preset definitions
// ─────────────────────────────────────────────────────────
const PRESETS = [];

// 공통 빌더: 일반 합성/바이오 계열 IND 1상 최소 (경구)
const ind1min = (mod, route = '경구') => ({
    modality: mod,
    presetName: 'IND 1상 최소',
    scenario: '단회 + 4주 반복 + DRF + 유전독성 3종 + 안전성약리 core (1상 임상시험 개시용 최소 패키지)',
    notes: 'TK·함량분석·회복군은 본시험 선택 시 자동 add-on 제안됨.',
    defaultTests: compose(
        mark('필수', p단회(mod, route)),
        mark('필수', pDRF(mod, route)),
        mark('필수', p반복(mod, route, 4)),
        mark('권장', pTK(mod, route, 4)),
        mark('권장', p회복(mod, route, 2)),
        mark('필수', p함량(mod, route)),
        mark('필수', p유전독성(mod)),
        mark('필수', p안전성약리(mod)),
    ),
});

const full = (mod, route = '경구') => ({
    modality: mod,
    presetName: '풀패키지',
    scenario: 'IND~NDA 수준: 단회 + 4/13/26주 반복 + 회복군 + TK + 유전독성 + 안전성약리 + 함량분석',
    notes: '52주·발암성·생식발생은 사업계획에 따라 개별 추가.',
    defaultTests: compose(
        mark('필수', p단회(mod, route)),
        mark('필수', pDRF(mod, route)),
        mark('필수', p반복(mod, route, 4)),
        mark('필수', p반복(mod, route, 13)),
        mark('권장', p반복(mod, route, 26)),
        mark('필수', p회복(mod, route, 2)),
        mark('필수', p회복(mod, route, 4)),
        mark('필수', pTK(mod, route, 4)),
        mark('필수', pTK(mod, route, 13)),
        mark('필수', p함량(mod, route)),
        mark('필수', p유전독성(mod)),
        mark('필수', p안전성약리(mod)),
    ),
});

// 정맥 루트 버전
const ind1min_iv = (mod) => ({ ...ind1min(mod, '정맥'), presetName: 'IND 1상 최소 (정맥)' });

// 모달리티별 프리셋
['합성신약', '생물의약품', '펩타이드', '바이오시밀러'].forEach(m => {
    PRESETS.push(ind1min(m, '경구'));
    PRESETS.push(ind1min_iv(m));
    PRESETS.push(full(m, '경구'));
});

['ADC', '이중특이항체', '항암제', '방사성의약품'].forEach(m => {
    PRESETS.push({
        modality: m,
        presetName: 'IND 1상 최소 (정맥)',
        scenario: '항암·고독성 계열: 단회 + 4주 반복 + TK + 유전독성 + 안전성약리 (정맥)',
        notes: '회복군은 본시험 따라 자동 부가. 생식·발암성은 승인 단계에서 추가.',
        defaultTests: compose(
            mark('필수', p단회(m, '정맥')),
            mark('필수', pDRF(m, '정맥')),
            mark('필수', p반복(m, '정맥', 4)),
            mark('필수', pTK(m, '정맥', 4)),
            mark('필수', p회복(m, '정맥', 2)),
            mark('필수', p함량(m, '정맥')),
            mark('필수', p유전독성(m)),
            mark('필수', p안전성약리(m)),
        ),
    });
    PRESETS.push(full(m, '정맥'));
});

// 세포치료제 — 종양원성 중심
['세포치료제', '유전자치료제'].forEach(m => {
    PRESETS.push({
        modality: m,
        presetName: 'IND 1상 최소 (첨단바이오)',
        scenario: '단회 + 종양원성(26주) + 생체분포 + 면역원성 + 안전성약리',
        notes: '성체 유래→26주, ESC/iPSC 유래→52주 관찰기간 (코아스템켐온 기준).',
        defaultTests: compose(
            mark('필수', p단회(m, '정맥')),
            mark('필수', p종양원성(m, 26)),
            mark('권장', p생체분포(m)),
            mark('권장', p면역원성(m)),
            mark('필수', p함량(m, '정맥')),
            mark('필수', p안전성약리(m)),
        ),
    });
    PRESETS.push({
        modality: m,
        presetName: '풀패키지 (첨단바이오)',
        scenario: 'ESC/iPSC 유래: 52주 종양원성 포함 전체 패키지',
        notes: '관찰 52주 고정.',
        defaultTests: compose(
            mark('필수', p단회(m, '정맥')),
            mark('필수', p반복(m, '정맥', 4)),
            mark('필수', p반복(m, '정맥', 13)),
            mark('필수', p종양원성(m, 52)),
            mark('필수', p생체분포(m)),
            mark('필수', p면역원성(m)),
            mark('필수', p함량(m, '정맥')),
            mark('필수', p안전성약리(m)),
        ),
    });
});

// 핵산치료제
PRESETS.push({
    modality: '핵산치료제',
    presetName: 'IND 1상 최소',
    scenario: 'siRNA/ASO 계열: 단회 + 4주 반복 + TK + 유전독성 + 안전성약리 (정맥/피하)',
    notes: '',
    defaultTests: compose(
        mark('필수', p단회('핵산치료제', '정맥')),
        mark('필수', p반복('핵산치료제', '정맥', 4)),
        mark('필수', pTK('핵산치료제', '정맥', 4)),
        mark('필수', p함량('핵산치료제', '정맥')),
        mark('필수', p유전독성('핵산치료제')),
        mark('필수', p안전성약리('핵산치료제')),
    ),
});
PRESETS.push(full('핵산치료제', '정맥'));

// 백신
PRESETS.push({
    modality: '백신',
    presetName: 'IND 1상 최소 (백신)',
    scenario: '백신 표준: 반복투여독성 + 국소자극 + 면역원성',
    notes: '데이터 커버리지가 낮아 팀 검토 단계에서 실제 가이드라인 참조 필수.',
    defaultTests: compose(
        mark('필수', find(['반복'], '백신')),
        mark('권장', find(['면역원성|국소'], '백신')),
        mark('필수', find(['조제물\\s*분석|함량분석$'], '백신')),
    ),
});

// 건강기능식품
PRESETS.push({
    modality: '건강기능식품',
    presetName: '기능성 원료 최소',
    scenario: '단회 + 13주 반복 + Ames + 염색체이상 + 소핵',
    notes: '식약처 건강기능식품 안전성 평가 기준.',
    defaultTests: compose(
        mark('필수', p단회('건강기능식품', '경구')),
        mark('필수', p반복('건강기능식품', '경구', 13)),
        mark('필수', p유전독성('건강기능식품')),
    ),
});
PRESETS.push({
    modality: '건강기능식품',
    presetName: '기능성 원료 풀패키지',
    scenario: '단회 + 4/13/26주 + 유전독성 + 생식발생 (새로운 원료)',
    notes: '',
    defaultTests: compose(
        mark('필수', p단회('건강기능식품', '경구')),
        mark('필수', p반복('건강기능식품', '경구', 4)),
        mark('필수', p반복('건강기능식품', '경구', 13)),
        mark('권장', p반복('건강기능식품', '경구', 26)),
        mark('필수', p유전독성('건강기능식품')),
    ),
});

// 의료기기 ISO10993
PRESETS.push({
    modality: '의료기기(ISO10993)',
    presetName: '표면 접촉기기 (short-term)',
    scenario: 'ISO 10993-5 세포독성, -10 감작·자극, -11 전신독성 (acute)',
    notes: '접촉기간·부위에 따라 선택 항목 조정.',
    defaultTests: compose(
        mark('필수', find(['세포독성|MTT|cytotoxic'], '의료기기(ISO10993)')),
        mark('필수', find(['감작|sensitiz'], '의료기기(ISO10993)')),
        mark('필수', find(['자극|irritat'], '의료기기(ISO10993)')),
        mark('권장', find(['전신.*급성|acute.*system'], '의료기기(ISO10993)')),
    ),
});
PRESETS.push({
    modality: '의료기기(ISO10993)',
    presetName: '체내 이식형 풀패키지',
    scenario: '세포독성 + 감작 + 자극 + 전신 급성/아급성 + 유전독성 + 이식',
    notes: '장기 이식형 의료기기 기준.',
    defaultTests: compose(
        mark('필수', find(['세포독성'], '의료기기(ISO10993)')),
        mark('필수', find(['감작'], '의료기기(ISO10993)')),
        mark('필수', find(['자극'], '의료기기(ISO10993)')),
        mark('필수', find(['전신'], '의료기기(ISO10993)')),
        mark('필수', find(['유전독성|genotox|Ames'], '의료기기(ISO10993)')),
        mark('권장', find(['이식|implant'], '의료기기(ISO10993)')),
    ),
});

// ─────────────────────────────────────────────────────────
// output
// ─────────────────────────────────────────────────────────
const OUT = path.resolve(__dirname, '../data/modality_presets.json');
fs.writeFileSync(OUT, JSON.stringify(PRESETS, null, 2), 'utf8');

// stats
console.log(`Generated ${PRESETS.length} presets:`);
for (const p of PRESETS) {
    const empty = p.defaultTests.length === 0 ? ' ⚠️  EMPTY' : '';
    console.log(`  [${p.modality}] ${p.presetName} → ${p.defaultTests.length} tests${empty}`);
}
