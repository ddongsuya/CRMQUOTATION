# chemon-quotation

코아스템켐온 견적서 작성 모듈 — CRM 웹앱에 탑재.

## 현재 단계: 데이터 파이프라인 완료

```
prisma/schema.prisma        PostgreSQL 스키마 (TestItem, GuidelineBlock, Mapping, Preset, Quote, QuoteItem)
prisma/seed.ts              JSON → DB 시드
scripts/extract_mapping.js  마스터_가이드라인_매핑.xlsx → data/*.json
data/test_items.json        429 rows  (경로별 분할 완료)
data/guideline_blocks.json   51 rows
data/test_mappings.json     972 rows
```

## 경로 그룹 규칙 (확정)

| 그룹     | 경로                               | 가격 정책            |
| -------- | ---------------------------------- | -------------------- |
| A        | 경구, 피하, 근육                   | 그룹 내 동일 가격    |
| B        | 정맥, 경피, 복강                   | 그룹 내 동일 가격    |
| SPECIAL  | 도포, 뇌내, 안구점적, 구강점막, 피내 | **경로별 별도 가격** |
| NONE     | in vitro, 협의, 공백               | 경로 무관            |

원본에서 `피하/근육` / `정맥/복강` 으로 표기된 행은 각각 두 개의 별도 행으로 복제됨.

## 다음 단계

1. `pnpm init` → Next.js 14.2 + Express 스캐폴딩
2. PostgreSQL 연결 → `npx prisma migrate dev` → `npx prisma db seed`
3. 14개 모달리티 × 2~3 프리셋 초안 작성 → 팀 검토
4. 견적 계산 엔진 (pure fn + fast-check 테스트)
5. 5-step Wizard UI
6. PDF (@react-pdf/renderer, 3-section: 표지 / 견적 / 상세설명)
