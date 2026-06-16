# 회귀 검증 (Regression Testing)

**Phase B 산출물** — 견적 자동 생성 로직이 의도치 않게 변하는 것을 자동 감지.

---

## 무엇을 검증하나

| 테스트 파일 | 검증 대상 | 메커니즘 |
|---|---|---|
| `catalog-integrity.test.js` | `test_items.json` 데이터 품질 | 필수 필드·가격 sanity·key 고유성 등 14개 검사 |
| `regression-assemble.test.js` | `engine/assemble.js` + `pricing.js` 가격·라인 산출 | 8개 시나리오 × 스냅샷 비교 |
| `regression-suggest-api.test.js` | `suggest.ts` 시험 자동 제안 | 6개 시나리오 × API 호출 + 스냅샷 (dev 서버 필요, 없으면 skip) |
| `rule-coverage.test.js` | 룰 카탈로그 33개 × 코드 구현 매핑 | COVERAGE 맵 정합성 + 분포 리포트 |
| `rules-catalog.test.js` | `rules_catalog.yaml` 구조 (Phase A) | YAML 정합성 10개 검사 |

---

## 실행

```bash
# 회귀 검증 4종 (catalog-integrity + assemble + suggest-api + rule-coverage)
npm run test:regression

# 전체 테스트 (engine + lib)
npm test

# 룰 카탈로그만
npm run test:rules

# suggest API 시나리오까지 실제로 검증하려면 dev 서버를 먼저 띄울 것
npm run dev          # 터미널 1
npm run test:regression   # 터미널 2
```

---

## 스냅샷 (Snapshot)

`regression-assemble` / `regression-suggest-api` 는 **스냅샷 기반**입니다.

- 최초 실행 시: `src/lib/__tests__/__snapshots__/regression-*.json` 자동 생성
- 이후 실행 시: 현재 산출 결과를 스냅샷과 deep-equal 비교
- 차이 발생 → 테스트 fail (어느 시나리오의 어느 가격/라인이 변했는지 표시)

### 의도된 변경일 때 스냅샷 갱신

```bash
npm run test:snapshots:update
```

⚠️ **주의**: 가격·룰을 의도적으로 바꿨을 때만 실행. 의도치 않은 변경이 있는데 갱신하면 회귀를 묻어버립니다. 갱신 후 `git diff src/lib/__tests__/__snapshots__/` 로 변경 내용을 반드시 확인하세요.

---

## 시나리오 (regression-assemble)

| ID | 시나리오 | 검증 포인트 |
|---|---|---|
| SC01 | 13주 반복투여 1건 (베이스라인) | 단일 항목 + 함량분석 자동 |
| SC02 | 단회+4주DRF+13주본+13주TK | 함량분석 다중 합산 |
| SC03 | 회복군만 | warning: 상위 본시험 미선택 |
| SC04 | TK만 | warning: 동일 기간 본시험 미선택 |
| SC05 | 복합제 priceTiers (excipientCount=3) | tier 가격 선택 |
| SC06 | 13주 본+회복+TK 정상 패키지 | warning 없음 |
| SC07 | 할인 10% + USD 환산 | 통화·할인 계산 |
| SC08 | OECD 가격 | priceStandard 분기 |

## 시나리오 (regression-suggest-api)

| ID | 모달리티 | 검증 포인트 |
|---|---|---|
| API01 | 합성신약 | IND 풀패키지 제안 |
| API02 | 건강기능식품 | 단회+13주+유전독성 |
| API03 | 백신 | 4주(3회) + 면역원성 |
| API04 | 화장품 | 카테고리 모드 |
| API05 | 의료기기 ISO10993 | 카테고리 모드 |
| API06 | 합성신약 (excipientCount=3) | 복합제 tier |

---

## 발견된 이슈 (Findings)

### ✅ F-1: `studyWeeks` 필드 의미 — **수정 완료 (2026-05)**

**문제**: `test_items.json` 의 `studyWeeks` 값이 시험 기간이 아니라 **견적 진행 기간**(보고서 작성 ~4주 포함)을 담고 있었음. 예: "설치류 1주 DRF" → `studyWeeks=5`.

**영향 (수정 전)**:
- `assemble.js`의 `hamryangCountForWeeks(studyWeeks)`가 13주 본시험을 7회로 잘못 산출 (정상 2회)
- `suggest.ts`의 TK/DRF 기간 매칭에 잘못된 값 사용

