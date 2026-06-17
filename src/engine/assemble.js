/**
 * Quote line assembler.
 *
 * Takes a list of user-selected TestItems + 부형제 종수 + price standard,
 * returns a flat list of QuoteLines:
 *   - kind:'test'           — each selected test item as its own line
 *   - kind:'prep_analysis'  — 조제물분석 (Validation) — 부형제 그룹별 1회 (2026-05 신규)
 *   - kind:'analysis'       — 함량분석 line (회당 100만원 × 회수 × 종수)
 *
 * Domain rules (회사 합의 기준 — 2026-05):
 *   R1. 단가
 *         unitPrice = priceTiers[부형제 종수] (있으면) ELSE priceMfds/priceOecd
 *         가격 없는 항목 → 0 (라인은 표시, "협의" 표기)
 *
 *   R2. 함량분석 회수 (per study)
 *         단회             → 1회
 *         1주 ~ 13주       → 2회
 *         26주 이상(만성)  → 4주당 1회 = floor(weeks / 4) (26→6, 39→9, 52→13)
 *         in vitro (유전독성·안전성약리) → studyWeeks 없으면 1회 (hamryangCountForWeeks(null)=1)
 *
 *   R3. 누가 함량분석에 포함되나
 *         ✓ 본시험 (단회/반복)            — 자체 기간 기준
 *         ✓ DRF                          — 자체 기간 기준 (보통 4주 → 2회)
 *         ✓ TK 위성군                    — 본시험과 별도 합산, 자체 기간 기준
 *         ✓ 유전독성 (2026-05 신규)        — 별도 부형제, 1회
 *         ✓ 안전성약리 hERG/CNS/호흡기 등 — 별도 부형제, 1회
 *         ✗ 회복군                       — 본시험 약 공유 (별도 분석 X)
 *         ✗ 조제물분석/함량분석 자체     — 그 자체가 분석 항목이므로 중복 누적 X
 *         ✗ 세포독성·면역원성·이식 등    — 영업 미명시 (사용자 직접 추가 가능)
 *
 *   R4. 부형제 종수 곱
 *         effectiveCount = (Σ per-test 회수) × max(부형제 종수, 1)
 *
 *   R5. 회복군 / TK 검증 경고
 *         회복군: 상위 본시험이 선택 목록에 없으면 warning
 *         TK:    동일 기간 반복투여 본시험이 없으면 warning
 *
 *   R6. 중복 키 머지 — 동일 key 중복 선택은 quantity 합산
 *
 *   R7. 사용자 직접 입력 (override) — Phase C-1 (2026-05)
 *       비임상시험은 변수가 다양하여 자동 정형화가 불가능한 케이스가 많음.
 *       Selection 에 다음 override 필드가 있으면 우선 사용:
 *         - unitPriceOverride       → pickPrice 무시하고 사용 (가격 협의·할인)
 *         - studyWeeksOverride      → effectiveWeeks 우선 (F-1 비정형 141건)
 *         - hamryangCountOverride   → hamryangCountForWeeks 우선 (회수 직접 지정)
 *         - customNote              → line.note 에 합쳐 출력
 *       명시적 0 도 유효한 override 값으로 처리 (예: studyWeeksOverride=0 = 단회)
 *
 *   R8. 조제물분석 (Validation) 자동 추가 — 2026-05 신규
 *       부형제 그룹별로 1회 = 1,000만원 (priceFormulationAnalysisUnit, override 가능).
 *       그룹 분류:
 *         - in_vivo   : 설치류/비설치류 본시험·DRF·TK·회복 (같은 부형제)
 *         - genotox   : 유전독성 시험들 (별도 부형제)
 *         - safety_pharm: 안전성약리 hERG/CNS/호흡기/Cav/Nav/MEA (또 다른 부형제)
 *         - null      : 기타 (생식독성·국소·면역원성 등 — 자동 추가 안 함)
 *       사용자가 명시적으로 "조제물 분석" 시험을 selection 에 추가한 경우 → 자동 추가 skip.
 *       IND 표준 패키지(in vivo + 유전독성 + hERG)=3그룹 → 3,000만원 자동 산출.
 */

/** override 값이 적용 가능한지 (null/undefined 가 아니고 숫자 또는 0) */
function hasOverride(v) { return v != null; }

