const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { assembleQuoteLines, hamryangCountForWeeks, isParentSelected, normalizeTestName } = require('../assemble');

const mk = (o) => ({
    key: o.key,
    masterId: o.masterId ?? o.key.split('__')[0],
    testName: o.testName ?? 'T',
    modalityPool: o.modalityPool ?? ['합성신약'],
    adminRoute: o.adminRoute ?? '경구',
    routeGroup: o.routeGroup ?? 'A',
    studyWeeks: o.studyWeeks ?? null,
    priceMfds: 'priceMfds' in o ? o.priceMfds : 1000000,
    priceOecd: 'priceOecd' in o ? o.priceOecd : 1500000,
    hamryangRule: o.hamryangRule ?? null,
    excipientBranch: o.excipientBranch ?? null,
    linkRelation: o.linkRelation ?? null,
    parentTest: o.parentTest ?? null,
    isPrerequisite: o.isPrerequisite ?? false,
});

const opts = (over = {}) => ({ excipientCount: 0, priceStandard: 'MFDS', priceAnalysisUnit: 1_000_000, priceFormulationAnalysisUnit: 10_000_000, ...over });

test('hamryangCountForWeeks — 회사 합의 룰', () => {
    assert.equal(hamryangCountForWeeks(null), 1); // 단회 fallback
    assert.equal(hamryangCountForWeeks(0), 1);    // 단회
    assert.equal(hamryangCountForWeeks(1), 1);    // ~4주 = 1회
    assert.equal(hamryangCountForWeeks(2), 1);
    assert.equal(hamryangCountForWeeks(4), 1);
    assert.equal(hamryangCountForWeeks(13), 2);   // 5~13주 = 2회
    assert.equal(hamryangCountForWeeks(26), 6);   // 13주 초과 4주당 1회
    assert.equal(hamryangCountForWeeks(39), 9);
    assert.equal(hamryangCountForWeeks(52), 13);
});

test('empty selection → no lines', () => {
    const { lines, warnings } = assembleQuoteLines([], opts());
    assert.equal(lines.length, 0);
    assert.equal(warnings.length, 0);
});

test('13주 본시험 1건 → 함량분석 2회', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const { lines } = assembleQuoteLines([{ item }], opts());
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.ok(analysis);
    assert.equal(analysis.quantity, 2);
    assert.equal(analysis.subtotal, 2_000_000);
});

test('26주 본시험 1건 → 함량분석 6회', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 26주 반복투여 독성', studyWeeks: 26 });
    const { lines } = assembleQuoteLines([{ item }], opts());
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 6);
    assert.equal(analysis.subtotal, 6_000_000);
});

test('단회 + 4주 DRF + 13주 본시험 + 13주 TK → 1+1+2+2 = 6회', () => {
    const single = mk({ key: 'S__경구', testName: '설치류 단회 투여 독성시험', studyWeeks: 0 });
    const drf = mk({ key: 'D__경구', testName: '설치류 4주 DRF', studyWeeks: 4, linkRelation: 'DRF' });
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const tk = mk({ key: 'T__경구', testName: '설치류 13주 TK(2회) 8pt', studyWeeks: 13, linkRelation: 'TK' });
    const { lines, warnings } = assembleQuoteLines(
        [{ item: single }, { item: drf }, { item: main }, { item: tk }],
        opts({ excipientCount: 0 }),
    );
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 6); // 단회1 + 4주1 + 13주2 + 13주2
    assert.equal(warnings.length, 0);
});

// F-2 회귀 방지 — parentTest 와 본시험 testName 의 띄어쓰기·종 접두사 차이 매칭
test('[F-2] normalizeTestName 동작', () => {
    assert.equal(normalizeTestName('설치류 13주 반복투여 독성'), '13주반복투여독성');
    assert.equal(normalizeTestName('13주 반복투여독성'), '13주반복투여독성');
    assert.equal(normalizeTestName('비설치류 4주 DRF'), '4주DRF');
    assert.equal(normalizeTestName(''), '');
    assert.equal(normalizeTestName(null), '');
});

