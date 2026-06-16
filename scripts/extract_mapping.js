/**
 * Extract 견적서데이터 정규화_가이드라인_매핑_26'0422.xlsx → normalized JSON
 *
 * Outputs:
 *   data/test_items.json        — 마스터 테스트 항목 (가격, 경로, 함량분석, 연계)
 *   data/guideline_blocks.json  — 가이드라인 블록 (distinct)
 *   data/test_mappings.json     — test_item × guideline_block 매핑 (N:M)
 *
 * Route reinterpretation (user ruling):
 *   경구/피하/근육       → A
 *   정맥/경피/복강       → B
 *   도포/뇌내/안구점적/구강점막/피내 → SPECIAL (경로별 별도 price row)
 *   in vitro/협의/-/(공백) → NONE
 *   "피하/근육" 원본 → 피하 + 근육 두 행으로 복제
 *   "정맥/복강" 원본 → 정맥 + 복강 두 행으로 복제
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const SRC = "G:/내 드라이브/데이터 정규화/데이터 정규화 (원문 + 주의사항)/견적서데이터 정규화_가이드라인_매핑_26'0422.xlsx";
const OUT_DIR = path.resolve(__dirname, '../data');

const ROUTE_GROUP = {
    '경구': 'A', '피하': 'A', '근육': 'A',
    '정맥': 'B', '경피': 'B', '복강': 'B',
    '도포': 'SPECIAL', '뇌내': 'SPECIAL', '안구점적': 'SPECIAL',
    '구강점막': 'SPECIAL', '피내': 'SPECIAL',
};
const NONE_ROUTES = new Set(['', '-', 'in vitro', '협의']);

function splitCompoundRoute(raw) {
    const r = String(raw || '').trim();
    if (r === '피하/근육') return ['피하', '근육'];
    if (r === '정맥/복강') return ['정맥', '복강'];
    return [r];
}

function classifyRouteGroup(route) {
    if (NONE_ROUTES.has(route)) return 'NONE';
    return ROUTE_GROUP[route] || 'NONE';
}

function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'object' && 'result' in v) v = v.result;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function str(v) {
    if (v == null) return null;
    if (typeof v === 'object' && 'text' in v) v = v.text;
    if (typeof v === 'object' && 'result' in v) v = v.result;
    const s = String(v).trim();
    return s === '' || s === '-' ? null : s;
}

(async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(SRC);
    const ws = wb.getWorksheet('매핑');

    const H = {};
    ws.getRow(1).eachCell((c, i) => { H[String(c.value || '').trim()] = i; });

    const gc = (row, key) => H[key] ? row.getCell(H[key]).value : null;

    const itemsMap = new Map();       // masterId+route → item
    const blocksMap = new Map();      // blockId → block
    const mappings = [];              // { itemKey, blockId, confidence, reason, needsReview }

    ws.eachRow((r, idx) => {
        if (idx === 1) return;

        const masterId = str(gc(r, '마스터ID'));
        if (!masterId) return;

        const rawRoute = String(gc(r, '투여경로') || '').trim();
        const routes = splitCompoundRoute(rawRoute);

        for (const route of routes) {
            const routeKey = NONE_ROUTES.has(route) ? '' : route;
            const itemKey = `${masterId}__${routeKey}`;

            if (!itemsMap.has(itemKey)) {
                itemsMap.set(itemKey, {
                    key: itemKey,
                    masterId,
                    sourceFile: str(gc(r, '파일')),
                    sourceSheet: str(gc(r, '시트')),
                    sourceRow: num(gc(r, '행')),
                    testName: str(gc(r, '마스터_테스트명')),
                    modalityPool: [],              // aggregated below
                    category: str(gc(r, '마스터_category')),
                    status: str(gc(r, '마스터_상태')),
                    adminRoute: NONE_ROUTES.has(route) ? null : route,
                    routeGroup: classifyRouteGroup(route),
                    adminDuration: str(gc(r, '투여기간')),
                    studyWeeks: num(gc(r, '시험기간_주')),
                    priceMfds: num(gc(r, '가격_MFDS')),
                    priceOecd: num(gc(r, '가격_OECD')),
                    hamryangApply: str(gc(r, '함량분석_적용')),
                    hamryangCount: str(gc(r, '함량분석_횟수')),
                    hamryangUnit: num(gc(r, '함량분석_단위수')),
                    hamryangRule: str(gc(r, '함량분석_단위규칙')),
                    excipientBranch: str(gc(r, '부형제_분기')),
                    linkRelation: str(gc(r, '연계_관계')),
                    parentTest: str(gc(r, '상위시험')),
                    isPrerequisite: str(gc(r, '선행필수')) === 'Y',
                    optionality: str(gc(r, '옵션성')),
                    linkBasis: str(gc(r, '연계근거')),
                });
            }

            const item = itemsMap.get(itemKey);
            const modalityRaw = str(gc(r, '추론_모달리티'));
            if (modalityRaw && modalityRaw !== '__SKIP__') {
                for (const m of modalityRaw.split('|').map(s => s.trim()).filter(Boolean)) {
                    if (!item.modalityPool.includes(m)) item.modalityPool.push(m);
                }
            }

            const blockId = str(gc(r, '가이드라인_블록ID'));
            if (blockId) {
                if (!blocksMap.has(blockId)) {
                    blocksMap.set(blockId, {
                        blockId,
                        testName: str(gc(r, '가이드라인_테스트명')),
                        modality: str(gc(r, '블록_모달리티')),
                        category: str(gc(r, '블록_category')),
                        weeks: num(gc(r, '블록_weeks')),
                    });
                }
                mappings.push({
                    itemKey,
                    blockId,
                    confidence: str(gc(r, '매칭_신뢰도')),
                    reason: str(gc(r, '매칭_근거')),
                    needsReview: str(gc(r, '검수필요')) === 'Y',
                });
            }
        }
    });

    const items = [...itemsMap.values()];
    const blocks = [...blocksMap.values()];

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'test_items.json'), JSON.stringify(items, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'guideline_blocks.json'), JSON.stringify(blocks, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'test_mappings.json'), JSON.stringify(mappings, null, 2), 'utf8');

    // stats
    const routeGroupStats = {};
    const modalityStats = {};
    for (const it of items) {
        routeGroupStats[it.routeGroup] = (routeGroupStats[it.routeGroup] || 0) + 1;
        for (const m of it.modalityPool) modalityStats[m] = (modalityStats[m] || 0) + 1;
    }
    console.log('items:', items.length);
    console.log('blocks:', blocks.length);
    console.log('mappings:', mappings.length);
    console.log('routeGroup:', routeGroupStats);
    console.log('modality:', modalityStats);
    console.log('special routes:', items.filter(i => i.routeGroup === 'SPECIAL').map(i => `${i.adminRoute}: ${i.testName}`));
})();