/**
 * @param {{ item: object, quantity?: number, unitPriceOverride?: number|null, studyWeeksOverride?: number|null, hamryangCountOverride?: number|null, customNote?: string|null }[]} selections
 * @param {{ excipientCount: number, priceStandard: 'MFDS'|'OECD', priceAnalysisUnit: number, priceFormulationAnalysisUnit?: number }} opts
 *   priceFormulationAnalysisUnit: 조제물분석 1회 단가 (default 10,000,000원, R8)
 * @returns {{ lines: object[], warnings: string[] }}
 */
function assembleQuoteLines(selections, opts) {
    const { excipientCount, priceStandard, priceAnalysisUnit } = opts;
    const priceFormulationAnalysisUnit = opts.priceFormulationAnalysisUnit ?? 10_000_000;
    if (!Number.isInteger(excipientCount) || excipientCount < 0) {
        throw new RangeError('excipientCount must be non-negative integer');
    }
    if (priceStandard !== 'MFDS' && priceStandard !== 'OECD') {
        throw new RangeError('priceStandard must be MFDS or OECD');
    }
    if (!Number.isFinite(priceAnalysisUnit) || priceAnalysisUnit < 0) {
        throw new RangeError('priceAnalysisUnit must be non-negative number');
    }
    if (!Number.isFinite(priceFormulationAnalysisUnit) || priceFormulationAnalysisUnit < 0) {
        throw new RangeError('priceFormulationAnalysisUnit must be non-negative number');
    }

    const warnings = [];

    // 1) merge duplicates — override 는 sel 단위로 들어오므로 마지막 override 가 이김 (영업 입장에서 가장 최근 입력 존중)
    /** @type {Map<string, {item: object, quantity: number, unitPriceOverride?: number|null, studyWeeksOverride?: number|null, hamryangCountOverride?: number|null, customNote?: string|null}>} */
    const merged = new Map();
    for (const sel of selections) {
        const q = sel.quantity ?? 1;
        if (!Number.isInteger(q) || q < 1) throw new RangeError('quantity must be positive integer');
        const key = sel.item.key;
        if (merged.has(key)) {
            const ex = merged.get(key);
            ex.quantity += q;
            // override 는 마지막 입력으로 갱신 (명시된 것만)
            if (hasOverride(sel.unitPriceOverride))     ex.unitPriceOverride     = sel.unitPriceOverride;
            if (hasOverride(sel.studyWeeksOverride))    ex.studyWeeksOverride    = sel.studyWeeksOverride;
            if (hasOverride(sel.hamryangCountOverride)) ex.hamryangCountOverride = sel.hamryangCountOverride;
            if (sel.customNote)                          ex.customNote            = sel.customNote;
        } else {
            merged.set(key, {
                item: sel.item,
                quantity: q,
                unitPriceOverride:     hasOverride(sel.unitPriceOverride)     ? sel.unitPriceOverride     : undefined,
                studyWeeksOverride:    hasOverride(sel.studyWeeksOverride)    ? sel.studyWeeksOverride    : undefined,
                hamryangCountOverride: hasOverride(sel.hamryangCountOverride) ? sel.hamryangCountOverride : undefined,
                customNote: sel.customNote || undefined,
            });
        }
    }

    // 2) test lines + classify for 함량분석
    const lines = [];
    const breakdown = []; // [{ label, weeks, count, quantity }]

    for (const entry of merged.values()) {
        const { item, quantity, unitPriceOverride, studyWeeksOverride, hamryangCountOverride, customNote } = entry;
        // (R7) 가격 override
        const autoPrice = pickPrice(item, priceStandard, excipientCount);
        const unitPrice = hasOverride(unitPriceOverride) ? Number(unitPriceOverride) : autoPrice;
        const priceFromOverride = hasOverride(unitPriceOverride) && Number(unitPriceOverride) !== autoPrice;

        // note 조립: 가격 미보유 안내 + customNote + override 표시
        const noteParts = [];
        if (unitPrice === 0 && !hasOverride(unitPriceOverride)) noteParts.push(`가격 정보 없음(${priceStandard})`);
        if (priceFromOverride) noteParts.push(`[수동 가격] 기준가 ${autoPrice.toLocaleString()}원 → ${Number(unitPrice).toLocaleString()}원`);
        if (customNote) noteParts.push(customNote);

        lines.push({
            kind: 'test',
            testItemKey: item.key,
            testName: item.testName,
            adminRoute: item.adminRoute,
            unitPrice,
            quantity,
            subtotal: round2(unitPrice * quantity),
            linkRelation: item.linkRelation ?? null,
            linkedFromKey: null,
            note: noteParts.length > 0 ? noteParts.join(' / ') : undefined,
        });

        // 함량분석 누적 (R3) — (R7) studyWeeks / hamryangCount override
        const cls = classifyForHamryang(item);
        if (cls.included) {
            const weeks = hasOverride(studyWeeksOverride) ? Number(studyWeeksOverride) : effectiveWeeks(item);
            const count = hasOverride(hamryangCountOverride)
                ? Math.max(0, Math.floor(Number(hamryangCountOverride)))
                : hamryangCountForWeeks(weeks);
            if (count > 0) {
                breakdown.push({
                    label: item.testName,
                    weeks,
                    count,
                    quantity,
                });
            }
        }

        // 회복군 / TK 검증 (R5)
        if (cls.kind === 'recovery' && item.parentTest && !isParentSelected(item.parentTest, merged)) {
            warnings.push(`회복군 "${item.testName}" — 상위 본시험 "${item.parentTest}" 이(가) 선택되지 않았습니다.`);
        }
        if (cls.kind === 'tk' && item.studyWeeks != null) {
            const hasMatchingParent = [...merged.values()].some(({ item: p }) =>
                p.key !== item.key && /반복/.test(p.testName) && p.studyWeeks === item.studyWeeks,
            );
            if (!hasMatchingParent) {
                warnings.push(`TK "${item.testName}" — 동일 기간(${item.studyWeeks}주) 반복투여 본시험이 선택되지 않았습니다.`);
            }
        }
    }

    // 3) 함량분석 합산 라인 (R4)
    //    사용자가 명시적으로 "함량 분석" 시험을 selection 에 추가했으면 자동 합산 skip (중복 방지).
    //    예: 복합제 — 종수×분석방식 고정단가 함량분석을 카탈로그 항목으로 직접 선택.
    const userAddedContentAnalysis = [...merged.values()].some(({ item }) =>
        /함량\s*분석/i.test(item.testName || ''),
    );
    const totalSessions = breakdown.reduce((s, b) => s + b.count * b.quantity, 0);
    const multiplier = Math.max(excipientCount, 1);
    const effectiveCount = totalSessions * multiplier;
    if (effectiveCount > 0 && !userAddedContentAnalysis) {
        const noteLines = breakdown.map((b, i) =>
            `(${i + 1}) ${b.label} : ${b.count}회${b.quantity > 1 ? ` × ${b.quantity}` : ''}`,
        );
        if (excipientCount > 1) {
            noteLines.push(`× 부형제 ${excipientCount}종`);
        } else if (excipientCount === 1) {
            noteLines.push(`(부형제 1종)`);
        }
        lines.push({
            kind: 'analysis',
            testName: '투여물질의 함량 분석',
            unitPrice: priceAnalysisUnit,
            quantity: effectiveCount,
            subtotal: round2(priceAnalysisUnit * effectiveCount),
            note: noteLines.join('\n'),
            breakdown, // raw data for PDF use
            excipientCount,
        });
    }

    // 3.5) R8 조제물분석 (Validation) 자동 추가 — 부형제 그룹별 1회.
    //      사용자가 명시적으로 "조제물 분석" 시험을 selection 에 추가했으면 자동 추가 skip (중복 방지).
    const userAddedPrepAnalysis = [...merged.values()].some(({ item }) =>
        /조제물\s*분석|Validation/i.test(item.testName || ''),
    );
    if (!userAddedPrepAnalysis) {
        // 그룹별 시험 목록 수집 (그룹당 1개 이상이면 조제물분석 1회)
        const groupTests = new Map();   // group → [testName, ...]
        for (const { item } of merged.values()) {
            const grp = classifyPrepAnalysisGroup(item);
            if (!grp) continue;
            const arr = groupTests.get(grp);
            if (arr) arr.push(item.testName);
            else groupTests.set(grp, [item.testName]);
        }
        // 표시 순서 안정화: in_vivo → genotox → safety_pharm
        const GROUP_ORDER = ['in_vivo', 'genotox', 'safety_pharm'];
        for (const grp of GROUP_ORDER) {
            const tests = groupTests.get(grp);
            if (!tests || tests.length === 0) continue;
            const sample = tests.slice(0, 2).join(', ') + (tests.length > 2 ? ` 외 ${tests.length - 2}건` : '');
            lines.push({
                kind: 'prep_analysis',
                testName: `투여물질의 조제물 분석 — ${PREP_ANALYSIS_GROUP_LABEL[grp]}`,
                unitPrice: priceFormulationAnalysisUnit,
                quantity: 1,
                subtotal: round2(priceFormulationAnalysisUnit * 1),
                group: grp,
                note: `포함 시험: ${sample}`,
            });
        }
    }

    // 4) 정렬: 조제물분석 → 함량분석 → 본시험류 (대략 표시 순서)
    const KIND_ORDER = { prep_analysis: 0, analysis: 1, test: 2 };
    lines.sort((a, b) => (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99));

    return { lines, warnings };
}