test('[F-2] isParentSelected — 종 접두사·띄어쓰기 변형 매칭', () => {
    const main = { item: { key: 'M', testName: '설치류 13주 반복투여 독성' } };
    const map = new Map([['M', { item: main.item, quantity: 1 }]]);
    assert.equal(isParentSelected('13주 반복투여독성', map), true,  '띄어쓰기·접두사 차이 매칭');
    assert.equal(isParentSelected('설치류 13주 반복투여 독성', map), true, '정확 일치');
    assert.equal(isParentSelected('4주 DRF', map), false, '다른 시험은 매칭 안 됨');
    assert.equal(isParentSelected('', map), false);
});

test('[F-2] 회복군 + 본시험 같이 선택 시 warning 없음 (F-2 수정)', () => {
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const recovery = mk({
        key: 'R__경구', testName: '설치류 13주 반복 4주 회복',
        studyWeeks: 13, linkRelation: 'RECOVERY',
        parentTest: '13주 반복투여독성',   // ← 짧은 형태(데이터의 실제 모양)
    });
    const { warnings } = assembleQuoteLines([{ item: main }, { item: recovery }], opts());
    const recoveryWarn = warnings.find(w => /회복군.*상위 본시험/.test(w));
    assert.equal(recoveryWarn, undefined, `회복군 warning 이 떠선 안 됨: ${recoveryWarn || '(none)'}`);
});

// ─── R8 조제물분석 (Validation) + 유전독성·안전성약리 함량분석 포함 (2026-05) ──

test('[R8] IND 패키지 — in vivo + 유전독성 + hERG = 조제물분석 3회 (3,000만원)', () => {
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const ames = mk({ key: 'G__-', testName: '유전독성 : 복귀돌연변이 (Ames TG471)', studyWeeks: null, priceMfds: 6_500_000 });
    const herg = mk({ key: 'H__-', testName: '안전성약리 : in vitro hERG assay', studyWeeks: null, priceMfds: 3_000_000 });
    const { lines } = assembleQuoteLines(
        [{ item: main }, { item: ames }, { item: herg }],
        opts(),
    );
    const prepLines = lines.filter(l => l.kind === 'prep_analysis');
    assert.equal(prepLines.length, 3, '3개 그룹: in_vivo + genotox + safety_pharm');
    const prepTotal = prepLines.reduce((s, l) => s + l.subtotal, 0);
    assert.equal(prepTotal, 30_000_000, '3회 × 10M = 30M');
    // 그룹별 라벨 확인
    assert.ok(prepLines.find(l => l.group === 'in_vivo'),     'in_vivo 그룹 누락');
    assert.ok(prepLines.find(l => l.group === 'genotox'),     'genotox 그룹 누락');
    assert.ok(prepLines.find(l => l.group === 'safety_pharm'), 'safety_pharm 그룹 누락');
});

test('[R8] 유전독성·hERG 도 함량분석 1회씩 포함 (2026-05 신규)', () => {
    const ames = mk({ key: 'G__-', testName: '유전독성 : 복귀돌연변이 (Ames TG471)', studyWeeks: null });
    const herg = mk({ key: 'H__-', testName: '안전성약리 : in vitro hERG assay', studyWeeks: null });
    const { lines } = assembleQuoteLines([{ item: ames }, { item: herg }], opts());
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.ok(analysis, '함량분석 라인 있어야 함');
    assert.equal(analysis.quantity, 2, '유전독성 1 + hERG 1 = 2회');
});

test('[R8] in vivo 만 있을 때 — 조제물분석 1회만 (in_vivo 그룹)', () => {
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const { lines } = assembleQuoteLines([{ item: main }], opts());
    const prepLines = lines.filter(l => l.kind === 'prep_analysis');
    assert.equal(prepLines.length, 1);
    assert.equal(prepLines[0].group, 'in_vivo');
    assert.equal(prepLines[0].subtotal, 10_000_000);
});

test('[R8] 사용자가 명시적으로 "조제물 분석" 시험을 추가하면 자동 추가 skip', () => {
    const userPrep = mk({ key: 'P__-', testName: '투여물질의 조제물 분석', studyWeeks: null, priceMfds: 25_000_000 });
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const { lines } = assembleQuoteLines([{ item: userPrep }, { item: main }], opts());
    const prepLines = lines.filter(l => l.kind === 'prep_analysis');
    assert.equal(prepLines.length, 0, '사용자 명시 선택 우선 — 자동 추가 X');
    // 사용자가 추가한 라인은 kind:test 로 그대로
    assert.ok(lines.find(l => l.kind === 'test' && /조제물/.test(l.testName)));
});

