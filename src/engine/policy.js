/**
 * Rule policy functions — rules_catalog.yaml 의 단가·공식이 명시된 룰들을
 * 순수 함수로 구현. UI 에서 호출하여 자동 산출 가격·옵션을 사용자 override
 * 필드(C-3)에 채워주는 데 사용.
 *
 * 각 함수는:
 *   - 입력: 룰 적용에 필요한 변수 (예: PF-001 의 채혈 포인트 수)
 *   - 출력: { ok: boolean, value?: number, reason?: string, ruleId: string }
 *   - 부작용 없음, 외부 데이터 의존 없음 → 단위 테스트 쉬움
 *
 * 카탈로그 동기: 단가·공식이 바뀌면 여기와 data/rules_catalog.yaml 양쪽 수정.
 * rule-coverage.test.js 가 COVERAGE 맵에서 이 모듈 사용을 'implemented_in_code'
 * 로 추적.
 */

/**
 * PF-001: 비설치류 채혈만 진행 가격 산출.
 * 공식: 총 채혈 포인트 × 30,000원 + 5,000,000원
 * 적용 대상: 비설치류 + TK + "채혈까지만 진행" 시험
 *
 * @param {number} bleedingPoints 총 채혈 point 수 (양의 정수)
 * @returns {{ ok: boolean, value?: number, reason?: string, ruleId: 'PF-001' }}
 */
function pricePF001NonRodentBleedingOnly(bleedingPoints) {
    if (!Number.isFinite(bleedingPoints) || bleedingPoints < 0 || !Number.isInteger(bleedingPoints)) {
        return { ok: false, reason: '채혈 포인트는 0 이상의 정수여야 합니다', ruleId: 'PF-001' };
    }
    const PRICE_PER_POINT = 30_000;
    const BASE = 5_000_000;
    return {
        ok: true,
        value: bleedingPoints * PRICE_PER_POINT + BASE,
        ruleId: 'PF-001',
    };
}

/**
 * AD-001: 유전독성 복귀돌연변이 재현시험 추가 비용.
 * 적용 대상: 의약품·건기식의 유전독성 복귀돌연변이 (자발적 재현).
 *
 * @returns {{ ok: true, value: number, ruleId: 'AD-001' }}
 */
function addonAD001GenotoxRecheck() {
    return { ok: true, value: 2_000_000, ruleId: 'AD-001' };
}

/**
 * AD-003: 화장품 유전독성 양성판정 시 강제 재현시험.
 * AD-001 과 가격 동일하나 트리거가 다름 (양성판정 시 강제). 영업 룰 정합성을
 * 위해 별도 함수.
 *
 * @returns {{ ok: true, value: number, ruleId: 'AD-003' }}
 */
function addonAD003CosmeticPositiveRecheck() {
    return { ok: true, value: 2_000_000, ruleId: 'AD-003' };
}

/**
 * AD-010: SEND 타기관 raw data review 추가 비용.
 * 단가표: 단회 = 1,000,000원 / 반복 = 2,000,000원
 *
 * @param {'single'|'repeat'} testType 'single' = 단회시험 / 'repeat' = 반복시험
 * @returns {{ ok: boolean, value?: number, reason?: string, ruleId: 'AD-010' }}
 */
function addonAD010SendRawDataReview(testType) {
    const TABLE = { single: 1_000_000, repeat: 2_000_000 };
    if (!(testType in TABLE)) {
        return { ok: false, reason: 'testType 은 "single" 또는 "repeat" 이어야 합니다', ruleId: 'AD-010' };
    }
    return { ok: true, value: TABLE[testType], ruleId: 'AD-010' };
}

/**
 * 룰 ID 별 메타데이터 (UI 에서 정책 버튼 표시용).
 * 어느 룰이 어떤 시험에 적용 가능한지 매처 + 사용자에게 보여줄 설명.
 */
const POLICY_REGISTRY = {
    'PF-001': {
        label_ko: '비설치류 채혈만 진행 가격 공식',
        description_ko: '총 채혈 pt × 30,000원 + 5,000,000원',
        appliesTo: (item) => /비설치류/.test(item.testName || '') && /TK|독성동태/i.test(item.testName || '') && /채혈만/.test(item.testName || ''),
        inputs: [
            { key: 'bleedingPoints', label_ko: '총 채혈 포인트', type: 'number', min: 0, hint_ko: '예: 252' },
        ],
        compute: (inputs) => pricePF001NonRodentBleedingOnly(Number(inputs.bleedingPoints)),
        appliesToField: 'unitPriceOverride',
    },
    'AD-001': {
        label_ko: '유전독성 재현시험 옵션 (+200만원)',
        description_ko: '복귀돌연변이 재현 확인 옵션',
        appliesTo: (item) => /유전독성/.test(item.testName || '') && /복귀돌연변이|Ames|TG471/i.test(item.testName || ''),
        inputs: [],
        compute: () => addonAD001GenotoxRecheck(),
        // 옵션 추가형 룰 — 단가만 표시. 적용 방법은 별도 UI 결정 (현재는 customNote 권장).
        appliesToField: 'info',  // 가격을 자동 적용하지 않고 정보만 노출
    },
    'AD-003': {
        label_ko: '화장품 유전독성 양성판정 재현시험 (+200만원)',
        description_ko: '양성판정 시 강제 재현',
        appliesTo: (item) => /유전독성/.test(item.testName || '') && /복귀돌연변이|Ames|TG471/i.test(item.testName || ''),
        inputs: [],
        compute: () => addonAD003CosmeticPositiveRecheck(),
        appliesToField: 'info',
    },
    'AD-010': {
        label_ko: 'SEND 타기관 raw data review',
        description_ko: '단회 1,000,000 / 반복 2,000,000원',
        appliesTo: (item) => /SEND/i.test(item.testName || ''),
        inputs: [
            { key: 'testType', label_ko: '시험 타입', type: 'select', options: [
                { value: 'single', label_ko: '단회시험 (1,000,000원)' },
                { value: 'repeat', label_ko: '반복시험 (2,000,000원)' },
            ] },
        ],
        compute: (inputs) => addonAD010SendRawDataReview(inputs.testType),
        appliesToField: 'info',
    },
};

/**
 * 특정 TestItem 에 적용 가능한 정책 룰 ID 목록 반환.
 * @param {object} item TestItem
 * @returns {string[]} 적용 가능한 룰 ID 배열
 */
function applicablePolicies(item) {
    if (!item) return [];
    return Object.entries(POLICY_REGISTRY)
        .filter(([, def]) => def.appliesTo(item))
        .map(([id]) => id);
}

module.exports = {
    pricePF001NonRodentBleedingOnly,
    addonAD001GenotoxRecheck,
    addonAD003CosmeticPositiveRecheck,
    addonAD010SendRawDataReview,
    POLICY_REGISTRY,
    applicablePolicies,
};
