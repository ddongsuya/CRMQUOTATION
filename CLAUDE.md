# CLAUDE.md — chemon-quotation (CRMQUOTATION)

코아스템켐온 비임상 견적 + CRM 웹앱. Next.js 14 App Router · TypeScript · Prisma/PostgreSQL(Neon).

<!-- 작성 2026-08-18. 저장소 실측 기준(HEAD 8fd8ddb, 2026-08-12). 추측으로 채운 값 없음. -->

## 절대 규칙

- **스키마 변경은 Prisma Migrate 로만 한다 (2026-09-02 baseline 도입).** `prisma db push` 금지. 절차: `npm run db:migrate:new -- <이름>`(현재 DB↔schema 차이를 `prisma/migrations/<ts>_<이름>/migration.sql` 로 생성) → 내용 검토 → `npm run db:deploy`. Vercel 은 `vercel-build` 가 `migrate deploy` 를 먼저 실행한다. `prisma migrate dev` 는 Neon 에 shadow DB 가 없어 실패하므로 쓰지 않는다. `--accept-data-loss` / `--force-reset` 플래그는 절대 금지. 로컬 `.env` 는 Neon dev 브랜치를 가리켜야 한다(`docs/OPERATIONS.md` §3).
- **OECD 가격이 비어 있을 때 MFDS 가격으로 자동 폴백하지 않는다.** `missing_info`를 발생시켜 사용자에게 되묻는다. (`docs/quote-engine-binding.md` §5)
- **정형화 불가 데이터를 추측으로 채우지 않는다.** `studyWeeks = null`(비정형 141건)은 UI에서 사용자가 직접 입력한다. (`docs/REGRESSION.md` F-1)
- **회귀 스냅샷을 습관적으로 갱신하지 않는다.** `npm run test:snapshots:update`는 가격·룰을 *의도적으로* 바꿨을 때만. 갱신 후 반드시 `git diff src/lib/__tests__/__snapshots__/` 확인.
- `.env`, `prisma/dev.db`는 절대 커밋하지 않는다 (`.gitignore`에 등재됨).
- 룰 카탈로그의 단일 진실 원천은 **`data/rules_catalog.yaml`** 이다. 코드에 룰을 새로 인라인하지 말고 카탈로그를 먼저 고친다.
- 가격·룰·데이터를 건드린 변경은 **`npm test` 통과 없이 커밋하지 않는다.**

## 빌드 · 테스트 명령

```bash
npm run dev                  # 개발 서버 :3000
npm run build                # 프로덕션 빌드
npm run lint                 # next lint  (※ eslint 설정 파일이 저장소에 없음)
npm test                     # engine + lib 전체 (실측: 115개 중 105 pass / 10 skip / 0 fail)
npm run test:regression      # 회귀 4종 (catalog-integrity, assemble, suggest-api, rule-coverage)
npm run test:rules           # rules_catalog.yaml 구조 검사
npm run test:snapshots:update  # 스냅샷 갱신 — 위 '절대 규칙' 참조
npm run data:build           # extract → presets → backfill(prices/detail/study-weeks)
npm run prisma:generate      # = prisma generate (postinstall 에도 걸려 있음)
npm run db:migrate:new -- <이름>   # 스키마 변경 → migration.sql 생성 (docs/OPERATIONS.md §3)
npm run db:deploy            # prisma migrate deploy — 로컬(dev 브랜치)·Vercel(vercel-build) 공통
npm run typecheck            # tsc --noEmit (CI 와 동일)
npm run db:seed              # ts-node prisma/seed.ts
```

- `test:regression`의 `regression-suggest-api`는 **dev 서버가 떠 있어야** 실제로 돈다. 없으면 skip 처리된다(터미널1 `npm run dev`, 터미널2 테스트).
- 테스트는 `node --test` 기반. 프레임워크는 `node:test` + `node:assert/strict` + `fast-check`(property-based).

## 프로젝트 구조