test('[R8] priceFormulationAnalysisUnit override (정책 단가 수정)', () => {
    const ames = mk({ key: 'G__-', testName: '유전독성 Ames', studyWeeks: null });
    const { lines } = assembleQuoteLines([{ item: ames }], opts({ priceFormulationAnalysisUnit: 15_000_000 }));
    const prep = lines.find(l => l.kind === 'prep_analysis');
    assert.equal(prep.subtotal, 15_000_000);
});

test('[R8] 기타 카테고리 (생식독성·국소 등) 는 자동 그룹 분류 X', () => {
    const repro = mk({ key: 'R__-', testName: '생식독성 : 수태능/초기배', studyWeeks: null });
    const local = mk({ key: 'L__-', testName: '국소독성 : 피부자극', studyWeeks: null });
    const { lines } = assembleQuoteLines([{ item: repro }, { item: local }], opts());
    const prepLines = lines.filter(l => l.kind === 'prep_analysis');
    assert.equal(prepLines.length, 0, '자동 분류 안 됨 (영업 판단 영역)');
});

// ─── Phase C-1: 사용자 직접 입력 (override) ─────────────────────────────
test('[C-1] unitPriceOverride — 자동 가격 무시하고 사용자 입력 가격 사용', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 13주 반복투여', studyWeeks: 13, priceMfds: 100_000_000 });
    const { lines } = assembleQuoteLines([{ item, unitPriceOverride: 80_000_000 }], opts());
    const test = lines.find(l => l.kind === 'test');
    assert.equal(test.unitPrice, 80_000_000);
    assert.equal(test.subtotal, 80_000_000);
    assert.match(test.note, /\[수동 가격\].*100,000,000.*80,000,000/);
});

test('[C-1] unitPriceOverride=0 — 명시적 0 도 유효한 값 (무료 옵션)', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 단회', studyWeeks: 0, priceMfds: 4_600_000 });
    const { lines } = assembleQuoteLines([{ item, unitPriceOverride: 0 }], opts());
    const test = lines.find(l => l.kind === 'test');
    assert.equal(test.unitPrice, 0);
    assert.equal(test.subtotal, 0);
    // 0 은 override 이므로 "가격 정보 없음" 노트가 떠선 안 됨
    assert.equal(test.note?.includes('가격 정보 없음') ?? false, false);
    assert.match(test.note, /\[수동 가격\].*4,600,000.*0/);
});

test('[C-1] studyWeeksOverride — testName 에서 주차 파싱 못하는 비정형 채우기', () => {
    // testName 에 "N주" 표기 없는 반복 시험 (studyWeeks=null) — 함량분석 대상이긴 함 (cls.included=true)
    const item = mk({ key: 'S__경구', testName: '설치류 반복투여 (비정형 기간)', studyWeeks: null });
    // override 없음: weeks=null → hamryangCountForWeeks(null)=1 (단회 fallback)
    {
        const { lines } = assembleQuoteLines([{ item }], opts());
        const analysis = lines.find(l => l.kind === 'analysis');
        assert.equal(analysis?.quantity ?? 0, 1);
    }
    // override 9주 → hamryangCountForWeeks(9)=2
    {
        const { lines } = assembleQuoteLines([{ item, studyWeeksOverride: 9 }], opts());
        const analysis = lines.find(l => l.kind === 'analysis');
        assert.equal(analysis.quantity, 2);
    }
    // override 26주 → floor(26/4)=6
    {
        const { lines } = assembleQuoteLines([{ item, studyWeeksOverride: 26 }], opts());
        const analysis = lines.find(l => l.kind === 'analysis');
        assert.equal(analysis.quantity, 6);
    }
});

test('[C-1] hamryangCountOverride — 함량분석 회수 직접 지정 (특수 케이스)', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 13주 반복투여', studyWeeks: 13 });
    // 기본: 13주 → 2회
    {
        const { lines } = assembleQuoteLines([{ item }], opts());
        assert.equal(lines.find(l => l.kind === 'analysis').quantity, 2);
    }
    // override 5회 강제
    {
        const { lines } = assembleQuoteLines([{ item, hamryangCountOverride: 5 }], opts());
        assert.equal(lines.find(l => l.kind === 'analysis').quantity, 5);
    }
    // override 0 → 함량분석 라인 자체가 없음
    {
        const { lines } = assembleQuoteLines([{ item, hamryangCountOverride: 0 }], opts());
        assert.equal(lines.find(l => l.kind === 'analysis'), undefined);
    }
});