/**
 * 함량분석 회수 (회사 합의 룰)
 * @param {number|null} weeks
 * @returns {number}
 */
function hamryangCountForWeeks(weeks) {
    if (weeks == null || weeks === 0) return 1; // 단회 — 1회
    if (weeks <= 13) return 2;                  // 1주 ~ 13주 — 2회
    return Math.floor(weeks / 4);               // 만성(26주↑) — 4주당 1회
}

/**
 * 본시험 기간 추출. studyWeeks 가 없으면 testName 에서 N주 패턴을 시도.
 * @returns {number|null}
 */
function effectiveWeeks(item) {
    if (typeof item.studyWeeks === 'number') return item.studyWeeks;
    const m = (item.testName || '').match(/(\d+)\s*주/);
    if (m) return Number(m[1]);
    if (/단회|일회|급성/.test(item.testName || '')) return 0;
    return null;
}

/**
 * 함량분석 포함 여부 분류.
 * 2026-05 수정: 유전독성·안전성약리(hERG 등)도 부형제가 별도이므로 함량분석 1회 포함.
 * @returns {{ included: boolean, kind: 'main'|'drf'|'tk'|'recovery'|'analysis'|'genotox'|'safetyPharm'|'invitro_other'|'other' }}
 */
function classifyForHamryang(item) {
    const name = item.testName || '';
    const rule = item.hamryangRule || '';
    const link = item.linkRelation;

    // 분석 항목 자체 — 누적 제외
    if (/조제물\s*분석|함량\s*분석|Validation/i.test(name) || /조제물분석 자체/.test(rule) || link === 'GLP_ANALYSIS') {
        return { included: false, kind: 'analysis' };
    }
    // 회복군 — 본시험 약 공유, 제외
    if (link === 'RECOVERY' || /회복/.test(name) || /회복군 add-on/.test(rule)) {
        return { included: false, kind: 'recovery' };
    }
    // TK 위성군 — 별도 합산
    if (link === 'TK' || /\bTK\b|독성동태|PK\/TK/i.test(name)) {
        return { included: true, kind: 'tk' };
    }
    // DRF — 자체 기간 기준
    if (link === 'DRF' || /DRF|예비|용량결정/i.test(name)) {
        return { included: true, kind: 'drf' };
    }
    // 유전독성 — 별도 부형제, 1회 (2026-05 신규)
    if (/유전독성|Ames|TG471|복귀돌연변이|염색체이상|TG473|소핵|TG474|MLA|TG490|Comet/i.test(name)) {
        return { included: true, kind: 'genotox' };
    }
    // 안전성약리 (in vitro 채널·MEA 포함) — 별도 부형제, 1회 (2026-05 신규)
    if (/안전성약리|hERG|Cav|Nav|MEA|중추신경|호흡기계|Telemetry|텔레메/i.test(name)) {
        return { included: true, kind: 'safetyPharm' };
    }
    // 기타 in vitro / 면역원성 / 발열성 등 — 영업 미명시. 자동 미포함 (override 로 추가 가능).
    if (/세포독성|3T3|RhE|RhCE|GPMT|LLNA/i.test(name)) {
        return { included: false, kind: 'invitro_other' };
    }
    if (/면역원성|항체형성|발열성|혈액적합성|이식시험|감작/.test(name)) {
        return { included: false, kind: 'invitro_other' };
    }
    // 본시험 (반복투여·단회 등)
    if (/반복|단회|일회|급성/.test(name)) {
        return { included: true, kind: 'main' };
    }
    return { included: false, kind: 'other' };
}

