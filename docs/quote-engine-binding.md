# 견적 규칙 엔진 — 데이터 바인딩 설계 (v2)

> POC 규칙(`rules_catalog.v1.json`, 613 스키마 기준)을 보강완료 마스터
> (`master_items.v2.json`, 426항목)에 바인딩하기 위한 매핑 정의. 코드(`src/lib/quote-engine/`)는 이 문서대로 구현.

## 1. file_type(모달리티 코드) → category

| 규칙 file_type | 426 category | 비고 |
|---|---|---|
| `pharmaceutical_toxicology` | 의약품 | |
| `combination_drug` | 복합제 | |
| `toxicity_screening` | 스크리닝 | |
| `medical_device_biosafety` | 의료기기 | |
| `send_ctd_translation` | **SEND·CTD·번역** (독립 카테고리, 80항목) | 2026-06-29 세포치료제→분리 |
| `*` | 전체 | GR 메타룰(만료·VAT·기간정의) — 모든 견적 적용 |

> 세포치료제·건기식·화장품·점안제·화학물질·PK분포·심혈관·백신은 POC 규칙에 file_type이 아직 없음.
> → **모달리티 규칙 추가 예정**(각 모달리티 원본 견적서의 푸터·안내문에서 추출, POC와 동일 방식).
> 코어 엔진 가동 후 모달리티별로 점진 추가. 그 전까지는 마스터 가격 합산 + GR 메타룰만 적용.

## 2. 규칙 필드 → 426 마스터 필드

| 규칙 참조 | 426 필드 | 매칭 방식 |
|---|---|---|
| `test_name` / `test_name_contains` | `testName` | 부분일치(contains) |
| `test_subcategory_contains` (마우스·태반이행·비설치류 13주 반복·reconstructed Human) | `species` ∪ `testName` ∪ `testClass` | 셋 중 하나라도 부분일치 |
| `animal_grade` (설치류/비설치류) | `species` | 정확/부분일치 |
| `category` (예: 독성동태(TK)) | `testClass` | 부분일치 |
| `sub_category_contains` (복귀돌연변이·MLA 등) | `testName` ∪ `testClass` | 부분일치 |
| `sub_type: delivery_only` (채혈만) | `tkMode == "채혈만"` | |
| `route` (경구 등) | 입력 route → 경로그룹 | 가격 선택에 사용 |
| `test_no` (PF-002·PF-003·CG-004만) | `id` (613 test_no→이름→426 id 룩업표) | 별도 매핑표 `tno2id` |
| `bleeding_total_points` (PF-001 변수) | `tkPoints` 파싱 ("6point"→6) | |
| `combination_count` (PF 외삽) | `componentCount` 파싱 ("2종"→2) | |

## 3. 입력(견적 요청) — 항목 필드 아님, 컨텍스트

```ts
type QuoteInput = {
  category: string;            // = file_type 대응 (모달리티)
  standard: 'MFDS' | 'OECD';   // 제출처 가격기준
  route: string;               // 경구·피하·근육·정맥·경피·복강 등
  submissionTarget?: string;   // 국내 / USFDA / EMA (PR·AD 트리거)
  selectedItems: { id: string; quantity?: number }[];  // 고른 시험들
  customerConditions: Record<string, boolean>;  // §4 토글
  combinationCount?: number;   // 복합제 종수(2/3/4)
};
```

## 4. 고객조건 토글 (customerConditions) — 규칙 트리거

has_prior_4week_data · non_daily_dosing · catheter_oral_administration · foreign_suture ·
simultaneous_analysis_feasible · subacute · subchronic · non_absorbable · absorbable

## 5. 가격 결정 (핵심)

```
routeGroup(route) = 경구|피하|근육 → "경구피하근육" / 정맥|경피|복강 → "정맥경피" / 그외 → "경구피하근육"
price(item, route, std) =
   item.prices[routeGroup][std]
   ?? item.prices["경구피하근육"][std]     // 단일가 폴백(정맥경피 빈 항목 = 어떤 경로든 동일가)
   ?? item.prices[routeGroup]["MFDS"]      // OECD 없으면 MFDS 폴백
```
- 복합제: (componentCount × analysisMethod)로 행 선택 후 위 규칙.

## 6. 8단계 파이프라인 (POC 유지)
filter(후보) → select(선택항목 확정) → WV(면제) → SB(대체) → CG(조건부군) → PR(선행·문서) →
AD(추가옵션) → PF(가격공식·외삽) → GR(메타: 60일만료·VAT·기간정의) → 합계 + missing_info

## 7. 검증
- 12 시나리오(`output/S01~S12.json`) 재현 + 613 회귀(`regression_results.json`)와 가격 대조.
- 단, 검증 정답지는 613 스키마이므로, 의약품 등 2026 항목 중심으로 회귀(2025 복원분은 신규라 회귀 대상 외).