test('[C-1] customNote — 자유 메모가 line.note 에 합쳐짐', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 13주 반복투여', studyWeeks: 13 });
    const { lines } = assembleQuoteLines([{ item, customNote: '의뢰자 협의 단가' }], opts());
    const test = lines.find(l => l.kind === 'test');
    assert.match(test.note, /의뢰자 협의 단가/);
});

test('[C-1] 중복 key 머지 시 마지막 override 우선', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 13주 반복투여', studyWeeks: 13, priceMfds: 100_000_000 });
    const { lines } = assembleQuoteLines([
        { item, unitPriceOverride: 80_000_000 },
        { item, unitPriceOverride: 70_000_000 },   // ← 마지막이 이김
    ], opts());
    const test = lines.find(l => l.kind === 'test');
    assert.equal(test.unitPrice, 70_000_000);
    assert.equal(test.quantity, 2);  // quantity 는 합산
});

test('회복군은 함량분석에 포함되지 않음', () => {
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const recovery = mk({
        key: 'R__경구', testName: '설치류 13주 반복 4주 회복',
        studyWeeks: 13, linkRelation: 'RECOVERY', parentTest: '설치류 13주 반복투여 독성',
    });
    const { lines } = assembleQuoteLines([{ item: main }, { item: recovery }], opts());
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 2);
});

test('TK 위성군은 본시험과 별도로 합산', () => {
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const tk = mk({ key: 'T__경구', testName: '설치류 13주 TK(2회) 8pt', studyWeeks: 13, linkRelation: 'TK' });
    const { lines } = assembleQuoteLines([{ item: main }, { item: tk }], opts());
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 4);
});

test('부형제 3종 → 함량분석 × 3', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const { lines } = assembleQuoteLines([{ item }], opts({ excipientCount: 3 }));
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 6);
    assert.match(analysis.note, /부형제 3종/);
});

test('부형제 0종에도 최소 1배 적용', () => {
    const item = mk({ key: 'M__경구', testName: '설치류 4주 반복투여', studyWeeks: 4 });
    const { lines } = assembleQuoteLines([{ item }], opts({ excipientCount: 0 }));
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 1); // 4주 = 1회 × 최소 1배
});

test('조제물분석 항목 자체는 함량분석 누적에서 제외 (라인엔 자기 자신으로)', () => {
    const validation = mk({ key: 'V__', testName: '투여물질의 조제물 분석', priceMfds: 26_000_000 });
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const { lines } = assembleQuoteLines([{ item: validation }, { item: main }], opts());
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 2);
    const vLine = lines.find(l => l.testName === '투여물질의 조제물 분석');
    assert.ok(vLine);
    assert.equal(vLine.subtotal, 26_000_000);
});

test('[R8 변경] 유전독성·안전성약리 도 함량분석 1회씩 포함 (2026-05 룰 변경)', () => {
    // 이전 룰: in-vitro 라 누적 제외 → 13주 본시험 2회만
    // 변경 후: 별도 부형제이므로 각 1회씩 추가 → 13주(2) + 유전독성(1) + hERG(1) = 4회
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const ames = mk({ key: 'A__', testName: '유전독성 : Ames(TG471)', studyWeeks: null });
    const herg = mk({ key: 'H__', testName: '안전성약리 : hERG(국내)', studyWeeks: null });
    const { lines } = assembleQuoteLines([{ item: main }, { item: ames }, { item: herg }], opts());
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 4, '13주(2) + 유전독성(1) + hERG(1) = 4');
});

test('회복군 단독 → 상위 본시험 없음 경고', () => {
    const recovery = mk({
        key: 'R__경구', testName: '설치류 13주 반복 4주 회복',
        studyWeeks: 13, linkRelation: 'RECOVERY', parentTest: '설치류 13주 반복투여 독성',
    });
    const { warnings } = assembleQuoteLines([{ item: recovery }], opts());
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /회복군/);
});

test('TK 단독 → 동일 기간 본시험 없음 경고', () => {
    const tk = mk({
        key: 'T__경구', testName: '설치류 13주 TK(2회) 8pt',
        studyWeeks: 13, linkRelation: 'TK',
    });
    const { warnings } = assembleQuoteLines([{ item: tk }], opts());
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /TK/);
});

