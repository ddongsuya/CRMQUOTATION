/**
 * Rule Coverage — 룰 카탈로그(33개) × 현재 코드/데이터 구현 매핑.
 *
 * 목적:
 *   "이 룰은 지금 코드 어디에 있는가? 또는 아직 구현 안 됐는가?"
 *   → Phase C (suggest.ts/assemble.js 의 인라인 룰을 카탈로그 호출로 외부화)
 *     의 우선순위 결정에 사용.
 *
 * 분류:
 *   implemented_in_code  — suggest.ts/assemble.js/pricing.js 등에 명시적 로직 존재
 *   data_only            — 코드 로직 없이 test_items.json/modality_presets/priceTiers 로 표현
 *   partial              — 부분 구현 (예: 카테고리만 있고 자동 트리거는 없음)
 *   not_implemented      — 현재 시스템에 룰 효과 없음 (영업 수기 처리 추정)
 *
 * 본 테스트는:
 *   1. 33개 룰 모두에 coverage 엔트리가 있는지 검증 (누락 방지)
 *   2. coverage 분포를 콘솔에 출력 (Phase C 우선순위 근거)
 *
 * Run: `node --test src/lib/__tests__/rule-coverage.test.js`
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const catalog = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'rules_catalog.yaml'), 'utf8'));

// ─── COVERAGE MAP — 룰 ID → 구현 상태 ────────────────────────────────────
// 항목별 status, evidence (파일·라인 또는 설명), recommended_action

const COVERAGE = {
  // ─── PricingFormula ──────────────────────────────────────────────────
  'PF-001': {
    status: 'implemented_in_code',
    evidence: 'engine/policy.js: pricePF001NonRodentBleedingOnly(points). POLICY_REGISTRY 매처 + UI(SectionSelections OverrideEditor PoliciesPanel) 에서 채혈 pt 입력 받아 unitPriceOverride 자동 채움. policy.test.js 5개 단위 테스트.',
    recommended_action: '카탈로그 단가 변경 시 policy.js 와 rules_catalog.yaml 동기 갱신.',
  },
  'PF-002': {
    status: 'data_only',
    evidence: 'test_items.json 의 priceTiers + suggest.ts pickPricedCandidate/resolveUnitPrice 가 excipientCount 기반 tier 선택',
    recommended_action: 'PF 카탈로그 메타로 산출 근거 표시(영업 검증용). 코드 변경 불필요.',
  },
  'PF-003': {
    status: 'data_only',
    evidence: 'PF-002 와 동일 메커니즘 (priceTiers)',
    recommended_action: 'PF-002 와 동일',
  },

  // ─── PrerequisiteRule ────────────────────────────────────────────────
  'PR-001': {
    status: 'not_implemented',
    evidence: '마우스 발암성 선택 시 4주 DRF + 13주 반복독성 자동 추가 로직 없음',
    recommended_action: 'modality-config.ts 의 세포치료제·합성신약 carcinogenicity addon 활성화 시 PR-001 트리거. 단, 마우스 종 표준 시험 데이터 부재 (Q-015).',
  },
  'PR-002': {
    status: 'not_implemented',
    evidence: 'USFDA 제출 시 유전독성 자동 제안 로직 없음. submission_target 필드 자체가 store/Plan 에 없음.',
    recommended_action: 'store.ts 의 Plan 에 submission_target 추가 + suggest.ts 가 PR-002 트리거. low confidence (Q-013 답변 후).',
  },
  'PR-003': {
    status: 'data_only',
    evidence: '화장품 categories.skinIrritation/eyeIrritation 에 RhE/RhCE 시험 등록됨. 4주 lead time 안내는 없음.',
    recommended_action: '화장품 카테고리 선택 시 UI 에 "4주 사전 주문 필요" 안내 표시.',
  },
  'PR-004': {
    status: 'not_implemented',
    evidence: '소핵 screening 의 LD50 자료 제공 필요 trigger 없음',
    recommended_action: '스크리닝 categories 선택 시 customer_data 입력 UI 추가.',
  },
  'PR-005': {
    status: 'not_implemented',
    evidence: '시험 개시 prerequisite (시험의뢰서 + 정보기록지 + CoA) 자동 안내 없음',
    recommended_action: '견적 발행 후 시험 시작 워크플로우 단계에서 prerequisites 체크 (별도 워크플로우 단계).',
  },
  'PR-006': {
    status: 'not_implemented',
    evidence: '의료기기 시험 개시 prereq (기술문서) 별도 처리 없음',
    recommended_action: 'PR-005 와 함께 file_type 별 분기 처리.',
  },
  'PR-007': {
    status: 'not_implemented',
    evidence: '시험물질 멸균 검수 룰 없음',
    recommended_action: '검체 입고 워크플로우 (시험 시작 단계).',
  },
  'PR-008': {
    status: 'not_implemented',
    evidence: '영문보고서 prereq (국문 완료 6-8주 + 신청서) 없음',
    recommended_action: '영문보고서 옵션 활성화 시 lead time 안내.',
  },

  // ─── ConditionalGroup ────────────────────────────────────────────────
  'CG-001': {
    status: 'not_implemented',
    evidence: '비설치류 4주 반복 시 선행 자료 보유 옵션 없음. customer_data 필드 자체가 없음.',
    recommended_action: 'store.ts Plan 에 customer_data 추가 + suggest.ts 가 CG-001 트리거하여 시험군 -1 + 가격 재산정.',
  },
  'CG-002': {
    status: 'not_implemented',
    evidence: '생식독성 TK 태반이행 시 매일/비매일 투여 분기 없음',
    recommended_action: '생식독성 카테고리 + dosing schedule 입력 필요.',
  },
  'CG-003': {
    status: 'partial',
    evidence: 'modality-config 의 의료기기 categories 에 subAcute/subChronic 두 옵션이 등록됨. 사용자가 수동 선택. 인체 노출 기간에 따른 자동 선택 로직 없음.',
    recommended_action: '의료기기 인체 노출 기간 입력 필드 추가 → 자동 subAcute/subChronic 선택.',
  },
  'CG-004': {
    status: 'not_implemented',
    evidence: '의료기기 이식시험의 흡수성/비흡수성 분기 없음',
    recommended_action: '의료기기 implantation 카테고리 선택 시 흡수성 추가 입력 → 부검 포인트 수 조정.',
  },

  // ─── Addon ───────────────────────────────────────────────────────────
  'AD-001': {
    status: 'implemented_in_code',
    evidence: 'engine/policy.js: addonAD001GenotoxRecheck() = 2,000,000원. POLICY_REGISTRY 매처(유전독성 + 복귀돌연변이/Ames/TG471). UI 에서 customNote 에 "AD-001 옵션: +2,000,000원" 자동 추가. policy.test.js 검증.',
    recommended_action: '향후 별도 옵션 라인 시스템 도입 시 unitPrice 직접 합산 가능. 현재는 customNote 정보 표시.',
  },
  'AD-002': {
    status: 'not_implemented',
    evidence: '건기식 13주 반복 — 성호르몬 측정 옵션 없음',
    recommended_action: '건강기능식품 modality 에 sexHormonePanel addon 추가.',
  },
  'AD-003': {
    status: 'implemented_in_code',
    evidence: 'engine/policy.js: addonAD003CosmeticPositiveRecheck() = 2,000,000원 (AD-001 과 동가, 트리거만 다름). POLICY_REGISTRY 매처. UI 에서 customNote 자동 추가. policy.test.js 검증.',
    recommended_action: '결과 양성판정 트리거는 시험 진행 후 단계 — 견적 단계에서는 옵션 정보만 안내. 향후 결과 입력 워크플로우와 연동.',
  },
  'AD-004': {
    status: 'not_implemented',
    evidence: '독성 스크리닝 관심장기 추가 옵션 없음. 조직병리 단가표 연동도 없음.',
    recommended_action: '스크리닝 카테고리에 additionalOrgans addon + 조직병리 가격 함수.',
  },
  'AD-005': {
    status: 'not_implemented',
    evidence: '의료기기 유전독성 — 독성 발견 시 확인시험 추가 룰 없음',
    recommended_action: '결과 입력 후 후속 워크플로우 (견적 단계 아님).',
  },
  'AD-006': {
    status: 'partial',
    evidence: 'SEND/CTD/번역 modality 자체가 없음. 회복군·TK 옵션은 일반 modality 에 있으나 SEND 단가 분기 없음.',
    recommended_action: 'SEND/CTD/번역 modality 추가 → 회복군·TK 토글 시 단가표 (1M/2M) 적용 (AD-010 과 연동).',
  },
  'AD-007': {
    status: 'not_implemented',
    evidence: '의료기기 SD 랫드 이식시험 관찰기간 연장 옵션 없음',
    recommended_action: 'implantation 카테고리 + 관찰주수 입력 → 가격 가산.',
  },
  'AD-008': {
    status: 'not_implemented',
    evidence: '영문보고서 요약본 (70만원) 옵션 없음',
    recommended_action: 'AD-006 과 같은 SEND/번역 modality 에 summary 옵션 추가.',
  },
  'AD-009': {
    status: 'not_implemented',
    evidence: '번역보고서 추가 비용 옵션 없음',
    recommended_action: 'AD-006/008 통합 처리 (SEND/번역 modality).',
  },
  'AD-010': {
    status: 'implemented_in_code',
    evidence: 'engine/policy.js: addonAD010SendRawDataReview(testType) — 단가표 (단회 1M / 반복 2M). POLICY_REGISTRY 매처(SEND 시험). UI 에서 testType 선택 후 customNote 자동 추가. policy.test.js 검증.',
    recommended_action: 'SEND modality 자체 추가 시 본 룰을 modality addon 으로 통합 (현재는 OverrideEditor 정책 패널에서 호출).',
  },
  'AD-011': {
    status: 'not_implemented',
    evidence: '영문보고서 Appendix 번역 추가 옵션 없음',
    recommended_action: 'AD-006/008/009 통합 (SEND/번역 modality).',
  },

  // ─── WaiverRule ──────────────────────────────────────────────────────
  'WV-001': {
    status: 'partial',
    evidence: '화장품 categories 의 phototox/photosensitization 은 수동 토글 (사용자가 끔). UV 흡수 없음 증빙으로 자동 면제 로직 없음.',
    recommended_action: 'customer_data.no_uv_absorption 입력 시 자동 면제 + 안내.',
  },

  // ─── SubstitutionRule ────────────────────────────────────────────────
  'SB-001': {
    status: 'not_implemented',
    evidence: '비설치류 카테터 경구투여 → 정맥경피 가격 대체 + 조제물분석 자동 추가 없음',
    recommended_action: 'customer_data.catheter_oral_administration 입력 시 가격 대체 + 동반 시험 추가.',
  },
  'SB-002': {
    status: 'partial',
    evidence: '의료기기 genotox categories 에 MLA 가 포함되어 있어 선택 가능. 외국 봉합사 자동 대체 로직은 없음.',
    recommended_action: 'customer_data.foreign_suture 입력 + UI 확인 단계.',
  },
  'SB-003': {
    status: 'not_implemented',
    evidence: '복합제 조제물분석 동시분석 대체 로직 없음 (가격 동일이므로 정보 표시만)',
    recommended_action: 'UI 안내만 추가 (가격 변동 없음).',
  },

  // ─── GenericRule ─────────────────────────────────────────────────────
  'GR-001': {
    status: 'implemented_in_code',
    evidence: 'engine/pricing.js: computeValidUntil(issuedAt) → +60일. Quote.validUntil 필드.',
    recommended_action: '룰 카탈로그가 코드의 source of truth 와 정합. 변경 시 동기화 필요.',
  },
  'GR-002': {
    status: 'implemented_in_code',
    evidence: 'engine/pricing.js: VAT_RATE = 0.1. computeTotals 가 vatAmount 분리 산출. 견적서 출력 시 "부가세 별도" 표기.',
    recommended_action: '카탈로그 메타와 동기 유지.',
  },
  'GR-003': {
    status: 'data_only',
    evidence: 'prisma/schema.prisma 의 Quote.validUntil 주석. 시험기간(duration_weeks) 의미 정의는 코드에 명시 없음.',
    recommended_action: 'duration 산출 함수 (시작=동물입고, 종료=보고서 제출) 분리 — 현재는 영업 수동.',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 평탄화 — 33개 룰 ID 수집
// ─────────────────────────────────────────────────────────────────────────
function allRuleIds() {
  const sections = [
    'pricing_formulas', 'pricing_formulas_v1_1_audit',
    'prerequisite_rules', 'prerequisite_rules_v1_1_audit',
    'conditional_groups', 'conditional_groups_v1_1_audit',
    'addons', 'addons_v1_1_audit',
    'waiver_rules', 'substitution_rules', 'generic_rules',
  ];
  const ids = [];
  for (const s of sections) for (const r of (catalog[s] || [])) ids.push(r.id);
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────────────────────────────────

test('33개 룰 모두에 COVERAGE 엔트리가 있다', () => {
  const ids = allRuleIds();
  const missing = ids.filter(id => !COVERAGE[id]);
  assert.deepEqual(missing, [], `COVERAGE 에 없음: ${missing.join(', ')}`);
  // 역방향: COVERAGE 에 있는 ID 가 모두 카탈로그에 존재?
  const stale = Object.keys(COVERAGE).filter(id => !ids.includes(id));
  assert.deepEqual(stale, [], `카탈로그에서 폐기됐는데 COVERAGE 에 남음: ${stale.join(', ')}`);
});

test('COVERAGE 의 status 값이 모두 알려진 enum', () => {
  const valid = ['implemented_in_code', 'data_only', 'partial', 'not_implemented'];
  for (const [id, cov] of Object.entries(COVERAGE)) {
    assert.ok(valid.includes(cov.status), `${id}: status="${cov.status}" 알려지지 않음`);
    assert.ok(cov.evidence && cov.evidence.length > 0, `${id}: evidence 비어있음`);
    assert.ok(cov.recommended_action && cov.recommended_action.length > 0, `${id}: recommended_action 비어있음`);
  }
});

test('[REPORT] 룰 구현 커버리지 분포', () => {
  const dist = {};
  for (const cov of Object.values(COVERAGE)) {
    dist[cov.status] = (dist[cov.status] || 0) + 1;
  }
  const total = Object.values(dist).reduce((s, n) => s + n, 0);
  console.log(`    ────────────────────────────────────────────`);
  console.log(`    Rule Coverage Report (총 ${total}개 룰)`);
  console.log(`    ────────────────────────────────────────────`);
  for (const [s, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    const pct = (n / total * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(n / total * 20));
    console.log(`    ${s.padEnd(22)} ${String(n).padStart(2)} (${pct}%) ${bar}`);
  }
  console.log(`    ────────────────────────────────────────────`);
});

test('[REPORT] not_implemented 룰 ID 목록 (Phase C 우선순위 후보)', () => {
  const ids = allRuleIds();
  const ni = [];
  for (const id of ids) {
    if (COVERAGE[id]?.status === 'not_implemented') ni.push(id);
  }
  console.log(`    Not implemented (${ni.length}개): ${ni.join(', ')}`);
});

test('[REPORT] high-confidence 단가 명시 룰 중 not_implemented (시급)', () => {
  // 단가가 명시된 룰 중 미구현 = 즉시 가치 있는 자동화
  const sections = [
    'pricing_formulas', 'pricing_formulas_v1_1_audit',
    'addons', 'addons_v1_1_audit',
  ];
  const candidates = [];
  for (const s of sections) {
    for (const r of (catalog[s] || [])) {
      if (r.confidence === 'high' && COVERAGE[r.id]?.status === 'not_implemented') {
        const price = r.price_krw || r.price_krw_table?.[0]?.price_krw || (r.formula ? '공식' : '?');
        candidates.push(`${r.id} (${price}) — ${r.description_ko.slice(0, 50)}`);
      }
    }
  }
  console.log(`    High-confidence + 단가 명시 + not_implemented (${candidates.length}건):`);
  for (const c of candidates) console.log(`      • ${c}`);
});