/**
 * R8 조제물분석 — 부형제 그룹 분류 (2026-05 신규).
 * 같은 그룹의 시험들은 같은 부형제를 공유하므로 그룹당 조제물분석 1회.
 *
 * @returns {'in_vivo'|'genotox'|'safety_pharm'|null} null = 자동 분류 안 함 (영업 판단)
 */
function classifyPrepAnalysisGroup(item) {
    const name = item.testName || '';
    // 분석 항목 자체 — 그룹 분류 X
    if (/조제물\s*분석|함량\s*분석|Validation/i.test(name)) return null;
    // 회복군 — 본시험 부형제 공유 (별도 조제물분석 카운트 X)
    if (item.linkRelation === 'RECOVERY' || /회복/.test(name)) return null;

    // 유전독성 — 별도 부형제 그룹
    if (/유전독성|Ames|TG471|복귀돌연변이|염색체이상|TG473|소핵|TG474|MLA|TG490|Comet/i.test(name)) {
        return 'genotox';
    }
    // 안전성약리 (in vitro 채널·MEA·CNS·호흡기) — 또 다른 부형제 그룹
    if (/안전성약리|hERG|Cav|Nav|MEA|중추신경|호흡기계|Telemetry|텔레메/i.test(name)) {
        return 'safety_pharm';
    }
    // in vivo 본시험·DRF·TK·회복 (동물 투여 — 같은 부형제 그룹)
    if (/설치류|비설치류|랫드|마우스|rat|mouse|beagle|비글|개\b|토끼|rabbit|monkey|원숭이|guinea|돼지|pig|hamster|햄스터/i.test(name)) {
        return 'in_vivo';
    }
    // 기타 (생식독성·국소·면역원성·이식 등) — 자동 분류 안 함
    return null;
}

