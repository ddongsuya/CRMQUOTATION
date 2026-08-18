# chemon-quotation (CRMQUOTATION)

코아스템켐온 비임상 시험 **견적 산출 + CRM** 웹앱. 모달리티·투여경로·시험기간을 입력하면 견적 항목과 단가를 자동 산출하고, 고객사·딜·계약·시험 이력을 함께 관리한다.

**스택** — Next.js 14 (App Router) · TypeScript (strict) · Prisma + Neon PostgreSQL · Tailwind CSS · NextAuth

## 빠른 시작

```bash
npm install                  # postinstall 로 prisma generate 가 자동 실행됨
cp .env.example .env         # 값을 실제 Neon 접속 정보로 채운다
npx prisma generate          # 위 postinstall 이 돌았다면 생략 가능
npx prisma db push           # 스키마를 DB 에 반영
npx prisma db seed           # 초기 데이터 시드
npm run dev                  # http://localhost:3000
```

> ⚠️ **`prisma migrate dev` 를 실행하지 말 것.**
> 이 프로젝트의 DB 는 Prisma Migrate 관리 밖에 있다(`_prisma_migrations` 테이블 없음, `prisma/migrations/` 폴더 없음).
> `migrate dev` 를 실행하면 드리프트로 판정되어 **DB 리셋을 제안**한다. `.env` 가 운영 Neon 을 가리키는 상태라면 데이터가 소실될 수 있다.
> 스키마 반영은 항상 `npx prisma db push` 를 쓴다.

`.env` 에 필요한 값은 `.env.example` 에 주석과 함께 정리돼 있다 (`DATABASE_URL` · `NEXTAUTH_SECRET` · `NEXTAUTH_URL`).
`DATABASE_URL` 은 `prisma/schema.prisma` 의 `provider = "postgresql"` 때문에 반드시 `postgresql://` 스킴이어야 한다.

## 주요 스크립트

