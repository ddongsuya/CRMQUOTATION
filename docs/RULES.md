# 견적 룰 카탈로그 (Rules Catalog)

**버전**: v1.1 (2026-05-14 추가 보강)
**위치**: `data/rules_catalog.yaml` (단일 진실 원천 — SoT)
**관련**: `data/review_questions.yaml` (22개 검토용 메타 질문)

---

## 무엇인가?

2026년 표준견적서 14개 파일을 분석하여 추출한 **33개의 운영 룰**을 7개 타입으로 분류·구조화한 카탈로그입니다.

기존 `src/lib/suggest.ts` / `src/engine/assemble.js` 안에 인라인으로 작성된 룰을 점진적으로 **외부 YAML 카탈로그**로 옮기는 것이 목표 — 비개발자(센터장·팀장·BD)가 코드를 안 보고 룰을 검토·승인·폐기할 수 있게 합니다.

---

## 룰 타입 (7종)

| 약자 | 영문 | 한국어 | 개수 |
|---|---|---|---:|
| **PF** | PricingFormula | 가격 산출 공식 | 3 |
| **PR** | PrerequisiteRule | 선행 시험·자료·검수 | 8 |
| **CG** | ConditionalGroup | 조건부 군 구성·관찰 변경 | 4 |
| **AD** | Addon | 추가 옵션 항목 | 11 |
| **WV** | WaiverRule | 면제 조건 | 1 |
| **SB** | SubstitutionRule | 시험 대체 | 3 |
| **GR** | GenericRule | 시스템 메타룰 (v1.1 신규) | 3 |
| | | **합계** | **33** |

---

## 룰 상태 (Status)

| 값 | 의미 | 처리 |
|---|---|---|
| `draft` | v1.0 초기 추출, 미검토 (19개) | 보존 — 검토 후 approved 전환 |
| `draft_audit` | v1.1 보강 추출, 미검토 (14개) | 영업 검증 우선순위 높음 |
| `approved` | 센터장·팀장 검토 승인 (0개) | `effective_date` 부여, 운영 적용 |
| `deprecated` | 폐기 (0개) | `deprecation_reason` 기입 |

---

## 사용법 (코드)

```typescript
import {
  loadRulesCatalog,
  flattenAllRules,
  findRuleById,
  getRulesSummary,
} from '@/lib/rules-catalog';

// 1. 전체 카탈로그 로드 (메모리 캐시)
const catalog = loadRulesCatalog();
console.log(catalog.catalog_meta.version);   // "1.1"

// 2. 모든 룰 평탄화 (v1.0 + v1.1 audit 통합)
const all = flattenAllRules();
console.log(`총 ${all.length}개 룰`);

// 3. 특정 룰 조회
const wv = findRuleById('WV-001');
console.log(wv.description_ko);
// "광독성·광감작성 시험 — 시험물질이 자외부(280~480nm)에서 흡수가 없으면 면제"

// 4. 요약 통계
const summary = getRulesSummary();
// { total: 33, by_type: { Addon: 11, ... }, by_status: { draft: 19, draft_audit: 14 } }
```

```typescript
import { getReviewQuestionsByPriority, getUnansweredQuestions } from '@/lib/rules-catalog';

const p0 = getReviewQuestionsByPriority('필수 (P0)');   // 3개
const unanswered = getUnansweredQuestions();           // 22개 (현재 전부)
```

---

## HTTP API

### `GET /api/rules`
전체 룰 목록 + 평탄화. 쿼리 파라미터:
- `?type=PF` (또는 PR/CG/AD/WV/SB/GR) — 타입 필터
- `?status=draft_audit` — 상태 필터
- `?confidence=low` — confidence 필터
- `?summary=1` — 요약 통계만 반환

예: `GET /api/rules?type=AD&status=draft_audit` → v1.1 보강된 Addon 룰 3개 반환

### `GET /api/rules/:id`
특정 룰 1개 조회. 예: `/api/rules/PF-001`

### `GET /api/review-questions`
22개 메타 질문. 쿼리:
- `?priority=P0` (P0/P1/P2) — 우선순위 필터
- `?unanswered=1` — 미답변 질문만
- `?summary=1` — 메타데이터만

---

## 데이터 흐름

```
─────────────── SoT (YAML) ───────────────
  data/rules_catalog.yaml      (33 rules)
  data/review_questions.yaml   (22 questions)
                ↓
       loadRulesCatalog()
       loadReviewQuestions()
                ↓ (메모리 캐시, hot reload 통과)
─────────────── 사용처 ──────────────────────
  GET /api/rules                          ← UI 룰 명세 조회
  GET /api/review-questions               ← 검토 워크플로우
  (앞으로) suggest.ts 인라인 룰 → 카탈로그 호출로 점진 외부화
  (앞으로) regression test                ← 룰 변경 시 회귀 검증
```

**TestItem 데이터** (`data/test_items.json`) 는 별도 SoT (`scripts/extract_mapping.js` 가 생성). 본 카탈로그는 그 데이터에 *적용되는 룰* 만 정의합니다.

---

## 검토 워크플로우 (제안)

