# 운영 가이드 — 안전망

2026-09 종합 검토 로드맵 1주차에서 도입한 안전망 4가지와, 사람이 직접 해야 하는 설정.

## 1. 관리자 권한 검사

- `src/lib/admin/guard.ts`
  - `requireAdmin()` — 실제 계정 role 기준(ADMIN·CENTER_LEAD·TEAM_LEAD·레거시 admin). 쓰기 라우트 첫 줄.
  - `adminReadScope()` — 드로어·검색 같은 읽기 라우트용. 관리자 뷰면 전사, 아니면 본인 소유만.
- `src/lib/admin.ts` `getAdmin()` — 지식 데이터(test-items·knowledge·템플릿) 편집 라우트. 이전엔 무조건 관리자로 취급하던 스텁이었고 이제 실제 role 을 본다.
- 데모 계정(임정모)은 role `admin` 이므로 현재 사용에는 변화가 없다. 인증(C1)을 켜면 `currentUserId()` 만 세션 기반으로 바꾸면 된다.

## 2. CI (`.github/workflows/ci.yml`)

push(main)·PR 마다 lint → 단위 테스트 → 회귀 테스트 → 타입 검사 → `next build` → 마이그레이션 드리프트 검사.

**Vercel 배포 차단(사람이 할 일)**: GitHub 의 required status check 를 켜면 main 직접 push 도 막히므로, 현재 "main 에 push → 바로 배포" 흐름을 유지하려면 다음 중 하나를 고른다.
1. 그대로 두고 CI 실패 메일을 신호로 삼는다(지금 상태).
2. GitHub Actions 에서 CI 통과 후 `vercel deploy --prod` 를 실행하도록 바꾼다. `VERCEL_TOKEN`·`VERCEL_ORG_ID`·`VERCEL_PROJECT_ID` 시크릿이 필요하고, Vercel 의 Git 자동 배포는 꺼야 한다.
3. 작업 브랜치 + PR 흐름으로 바꾸고 main 에 required check 를 건다.

## 3. 스키마 마이그레이션 (db push → migrate)

- `prisma/migrations/0_init/` — 2026-09-02 시점 Neon prod 스키마의 baseline. prod 에는 `prisma migrate resolve --applied 0_init` 로 "이미 적용됨" 표시를 해 두었다.
- 이후 스키마 변경 절차:
  ```bash
  # 1) dev 브랜치 DB 를 가리키는 .env (아래 §Neon 브랜치) 에서
  npx prisma migrate dev --name <변경요약>
  # 2) 커밋 → push → Vercel 빌드가 vercel-build 스크립트로 `prisma migrate deploy` 를 먼저 실행
  ```
- **`prisma db push` 는 더 이상 쓰지 않는다.** (drift 검사가 CI 에서 잡는다.)
- 과거 규칙 "migrate dev 금지" 는 로컬이 prod DB 에 직결돼 있던 상태의 규칙이다. dev 브랜치 분리 후에는 migrate dev 가 정석.

### Neon 브랜치 분리(사람이 할 일, 5분)
1. Neon 콘솔 → 프로젝트 → Branches → `Create branch` → 이름 `dev`, parent `main`(데이터 포함 복제).
2. `dev` 브랜치의 connection string 을 로컬 `.env` 의 `DATABASE_URL` 로 교체.
3. Vercel 환경변수의 `DATABASE_URL` 은 prod(main 브랜치) 그대로.
4. 이후 로컬 실수는 dev 브랜치에만 영향. 필요하면 콘솔에서 dev 브랜치를 main 으로 reset.

### 백업 복원 리허설(분기 1회)
Neon 콘솔 → Branches → `Restore` 로 특정 시점(PITR)을 새 브랜치로 복원 → 앱을 그 브랜치에 붙여 화면이 뜨는지 확인. 복원해 본 적 없는 백업은 백업이 아니다.

## 4. 오류 모니터링 (Sentry)

- 설치됨: `@sentry/nextjs`. 파일: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/lib/api-handler.ts`.
- **DSN 이 없으면 완전히 비활성**(아무것도 보내지 않음). 켜려면(사람이 할 일):
  1. sentry.io 무료 계정 → 프로젝트(Next.js) 생성 → DSN 복사.
  2. Vercel 환경변수 `NEXT_PUBLIC_SENTRY_DSN` 에 붙여넣기(Production·Preview). 로컬 `.env` 에도 원하면.
  3. (선택) 소스맵 업로드: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` 환경변수. 없으면 빌드 시 업로드만 건너뛴다.
- 개인정보: `sendDefaultPii: false`, 세션 리플레이 꺼짐. 고객 담당자 연락처가 전송되지 않도록 유지한다.
- API 라우트는 전부 `withErrorHandling` 으로 감싸져 있다. 예외 → `console.error` + Sentry + 한국어 JSON 오류(`{error, code, retryable}`). Prisma P2025→404, P2002/P2003→409, P2028·연결 실패→503.

## 점검 명령

```bash
npm run lint && npm test && npm run test:regression && npx tsc --noEmit
```