`package.json` 에 정의된 것 전부.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 (:3000) |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run lint` | `next lint` (※ eslint 설정 파일은 저장소에 없음) |
| `npm test` | 견적 엔진 + lib 전체 테스트 |
| `npm run test:regression` | 회귀 4종 (catalog-integrity · assemble · suggest-api · rule-coverage) |
| `npm run test:rules` | `rules_catalog.yaml` 구조 검사 |
| `npm run test:snapshots:update` | 회귀 스냅샷 갱신 — 가격·룰을 **의도적으로** 바꿨을 때만 |
| `npm run prisma:generate` | `prisma generate` |
| `npm run prisma:push` | `prisma db push` — 스키마 반영 |
| `npm run db:seed` | `prisma db seed` (`ts-node prisma/seed.ts`) |
| `npm run data:build` | `extract` → `presets` → `backfill:all` 일괄 실행 |
| `npm run extract` | `마스터_가이드라인_매핑.xlsx` → `data/*.json` 추출 |
| `npm run presets` | 모달리티 프리셋 생성 |
| `npm run backfill:prices` / `:detail` / `:study-weeks` | 가격 · 상세 · 투여주차 백필 |
| `npm run backfill:all` | 위 백필 3종 순차 실행 |

## 프로젝트 구조

```
src/app/            App Router — 화면 27개, API 라우트 62개
  api/crm/*           고객사·연락처·딜·계약·시험·노트·이벤트
  api/admin/*         관리자 (대시보드·리포트·타깃·멤버·검색·엑셀 업로드)
  api/quote/*         견적 v1 계산
  api/quote-v2/*      견적 v2 (룰 엔진)
  api/quote-efficacy/*  효력시험 견적
src/engine/*.js     레거시 견적 엔진 (JS)
src/lib/quote-engine/*.ts   신규 룰 엔진 (TS)
src/lib/efficacy-engine/    효력시험 엔진 (모델 110종)
src/lib/            공통 유틸 (prisma · auth · suggest · knowledge · store · quote-number 등)
src/components/     UI 컴포넌트 (admin/ 하위가 가장 큼)
prisma/schema.prisma   모델 19개 (User · Company · Contact · Deal · Contract · Quote · Study · Note 등)
data/               마스터 데이터 + 룰 카탈로그 + 가이드라인 원문
scripts/            추출 · 백필 · 검증 스크립트 29개
docs/               설계 · 룰 · 회귀 문서
```

### 견적 엔진이 두 벌 공존한다

가격 로직을 고치기 전에 **어느 쪽을 고치는지 먼저 확인해야 한다.** 한쪽만 바꾸면 다른 경로의 견적 결과가 달라진다.

| 엔진 | 언어 | 호출하는 라우트 |
| --- | --- | --- |
| `src/engine/` (`assemble` · `pricing` · `policy`) | JS | `api/quotes`, `api/quote/calculate`, `quote/new` |
| `src/lib/quote-engine/` (`engine` · `compose` · `pricing` · `rules` · `master` · `ordering`) | TS | `api/quote-v2`, `quote-v2/save`, `quote-v2/details` |

룰 카탈로그의 **단일 진실 원천은 `data/rules_catalog.yaml`** 이다(룰 33개). 코드에 룰을 새로 인라인하지 말고 카탈로그를 먼저 고친다.

### 데이터 파일

| 파일 | 건수 |
| --- | --- |
| `data/test_items.json` | 449 |
| `data/master_items.v2.json` (`items`) | 446 |
| `data/test_mappings.json` | 972 |
| `data/guideline_blocks.json` | 51 |
| `data/modality_presets.json` | 31 |
| `data/rules_catalog.yaml` | 룰 33 |

## 테스트

```bash
npm test              # 전체 (node --test 기반)
npm run test:regression
```

`npm test` 실측: **115개 중 105 pass / 10 skip / 0 fail**.

skip 되는 10개는 `regression-suggest-api` 테스트로, **dev 서버가 떠 있어야** 실제로 실행된다. 서버가 없으면 실패가 아니라 skip 으로 처리된다. 전부 돌려보려면 터미널을 둘로 나눈다.

```bash
# 터미널 1
npm run dev
# 터미널 2
npm run test:regression
```

프레임워크는 `node:test` + `node:assert/strict` + `fast-check`(property-based).

## 경로 그룹 규칙 (확정)

| 그룹     | 경로                               | 가격 정책            |
| -------- | ---------------------------------- | -------------------- |
| A        | 경구, 피하, 근육                   | 그룹 내 동일 가격    |
| B        | 정맥, 경피, 복강                   | 그룹 내 동일 가격    |
| SPECIAL  | 도포, 뇌내, 안구점적, 구강점막, 피내 | **경로별 별도 가격** |
| NONE     | in vitro, 협의, 공백               | 경로 무관            |

원본에서 `피하/근육` / `정맥/복강` 으로 표기된 행은 각각 두 개의 별도 행으로 복제됨.

## 문서

| 문서 | 내용 |
| --- | --- |
| `docs/quote-engine-binding.md` | 룰 카탈로그를 마스터 데이터에 바인딩하는 매핑 정의. **가격 로직 수정 시 필독** |
| `docs/RULES.md` | 룰 카탈로그 v1.1 구조 — 룰 33개와 status 4종(`draft`/`draft_audit`/`approved`/`deprecated`) |
| `docs/REGRESSION.md` | 회귀 검증 시나리오와 스냅샷 운영법 |
| `docs/CRM_확장_설계.md` | CRM 확장 설계서. **상태: draft — 코드 미반영 부분 있음** |
| `docs/관리자_대시보드_RECONCILE_리포트.md` | 관리자 대시보드 설계 대조·조정 리포트 (Phase 0~1 기준) |
| `docs/고객관리_개인기록_업로드양식.xlsx` | 고객 개인기록 업로드 엑셀 양식 |

`CLAUDE.md` 는 Claude Code 작업용 상시 규칙 파일이다. 사람이 프로젝트를 파악할 때는 이 README 와 `docs/` 를 본다.