**수정 — `scripts/backfill-study-weeks.js`**:
- `studyWeeks` ← testName 파싱한 **실제 시험 투여 주차** (1주→1, 단회→0)
- `quoteWeeks` ← 기존 `studyWeeks` 값 보존 (견적서 "기간(주)" 표시용 — 보고서 4주 포함, 정당한 데이터)
- 비정형(임신 N-day, 감작 등 141건) → `studyWeeks = null` → **사용자가 견적 UI 에서 직접 입력** (설계 원칙: 자동 정형화 불가 케이스는 추측 X, 사용자 override 가능하게)
- 멱등(idempotent): quoteWeeks 보존 로직으로 재실행 안전

**수정 결과** (회귀 스냅샷이 정확히 캡처):
| 시나리오 | 함량분석 회수 (전 → 후) | 검증 |
|---|---|---|
| SC01 13주 본시험 1건 | 7회 → **2회** | 회사 합의 룰 (13주=2회) |
| SC02 13주본+4주DRF+13주TK | 17회 → **6회** (2+2+2) | 정상 |
| SC04 13주 TK만 | warning "35주" → **"13주"** | 매칭 정상화 |
| SC06 13주본+회복+TK | 15회 → **4회** (2+2) | 정상 |

`catalog-integrity.test.js` 의 mismatch 검사가 **100건 → 0건** 으로 strict assertion 통과.

**파이프라인 통합**: `npm run data:build` 에 backfill 4종(prices/detail/study-weeks) 자동 실행.

---

### ✅ F-2: 회복군의 `parentTest` 매칭 — **수정 완료 (2026-05)**

**문제**: `assemble.js`의 `isParentSelected`가 strict equality. 데이터 불일치:
- 회복군: `parentTest = "13주 반복투여독성"`
- 본시험: `testName = "설치류 13주 반복투여 독성"` (종 접두사 + 띄어쓰기 차이)

→ 정상 패키지에서도 "상위 본시험 미선택" warning 발생.

**수정 — `assemble.js`의 `isParentSelected` + `normalizeTestName`**:
- 공백 제거 + "설치류"/"비설치류" 접두사 제거 후 양방향 substring 매칭
- 예: `"13주 반복투여독성"` ↔ `"설치류 13주 반복투여 독성"` → 정상 매칭
- false positive 방지: "4주 DRF" ↔ "13주 반복투여독성" 등 핵심어 다른 케이스는 매칭 안 됨

**검증**:
- 단위 테스트 3개 추가 (`assemble.test.js`): normalizeTestName 동작, isParentSelected 매칭, 정상 패키지 warning 없음
- 회귀 스냅샷: SC06 (본+회복+TK 패키지)의 회복군 warning이 사라짐. 다른 7개 시나리오는 영향 없음 (SC03 "회복군만"은 여전히 warning ✓ — false positive 없음).

---

## 룰 커버리지 현황 (rule-coverage)

`rules_catalog.yaml` 의 33개 룰이 현재 코드에 얼마나 구현됐는지:

| 상태 | 개수 | 비율 |
|---|---:|---:|
| `not_implemented` | 23 | 69.7% |
| `data_only` | 4 | 12.1% |
| `partial` | 4 | 12.1% |
| `implemented_in_code` | 2 | 6.1% |

- **implemented_in_code (2)**: GR-001 (60일 유효), GR-002 (VAT 별도) — `engine/pricing.js`
- **data_only (4)**: PF-002·PF-003 (복합제 priceTiers), PR-003 (RhE/RhCE 데이터), GR-003 (기간 정의)
- **partial (4)**: CG-003 (의료기기 아급성/아만성 — 수동 선택), WV-001 (광독성 — 수동 토글), SB-002 (MLA 카테고리), AD-006 (회복군·TK)
- **not_implemented (23)**: Phase C 의 작업 대상

### Phase C 시급 후보 (high-confidence + 단가 명시 + not_implemented)

1. **PF-001** — 비설치류 채혈만 진행 가격 공식 (채혈 pt × 30,000 + 5,000,000원)
2. **AD-001** — 유전독성 복귀돌연변이 재현시험 (+2,000,000원)
3. **AD-003** — 화장품 유전독성 양성판정 재현시험 (+2,000,000원)
4. **AD-010** — SEND 타기관 raw data review (단회 1,000,000 / 반복 2,000,000원)

이 4개는 단가가 명확하므로 코드化 즉시 가치 발생.

---

## CI 통합 (권장)

```yaml
# .github/workflows/test.yml 예시
- run: npm ci
- run: npm test            # 전체 (suggest-api 는 서버 없어 skip)
```

룰/데이터/코드 변경 PR 마다 `npm test` 가 스냅샷 회귀를 자동 감지합니다.

---

## 다음 (Phase C)

`suggest.ts`·`assemble.js` 의 인라인 룰을 `rules_catalog.yaml` 호출로 점진 외부화 + `not_implemented` 23개 룰을 우선순위대로 구현. `rule-coverage.test.js` 의 COVERAGE 맵이 진행 상황 추적 지표.