```
src/app/            Next.js App Router. 화면 + /api 라우트 (route.ts 62개)
  api/crm/*         CRM 운영 데이터 (companies·contacts·deals·contracts·studies·notes·events)
  api/admin/*       관리자 (detail·members·prospects·quotes·reports·search·targets)
                    ※ import 는 하위 중첩: prospects/import, quotes/import, reports/import
                    ※ /admin/analytics 는 화면만 존재. 동명의 API 라우트는 없음
  api/quote/*       견적 v1 계산
  api/quote-v2/*    견적 v2 (룰 엔진)
  api/quote-efficacy/*  효력시험 견적
src/engine/*.js     레거시 견적 엔진 (JS). assemble.js · pricing.js · policy.js
src/lib/quote-engine/*.ts  신규 룰 엔진 (TS). engine · compose · pricing · rules · master · ordering
src/lib/efficacy-engine/   효력시험 엔진 (110 모델)
src/lib/            공통 유틸 (prisma·auth·suggest·knowledge·store·quote-number 등)
src/components/     UI. admin/ 하위가 가장 큼
prisma/schema.prisma  19개 모델 (User·Company·Contact·Deal·Contract·Quote·Study·Note 등)
data/               마스터 데이터 JSON/YAML + 가이드라인 원문
scripts/            추출·백필·검증 스크립트 (29개)
docs/               설계·룰·회귀 문서
```

### 엔진이 두 벌 공존한다 — 어느 쪽을 고치는지 먼저 확인할 것

| 엔진 | 언어 | 호출하는 라우트 |
|---|---|---|
| `src/engine/` | JS | `api/quotes`, `api/quote/calculate`, `quote/new` 화면의 policy |
| `src/lib/quote-engine/` | TS | `api/quote-v2`, `api/quote-v2/save`, `api/quote-v2/details` |

한쪽만 고치면 다른 경로의 견적 결과가 달라진다. 가격 로직 변경 시 **양쪽 영향 범위를 먼저 확인**한다.

## 코딩 컨벤션 (실측)

- 들여쓰기 **2-space**, 문자열 **싱글 쿼트**, 세미콜론 **사용**
- 경로 별칭 `@/*` → `src/*` (tsconfig `paths`)
- TypeScript `strict: true`, `noEmit: true`
- 클라이언트 컴포넌트는 `'use client'` 명시 (약 60개 파일). Server Actions는 현재 미사용
- **주석은 한국어**로, "왜 이렇게 했는지"를 적는다. 기존 코드가 이 패턴을 따른다 — 예: `quote-number.ts`의 count+1 → max+1 변경 이유 주석
- 입력 검증은 `zod` (현재 2개 파일에서만 사용)

## 커밋 컨벤션 (최근 30개 커밋 실측)

```
<type>(<scope>): <한국어 설명>
```

- type: `feat` · `fix` · `refactor` (최근 30개 기준 fix 14 / feat 5 / refactor 2)
- scope 예: `admin` `crm` `efficacy` `save` `status` `mobile` `integrity` `currency` `aggregate` `import` `company-match` `quote-number`
- 예: `fix(quote-number): 채번을 count+1 → max+1 로, 저장을 unique 충돌 재시도로`

## 도메인 용어

| 용어 | 의미 |
|---|---|
| 경로그룹 | 투여경로 묶음. A(경구·피하·근육) / B(정맥·경피·복강) 그룹 내 동일 가격, SPECIAL(도포·뇌내·안구점적·구강점막·피내)은 경로별 별도 가격 |
| 단일가 폴백 | `정맥경피` 가격이 비면 `경구피하근육` 가격을 쓰되, **표시 라벨은 사용자가 고른 경로 그대로** |
| 모달리티 | 견적 대상 제품군 (의약품·복합제·스크리닝·의료기기·SEND·CTD·번역 등) |
| TK | 독성동태 (Toxicokinetics). `tkMode == "채혈만"` 분기 존재 |
| DRF | 용량설정시험 (Dose Range Finding) |
| 함량분석 | 시험 기간에 따라 회수가 결정되는 부속 항목. 13주 본시험 = 2회 (회사 합의 룰) |
| `studyWeeks` / `quoteWeeks` | 실제 투여 주차 / 견적서 표시용 기간(보고서 4주 포함). **의미가 다르므로 혼동 금지** |
| missing_info | 자동 결정 불가 → 사용자 확인이 필요한 항목 |
| SoT | Single source of Truth |
| 룰 타입 7종 | PF(가격공식) PR(선행) CG(조건부군) AD(추가옵션) WV(면제) SB(대체) GR(메타) — 총 33개 |
| 8단계 파이프라인 | filter → select → WV → SB → CG → PR → AD → PF → GR → 합계 + missing_info |

