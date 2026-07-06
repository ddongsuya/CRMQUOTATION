# 관리자 대시보드 — RECONCILE 대조·조정 리포트

핸드오프 `design_handoff_admin/RECONCILE.md` 양식에 대한 회신. Phase 0(데이터 기반·셸) + Phase 1(대시보드 12종) 완료 기준.

## 결정사항 (사용자 확정)
- **라우팅**: 별도 경로 `/admin/*` (관리자 전용 셸). 사용자 화면과 분리.
- **데모 노출**: 데모용 role 토글 — 사이드바 "관리자 콘솔"(사용자→관리자) · "사용자 뷰로 전환"(관리자→사용자). 쿠키 `demoView`. 정식 로그인 시 `User.role` 사용.
- **목표(Target)**: 신규 테이블 추가 + 목표 입력 UI(Phase 3).

## 대조·조정 표

| 기능 | 상태 | 현재 어떻게 돼 있나 | 조치 |
|------|------|---------------------|------|
| role 기반 화면 분기(관리자/일반) | **[미구현→구현]** | 로그인 OFF, 전원 데모(admin) 취급 | `lib/admin/roles.ts`(ADMIN·CENTER_LEAD·TEAM_LEAD=관리자) + `view.ts`(getViewMode). `/admin` 게이트=관리자 뷰만, 아니면 홈 리다이렉트 |
| 스코프 토글(전체/센터/개인) 서버 집계 매핑 | **[미구현→구현]** | 없음 | `AdminHeader` 세그먼트 → URL `scope`/`centerId` → `parseScope()` → 서버 집계. 일반 사용자는 개인 고정 |
| 개인→센터→전사 롤업 집계 | **[미구현→구현]** | 없음 | `aggregate.ts` `scopeUserIds()`(담당자→`User.centerId`→센터). 수주/파이프라인/수주율/활동/목표 전부 스코프별 |
| 센터별 목표(target) 대비 달성률 | **[미구현→구현]** | target 필드 없음 | `Target` 모델 신규(centerId·period·amount, null=전사) + `getTargetGauge()` 달성률. Neon push 완료 |
| 대시보드 12종 시각화 | **[미구현→구현]** | 없음 | `/admin` 12종 전부 CSS/SVG(라이브러리 0): 히어로·KPI4·센터월간·목표게이지·수주율추이·센터구성·산업별·퍼널·활동히트맵·상위고객·담당자요약 |
| 실적 분석(기간·센터 비교) | **[미구현→구현]** | 없음 | `/admin/analytics` — 기간 3카드(이번분기/전분기/전년동기 YoY) + 센터별 실적 비교(목표·수주·달성률바·수주율·전분기대비). `getPerformance()` |
| 고객 관리(전 담당자 조회) | **[부분→구현]** | 사용자용 `/customers` 존재(개인 범위) | `/admin/customers` 전사 — 등급/활성/휴면 필터칩 + 테이블(담당자·센터·진행견적·누적수주·최근활동). `getCustomerList()` |
| 시험 일정(프로젝트 스코프 간트) | **[부분→구현]** | 사용자용 `/gantt` 존재 | `/admin/schedule` — 전 프로젝트(안건) 테이블 + H1 미니 간트(상태색). `getSchedule()` |
| 견적 목록(전사 파이프라인) | **[부분→구현]** | 사용자용 `/quotes` 존재(개인) | `/admin/quotes` — 통계 4카드(수주=블랙) + 전사 견적 테이블(담당자·센터·상태점). `getQuoteList()` |
| 구성원 관리(계정·권한·실적) | **[미구현→구현]** | 없음 | `/admin/members` — 테이블(직책·센터·권한태그·건수·수주·수주율) + 구성원 추가(모달→POST). `getMemberList()` |
| 목표 입력(target 관리) | **[미구현→구현]** | 없음 | `/admin/settings` — 센터별/전사 목표 입력(억원)→`/api/admin/targets` upsert. 게이지·달성률 즉시 반영 |
| 라이트/다크 테마 | **[동일]** | AppChrome 테마 규약 존재 | AdminChrome이 동일 `localStorage 'theme'`+`data-theme` 규약 재사용. 반전 카드 항상 #191919 |

## 양방향(사용자 화면 ↔ 관리자 연동) 개발 내역
관리자 롤업이 성립하려면 사용자 데이터에 소유·센터 귀속이 필요 → 함께 반영:
1. **소유·센터 귀속**: 데모 org 시드(`prisma/seed-demo-org.ts`) — 센터 2개, 구성원 9명(본부장·센터장·팀장·구성원), 기존 CRM 데이터를 담당자에 분산, `User.centerId` 부여.
2. **`Quote.userId` 채움**: 견적을 담당자에 귀속(딜 소유자 기준) → 견적 롤업 성립.
3. **사용자 사이드바 진입점**: 관리자 계정에 "관리자 콘솔 → 전사 조회" 진입 카드 추가(`AppChrome`, `isAdmin` prop).
4. **뷰 토글 왕복**: 관리자↔사용자 뷰 상호 전환(쿠키), 게이트 리다이렉트.

## 데이터 정의(실 스키마 기반 — 사업 정의와 다르면 조정 필요)
- 수주 = `Quote.status='ACCEPTED'`(금액 grandTotal) · 파이프라인 = `DRAFT/ISSUED/SENT/REVIEWED` · 수주율 = ACCEPTED/(ACCEPTED+REJECTED) · 활동량 = Note+CalendarEvent · 월 그룹핑 = createdAt.

## 필드 없음 — 확인 필요
- **고객 등급(VIP 등)**: `Company`에 grade/tier 필드 없음 → 상위고객은 누적수주 기준 정렬로 대체. 등급 필터 필요 시 필드 추가 요망.
- **전분기 대비 델타(KPI 칩)**: 이력 스냅샷 없음 → 히어로 QoQ·수주율 델타만 월별 시계열에서 실산출, 파이프라인/활동량 델타는 미표기.

## 데모 데이터 주의
`seed-demo-org.ts`는 12종 차트가 성립하도록 **데모 볼륨**(고객사 18·안건·견적·활동 108건)을 생성(마커 `memo='DEMO_SEED'`, `title '[DEMO]'` — 멱등·되돌리기 가능). 기존 실데이터는 보존. 실운영 전 제거 대상.