const PREP_ANALYSIS_GROUP_LABEL = {
    in_vivo: 'in vivo (동물 투여 시험 — 본시험·DRF·TK·회복)',
    genotox: '유전독성 (별도 부형제)',
    safety_pharm: '안전성약리 (in vitro · 또 다른 부형제)',
};

/** Resolve unit price with priceTiers (복합제) fallback to flat priceMfds/Oecd. */
function pickPrice(item, std, excipientCount) {
    const tiers = item.priceTiers;
    if (tiers && typeof excipientCount === 'number') {
        const want = excipientCount <= 2 ? '2' : excipientCount === 3 ? '3' : '4';
        const order = ['4', '3', '2'];
        const fallback = order[order.indexOf(want) >= 0 ? order.indexOf(want) : 0];
        const v = tiers[want] ?? tiers[fallback] ?? tiers['3'] ?? tiers['2'] ?? tiers['4'];
        if (Number.isFinite(v) && v != null) return Number(v);
    }
    const v = std === 'MFDS' ? item.priceMfds : item.priceOecd;
    return Number.isFinite(v) && v != null ? Number(v) : 0;
}

/**
 * 회복군의 parentTest 가 선택된 본시험에 있는지 매칭.
 *
 * F-2 수정 (2026-05): test_items.json 의 parentTest 값은 짧은 형태
 *   ("13주 반복투여독성") 인데 본시험 testName 은 종 접두사·띄어쓰기 변형이
 *   있어 ("설치류 13주 반복투여 독성") strict equality 로 매칭되지 않았음.
 *   → 공백·종 접두사를 정규화 후 substring 매칭으로 변경.
 *
 *   매칭 정책 (양방향 substring + normalize):
 *     - normalize 후 정확 일치 OR
 *     - parentTest 가 selected.testName 안에 포함 OR
 *     - selected.testName 이 parentTest 안에 포함 (parentTest 가 더 긴 경우)
 *
 *   normalize: 공백 제거 + "설치류"/"비설치류" 접두사 제거.
 */
function normalizeTestName(s) {
    return String(s || '')
        .replace(/\s+/g, '')
        .replace(/^(설치류|비설치류)/, '');
}

function isParentSelected(parentTestName, mergedMap) {
    const target = normalizeTestName(parentTestName);
    if (!target) return false;
    for (const { item } of mergedMap.values()) {
        const n = normalizeTestName(item.testName);
        if (!n) continue;
        if (n === target || n.includes(target) || target.includes(n)) return true;
    }
    return false;
}

function round2(x) { return Math.round(x * 100) / 100; }

module.exports = { assembleQuoteLines, pickPrice, round2, hamryangCountForWeeks, isParentSelected, normalizeTestName };