## 현재 상태 (착수 전 확인용)

- **룰 커버리지 (COVERAGE 맵 실측, 33개):** `implemented_in_code` 6 (PF-001·AD-001·AD-003·AD-010·GR-001·GR-002) / `partial` 4 (CG-003·AD-006·WV-001·SB-002) / `data_only` 4 (PF-002·PF-003·PR-003·GR-003) / **`not_implemented` 19**
- **룰 승인 상태:** 33개 전부 미검토. `draft` 19 + `draft_audit` 14, `approved` **0개**. 즉 어떤 룰도 아직 센터장·팀장 승인을 받지 않았다 (`docs/RULES.md`).
- 진행 지표의 진실 원천은 **`src/lib/__tests__/rule-coverage.test.js`의 COVERAGE 맵**이다. `docs/REGRESSION.md`의 커버리지 표는 낡았다(구버전 수치) — 문서가 아니라 이 파일을 볼 것.

## 저장소에서 확인된 불일치 — 손대기 전에 확인 필요

1. ~~**DB 프로바이더 불일치**~~ — **2026-08-18 해결.** `.env.example`이 SQLite(`file:./dev.db`)로 되어 있어 그대로 복사하면 Prisma가 실패했다. PostgreSQL(Neon) 형식으로 교체했다(커밋 b2a079b). 실제 개발·운영 DB는 Neon PostgreSQL이다.
2. ~~**스키마 반영 방식 = `prisma db push`**~~ — **2026-09-02 해결.** `prisma/migrations/0_init` baseline 을 만들고 prod 에 `migrate resolve --applied` 로 표시했다. 이후는 `db:migrate:new` → `db:deploy`. CI 가 Postgres 컨테이너에서 `migrate deploy` 후 드리프트 0 을 검사한다.
3. ~~**README.md가 낡음**~~ — **2026-08-18 해결.** "다음 단계: pnpm init → Next.js 스캐폴딩"이라는 미착수 로드맵이 남아 있어 프로젝트 상태를 오해하게 했다. 현행 구현 기준으로 전면 재작성했다(커밋 ee297fd). 데이터 건수도 실측값으로 교정(test_items 429 → 449).
4. ~~**eslint 설정 파일 부재**~~ — **2026-09-02 해결.** `.eslintrc.json`(next/core-web-vitals + next/typescript). CI(`.github/workflows/ci.yml`)가 lint·test·typecheck·build 를 실행한다.
5. **`docs/REGRESSION.md`의 룰 커버리지 표가 낡음**: `implemented 2 / not_implemented 23`으로 적혀 있으나 실제 COVERAGE 맵은 `6 / 19`다. 커버리지는 문서가 아니라 `rule-coverage.test.js`를 기준으로 판단할 것.

## 참고 문서

- `docs/quote-engine-binding.md` — 가격 결정·필드 매핑·8단계 파이프라인 (가격 로직 수정 시 필독)
- `docs/REGRESSION.md` — 회귀 테스트 시나리오 SC01~SC08 / API01~API06, 스냅샷 운영법
- `docs/RULES.md` — 룰 카탈로그 33개 구조와 status 4종(`draft` / `draft_audit` / `approved` / `deprecated`)
- `docs/CRM_확장_설계.md` — CRM 데이터 모델·권한(MEMBER/TEAM_LEAD/CENTER_LEAD/ADMIN). **상태: draft, 코드 미반영 부분 있음**