1. 비개발자(센터장·팀장)에게 `/api/review-questions?priority=P0` 결과 공유 (가장 시급한 3개)
2. 답변 받으면 `review_questions.yaml` 의 해당 질문에 `answer_summary` / `answered_by` / `answered_at` 기입
3. 답변이 새 룰을 생성하는 경우 `rules_catalog.yaml` 에 추가 (resulting_rule_id 부여)
4. 카탈로그 v1.2 으로 버전 bump → 회귀 테스트 재실행

---

## 테스트

```bash
# 카탈로그·로더·구조 검증 (10 tests)
npm run test:rules

# 전체 테스트
npm test
```

테스트 항목:
- YAML 파싱 가능
- 룰 총 33개 (v1.0=19 + v1.1=14)
- 모든 룰에 필수 메타데이터 (id/description_ko/status/confidence/source_quote/source_location)
- 룰 ID 고유성
- 22개 review_questions + priority 분포
- v1.1 audit 섹션 status = "draft_audit"
- v1.0 섹션 status = "draft"

---

## 룰 한눈에 보기 (33개)

### PF — 가격 산출 공식 (3)
- `PF-001` 비설치류 채혈만 진행 시 가격 = 채혈 포인트 × 30,000원 + 5,000,000원
- `PF-002` 복합제 조제물 분석 가격 = 10,000,000원 × 종 수 (v1.1)
- `PF-003` 복합제 함량 분석 가격 = 5,000,000원 × 종 수 (v1.1)

### PR — 선행 시험·자료·검수 (8)
- `PR-001` 마우스 발암성 → 4주 DRF + 13주 반복독성 자동 추가
- `PR-002` USFDA 제출 시 유전독성시험 추가 제안 (low confidence)
- `PR-003` Reconstructed Human Epidermis/Cornea 모델 4주 사전 주문 필요
- `PR-004` 소핵 시험 screening — 관련시험의 독성자료 (LD50) 제공 필요
- `PR-005` 시험 개시 prerequisites: 시험의뢰서 + 정보기록지 + CoA (v1.1)
- `PR-006` 의료기기 시험 개시: CoA 대신 기술문서 (v1.1)
- `PR-007` 시험물질 멸균 검수, 미생물 검출 시 반환 (v1.1)
- `PR-008` 영문보고서 prereq: 국문 완료 후 6-8주 + 신청서 (v1.1)

### CG — 조건부 군 구성·관찰 변경 (4)
- `CG-001` 비설치류 4주 반복투여 — 선행 자료 보유 시 시험군 4→3
- `CG-002` 생식독성 TK 태반이행 — 매일 투여 아닐 시 임신동물 3마리 추가
- `CG-003` 의료기기 인체 노출 기간 → 아급성/아만성 시험 자동 선택 (v1.1)
- `CG-004` 의료기기 이식시험 — 흡수성/비흡수성에 따라 부검 포인트 변경 (v1.1)

### AD — 추가 옵션 (11)
- `AD-001`~`AD-008` (v1.0): 유전독성 재현시험, 성호르몬 측정, 화장품 양성판정 재현, 독성 스크리닝 관심장기, 의료기기 확인시험, SEND 회복군·TK, 의료기기 관찰기간 연장, 영문보고서 요약본
- `AD-009` 번역보고서 추가 비용 (v1.1, 단가 미명시)
- `AD-010` SEND - 타기관 raw data review (v1.1, 단회 1M / 반복 2M)
- `AD-011` 영문보고서 첨부문서 번역 추가 (v1.1)

### WV — 면제 조건 (1)
- `WV-001` 광독성·광감작성 — 자외부(280~480nm) 흡수 없을 시 면제

### SB — 시험 대체 (3)
- `SB-001` 비설치류 카테터 경구투여는 정맥 가격 + 조제물분석 동반
- `SB-002` 의료기기 외국 봉합사 — 염색체이상 대신 MLA로 대체
- `SB-003` 복합제 조제물분석 — 개별→동시 분석 (가격 동일)

### GR — 시스템 메타룰 (3, v1.1 신규)
- `GR-001` 견적서 60일 유효 — 자동 만료
- `GR-002` 모든 가격 VAT 별도 — 자동 표기
- `GR-003` 시험기간 = 동물입고일 ~ 최종보고서(안) 제출일

---

## 다음 단계 (Phase B·C)

- **Phase B**: 기존 `test_items.json` + `suggest.ts` 사용한 regression test 작성 (룰 변경 시 가격 회귀 검증)
- **Phase C**: `suggest.ts`/`assemble.js` 의 인라인 룰을 카탈로그 호출로 점진 외부화 (예: WV-001 광독성 면제는 현재 코드에 없음 → 카탈로그 활용해 처음 도입)

---

## 트러블슈팅

**Q. YAML 변경 후 반영 안 됨**
- A. `lib/rules-catalog.ts` 가 메모리 캐시함. dev 서버 재시작 또는 `_resetRulesCache()` 호출.

**Q. 룰 추가하는데 ID 어떻게 부여?**
- A. 기존 시리즈 이어서 — PF-004, PR-009, AD-012, ... 그리고 `version: "1.0"`, `status: "draft_audit"` 또는 `"draft"` 명시.

**Q. 룰 폐기하려면?**
- A. 삭제 X — `status: "deprecated"` + `deprecated_at` + `deprecation_reason` 기입. 회귀 테스트가 이전 동작 추적 가능.