test('TK + 본시험 동시 → 경고 없음', () => {
    const main = mk({ key: 'M__경구', testName: '설치류 13주 반복투여 독성', studyWeeks: 13 });
    const tk = mk({
        key: 'T__경구', testName: '설치류 13주 TK(2회) 8pt',
        studyWeeks: 13, linkRelation: 'TK',
    });
    const { warnings } = assembleQuoteLines([{ item: main }, { item: tk }], opts());
    assert.equal(warnings.length, 0);
});

test('중복 key 머지 — quantity 합산', () => {
    const item = mk({ key: 'X__경구', priceMfds: 500, testName: '설치류 4주 반복투여', studyWeeks: 4 });
    const { lines } = assembleQuoteLines(
        [{ item, quantity: 2 }, { item, quantity: 3 }],
        opts(),
    );
    const testLine = lines.find(l => l.kind === 'test');
    assert.equal(testLine.quantity, 5);
    assert.equal(testLine.subtotal, 2500);
    const analysis = lines.find(l => l.kind === 'analysis');
    assert.equal(analysis.quantity, 1 * 5); // 4주 = 1회 × quantity 5
});

test('가격 없는 항목 → 0 + note', () => {
    const item = mk({ key: 'N__경구', priceMfds: null });
    const { lines } = assembleQuoteLines([{ item }], opts());
    const testLine = lines.find(l => l.kind === 'test');
    assert.equal(testLine.unitPrice, 0);
    assert.match(testLine.note, /가격 정보 없음/);
});

test('invalid inputs → throw', () => {
    assert.throws(() => assembleQuoteLines([], opts({ excipientCount: -1 })));
    assert.throws(() => assembleQuoteLines([], opts({ excipientCount: 1.5 })));
    assert.throws(() => assembleQuoteLines([], { excipientCount: 0, priceStandard: 'foo', priceAnalysisUnit: 0 }));
    assert.throws(() => assembleQuoteLines([], opts({ priceAnalysisUnit: -1 })));
});

// ─── property-based ────────────────────────────────────
test('[fc] sum of test-line subtotals equals Σ priceMfds × quantity', () => {
    fc.assert(fc.property(
        fc.array(fc.record({
            price: fc.integer({ min: 0, max: 10_000_000 }),
            qty: fc.integer({ min: 1, max: 10 }),
        }), { minLength: 1, maxLength: 20 }),
        (arr) => {
            const selections = arr.map((a, i) => ({
                // testName starting with 'Ames' → classified as in-vitro, no hamryang accumulation noise
                item: mk({ key: `K${i}__경구`, priceMfds: a.price, testName: 'Ames test', studyWeeks: null }),
                quantity: a.qty,
            }));
            const { lines } = assembleQuoteLines(selections, opts());
            const testSum = lines.filter(l => l.kind === 'test').reduce((s, l) => s + l.subtotal, 0);
            const expected = arr.reduce((s, a) => s + a.price * a.qty, 0);
            return testSum === expected;
        },
    ));
});

test('[fc] 함량분석 회수 = Σ count(weeks) × qty × max(부형제, 1)', () => {
    const validWeeks = [null, 0, 1, 2, 4, 13, 26, 39, 52];
    fc.assert(fc.property(
        fc.array(fc.record({
            weeks: fc.constantFrom(...validWeeks),
            qty: fc.integer({ min: 1, max: 5 }),
        }), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 6 }),
        (arr, excipient) => {
            const selections = arr.map((a, i) => ({
                item: mk({
                    key: `H${i}__경구`,
                    testName: a.weeks ? `${a.weeks}주 반복투여 본시험` : '단회 투여 본시험',
                    studyWeeks: a.weeks,
                    priceMfds: 0,
                }),
                quantity: a.qty,
            }));
            const { lines } = assembleQuoteLines(selections, opts({ excipientCount: excipient }));
            const analysis = lines.find(l => l.kind === 'analysis');
            const expectedBase = arr.reduce((s, a) => s + hamryangCountForWeeks(a.weeks) * a.qty, 0);
            const expected = expectedBase * Math.max(excipient, 1);
            if (expected === 0) return analysis === undefined;
            return analysis && analysis.quantity === expected;
        },
    ));
});
