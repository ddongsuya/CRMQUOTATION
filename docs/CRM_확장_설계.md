# CHEMON 견적 앱 → CRM 확장 설계서

> 상태: **설계(draft) — 검토용**. 코드 미반영. 확정 후 Phase별 구현.
> 작성: 2026-06-19 · 기준: 사용자 요구사항 1~8

---

## 0. 목표

기존 "비임상 견적 생성 앱"을 **로그인 유저별 개인 CRM**으로 확장한다.
의뢰 문의 → 견적 → 계약 → 시험 추적 → 세금계산서까지 하나의 사이클을 한 곳에서
기록·관리하고, 모든 데이터가 유저 안에서 상호 연동된다.

### 설계 원칙
1. **유저 격리** — 모든 운영 데이터는 `ownerId`(로그인 유저)로 격리. 한 유저의 데이터끼리만 연동. *(요구 #2)*
2. **단일 진실원천 + 연동** — 고객/안건/견적/계약/시험/기록이 하나의 그래프로 연결. 한 곳 변경이 연결된 모든 화면에 반영. *(요구 #2·#8)*
3. **운영데이터 = Postgres / 마스터데이터 = 기존 JSON+DataBlob** — 카탈로그·템플릿·가이드라인은 기존 구조 유지, CRM 운영데이터는 Prisma/Neon 테이블 신설.
4. **데모 유저로 먼저** — 지금은 단일 데모 계정(`ownerId` 고정)으로 개발하고, 정식 멀티유저 인증은 마지막에 켠다. (스키마는 처음부터 `ownerId`를 넣어 나중에 그대로 전환)

---

## 1. 데이터 모델 (Prisma / PostgreSQL)

```
User(기존) ─1:N─ Company ─1:N─ Contact ─1:N─ Deal ─┬─1:N─ Quote(기존)
                                                    ├─1:1─ Contract ─1:N─ PaymentTerm
                                                    ├─1:N─ Study   (시험번호별)
                                                    ├─1:N─ Note
                                                    ├─1:N─ CalendarEvent
                                                    └─1:N─ Document
```

> **조직·권한 (요구 #2 갱신):** 데이터는 `ownerId`로 소유되지만, **권한(role)에 따라 조회 범위가 확장**된다.
> `Center(센터) ─1:N─ Team(팀) ─1:N─ User`. User 에 `teamId`, `centerId`, `role`.
> - `MEMBER` → 본인 데이터만
> - `TEAM_LEAD` → 팀 전체
> - `CENTER_LEAD` → 센터 전체
> - `ADMIN` → 전체
> **대시보드도 2종**: 개인용(본인 안건·알람) / 관리자용(팀·센터·전체 집계). *(스키마엔 처음부터 넣고, 데모 단계엔 전부 한 유저)*

### Company (고객사) — 요구 #3
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| ownerId | Int FK→User | 유저 격리 |
| name | String | 고객사명 |
| bizRegNo | String? | 사업자등록번호 |
| industry | String? | 업종/분야 |
| address | String? | |
| isNewClient | Boolean | **첫 거래 여부** — true일 때만 의뢰사 사업자등록증·통장사본 요청(고객사 등록, 사업지원팀). 등록 완료 시 false |
| memo | String? | |
| createdAt/updatedAt | DateTime | |

> **조직 계층** (요구 #2): `Center(센터)`, `Team(팀)` 테이블 + `User.role`(MEMBER/TEAM_LEAD/CENTER_LEAD/ADMIN)·`teamId`·`centerId`. 조회 범위는 role로 확장(§1 상단 참고).

### Contact (의뢰자) — 요구 #3
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| companyId | Int FK→Company | 고객사 소속 |
| name | String | 의뢰자명 |
| email / phone | String? | |
| position | String? | 직책 |
| memo | String? | |

### Deal (안건) — 요구 #4·#5 진행도의 주체
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| ownerId | Int FK→User | |
| contactId | Int FK→Contact | |
| title | String | 안건명 (예: "OOO 13주 독성 견적") |
| modality | String? | |
| indication | String? | 적응증 *(문의 단계 입력)* |
| clinicalDesign | String? | 임상 예정 디자인 메모 |
| submissionTarget | String? | 제출처(MFDS/US FDA/EMA…) — 견적에서 연동 |
| reportLanguage | Enum | KO(국문) / EN(영문) — 해외 제출처면 EN(추가금 없음), 시험의뢰서 언어 결정 |
| translationRequested | Boolean | 국문보고서 + 별도 영문 번역요청 시 true → 번역의뢰서 |
| stage | Enum | 파이프라인 단계 (§2) |
| status | Enum | ACTIVE / WON / LOST |
| lostReason | String? | 진행 불가 사유 |
| createdAt/updatedAt | DateTime | |

### Quote (견적서) — 기존 테이블에 연결 필드 추가
- 추가: `dealId Int?`(안건 연결), `sentAt DateTime?`(송부일), `reviewedAt DateTime?`, `accepted Boolean?`(의뢰자 진행 수락 여부)
- 기존 필드(고객/금액/항목)는 유지. 고객 정보는 점차 Contact 참조로 이관.

### Contract (계약) — 요구 #5-③
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| dealId | Int FK→Deal | |
| quoteId | Int? FK→Quote | 기반 견적 |
| status | Enum | DRAFT / SENT / REVIEWED / APPROVED / SIGNED |
| draftSentAt | DateTime? | 초안 송부일 |
| approvedAt | DateTime? | 초안 승인일 |
| signedAt | DateTime? | 최종 날인일 |
| contractNumber | String? | **계약번호** — 날인본 제출 후 사업지원팀 부여 |
| → 지급조건 | PaymentTerm[] | 회차별 지급 스케줄 (아래 별도 엔티티) |

### PaymentTerm (지급 회차) — 요구 #5(지급조건)
한 계약의 지급을 회차별로 분해. 기본 **선금 50% + 잔금 50%**, 고객 요청 시 **중도금**을 회차별/시험번호별로 추가.
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| contractId | Int FK→Contract | |
| seq | Int | 회차 순번 |
| kind | Enum | ADVANCE(선금) / INTERIM(중도금) / BALANCE(잔금) |
| ratio | Float? | 비율 (예: 0.5) — 또는 amount |
| amount | Float? | 절대금액 (ratio 대신) |
| condition | String | 지급 조건 (계약체결시 / 시험착수시 / 최종보고서안 발행+30일 / 특정일…) |
| studyId | Int? FK→Study | 시험번호별 설정 시 연결 |
| dueAt | DateTime? | 산출/입력된 지급 기한 |
| paidAt | DateTime? | 실제 입금일 |

> 기본 프리셋: ① 선금 50% (계약 체결 시) ② 잔금 50% (최종보고서안 발행 + 30일).
> 중도금은 회차(seq) 추가 또는 특정 `studyId`(시험번호)에 묶어 설정.

### Study (시험 추적) — 요구 #5-③ 후반 · 안건당 여러 시험번호(1:N)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| dealId | Int FK→Deal | |
| requestSentAt | DateTime? | 시험의뢰서/서류 회신 + 시험관리팀 접수요청일 |
| studyNumber | String? | 시험번호 |
| director | String? | 시험책임자 |
| intakeCompletedAt | DateTime? | 시험접수 완료 안내 수령일 |
| reportDraftDueAt | DateTime? | 최종보고서(안) 발행 예정일 ★추적 핵심 |
| reportDraftIssuedAt | DateTime? | 최종보고서(안) 실제 발행일 |
| balanceDueAt | DateTime? | 잔금 기한 = 발행일 + 30일 (자동 계산) |
| invoiceRequestedAt | DateTime? | 세금계산서 발행 요청(사업지원팀) |
| invoiceIssuedAt | DateTime? | 세금계산서 발행 완료 |

### Note (기록) — 요구 #6
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| ownerId | Int FK→User | |
| contactId / dealId | Int? | 연결 대상 |
| type | Enum | MEETING / CALL / MEMO |
| title | String? | |
| body | String | 본문 |
| occurredAt | DateTime | 발생일 |

### CalendarEvent (일정) — 요구 #6·#7
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| ownerId | Int FK→User | |
| dealId / contactId | Int? | 연결 |
| title | String | |
| type | Enum | MEETING / DEADLINE / MILESTONE / REMINDER |
| startAt | DateTime | |
| endAt | DateTime? | |
| allDay | Boolean | |
| done | Boolean | 완료 체크 |
| source | Enum | MANUAL / AUTO (마일스톤 자동 생성분) |

### Document (문서) — 요구 #8
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| ownerId | Int FK→User | |
| dealId / contactId | Int? | 연결 |
| type | Enum | 견적서(pdf) / 계약서(docx) / 시험의뢰서_국문(docx) / 시험의뢰서_영문(docx) / 번역의뢰서(docx) / 상담기록지(xlsx) / 예정원가(xlsx) / 세금계산서안분(xlsx) / 사업자등록증 / 통장사본 / 기타 |
| name | String | |
| direction | Enum? | 당사→의뢰자 / 의뢰자→당사 / 당사→사업지원팀 / 당사→시험관리팀 |
| blobUrl | String | 파일 저장 위치 (Vercel Blob) |
| status | String? | |
| uploadedAt | DateTime | |

> 회사 고정 문서(우리회사 사업자등록증·통장사본)는 User/조직 레벨에 보관해 매번 첨부. 의뢰사 서류는 Company에 1회 등록(첫 거래).

### ChangeQuote (변경 견적) — 시험 진행 중 감가·추가금
| 필드 | 타입 | 설명 |
|---|---|---|
| id | Int PK | |
| dealId | Int FK→Deal | |
| studyId | Int? FK→Study | 특정 시험번호 관련 시 |
| kind | Enum | DEDUCT(감가) / ADD(추가금) |
| amount | Float | 변경 금액 |
| reason | String | 사유 (진행 중 이슈 등) |
| quoteId | Int? FK→Quote | 변경 견적서 발행 시 연결 |
| createdAt | DateTime | |

---

## 2. 안건(Deal) 파이프라인 — 요구 #5(상세 재정리 반영)

`Deal.stage` 단계 + 각 단계 세부 체크리스트(날짜·문서 기록). **※ 시험접수가 계약서보다 먼저다.**
관여 부서: **시험관리팀**(시험접수·시험번호·책임자 발급) / **사업지원팀**(고객사 등록·예정원가·안분파일·계약번호·세금계산서).

```
① INQUIRY   문의 접수
     - 접수 안내 발송
     - 적응증 · 임상 예정 디자인 파악            → Deal.indication / clinicalDesign

② QUOTE     견적
     - 견적서 생성(문의 기반) → 송부 → 검토        → Quote(dealId), sentAt
     - 제출처(submissionTarget) 기록 → 보고서 언어 결정 (③에서 사용)
         · 해외(US FDA 등) → 영문보고서 (추가금 없음)
         · 국내(MFDS) → 국문보고서 (+필요시 영문 번역요청)
     - 진행여부:  수락 → ③ / 불가 → status=LOST, lostReason

③ INTAKE    시험 접수 행정  (의뢰자 진행 의사 표명 후)
     ── 우리 → 의뢰자: 시험의뢰서 송부 + 작성요청 ───────────────
       시험의뢰서 양식 = 보고서 언어에 따라 분기 (양식 동일·내용 언어만 다름):
         · 영문보고서      → 영문 시험의뢰서
         · 국문보고서      → 국문 시험의뢰서
         · 국문보고서+번역요청 → 추가로 '번역의뢰서' 송부(의뢰자가 내용 작성·회신)
       + 첨부: 우리회사 사업자등록증·통장사본 (회사 고정 문서)
       + (첫 거래 고객사만) 의뢰사 사업자등록증·통장사본 요청
            → Company.isNewClient=true 일 때만. 고객사 등록은 사업지원팀 진행.
     ── 의뢰자 → 우리: 시험의뢰서(등) 작성 회신 (+첫거래면 의뢰사 서류) ──
     ── 우리: 상담기록지 작성 (시험의뢰서 + 그간 미팅·상담 기록 기반) ──  → Document(상담기록지, xlsx)
     ── 우리 → 시험관리팀: 시험의뢰서+상담기록지 송부 + 시험접수 요청 ──  → Study.requestSentAt
     ── 시험관리팀 → 우리: 접수완료 안내 + 시험 항목별 시험번호·시험책임자 ──
            → Study[] 생성 (항목별 1:N): studyNumber / director / intakeCompletedAt

④ CONTRACT  계약  (시험번호 확보 후)
     - 예정원가 작성(xlsx) + 세금계산서 안분파일 작성(xlsx) → 사업지원팀 송부
            → Document(예정원가/안분파일), 시험번호·발행일정 기반
     - 계약서 초안 송부(견적 기반)              → Contract.status=DRAFT, draftSentAt
     - 의뢰자 검토 → 이상없음/의견 회신 반영      → REVIEWED, approvedAt
     - 최종 계약서 날인본 서명                   → SIGNED, signedAt
     - 사업지원팀에 날인본 제출 → 계약번호 부여    → Contract.contractNumber
     - 지급 스케줄 확정                         → PaymentTerm[] (선금50/잔금50 기본, 중도금 옵션)

⑤ STUDY     시험 진행·추적
     - 진행 중 이슈/변경 추적, 감가·추가금 발생 시 변경견적 선출
            → ChangeQuote (감가/추가금, Deal에 연결)
     - 최종보고서(안) 발행일 추적                → Study.reportDraftDueAt / reportDraftIssuedAt
       (지급조건상 잔금 = 발행일 + 30일 → PaymentTerm.dueAt 자동)

⑥ INVOICE   세금계산서
     - 최종보고서(안) 발행일 기준 → 사업지원팀 세금계산서 발행 요청 → invoiceRequestedAt
     - 발행 완료                                → invoiceIssuedAt

⑦ DONE      사이클 종료
```

각 단계의 날짜·요청은 **CalendarEvent(AUTO)** 로 생성되어 대시보드 알람(§5)에 노출.
보고서 언어/번역요청은 **Deal** 에 플래그로 저장(아래 §1 추가 필드), 견적의 제출처에서 1차 결정.

---

## 3. 화면 / 메뉴 구성

| 메뉴 | 내용 |
|---|---|
| **대시보드 (개인)** | 본인 알람(다가오는·지연 날짜) · 본인 진행 안건 · 단계별 카운트 *(#7)* |
| **대시보드 (관리자)** | 권한(role)에 따라 팀/센터/전체 집계 — 단계별 현황·지연건·구성원별 진행 *(#2)* |
| **고객 관리** | 고객사 목록 → 고객사 상세(의뢰자 리스트) → 의뢰자 상세(안건·기록·일정 타임라인) *(#1·#3)* |
| **안건(파이프라인)** | 단계별 칸반/리스트 · 안건 상세(진행 체크리스트 + 견적·계약·시험·문서 연결) *(#4·#5)* |
| **견적** | 기존 견적 위저드 — 안건에 연결해 생성·보관 *(#8)* |
| **개인 기록** | 미팅·상담 기록 타임라인 (의뢰자/안건별) *(#6)* |
| **캘린더** | 일정·마감·미팅 달력 뷰 *(#6)* |
| **(관리자) 마스터데이터** | 기존 카탈로그·템플릿·가이드라인 (그대로) |

---

## 4. 연동 규칙 (요구 #2·#8)

- 모든 운영 엔티티는 `ownerId`로 필터 → 유저는 본인 데이터만 조회/수정.
- 그래프 연결: **Company ← Contact ← Deal ← (Quote·Contract·Study·Note·Event·Document)**.
  한 안건 상세에서 그 안건의 견적·계약·시험·문서·기록·일정을 모두 본다.
- 변경 전파 예: 고객사명 수정 → 그 고객사의 모든 의뢰자·안건·견적 화면에 즉시 반영(참조 기반).
- 견적 → 계약 전환: 견적의 항목·금액을 Contract 초안에 복사 *(추후 자동 문서 생성)*.
- 문서 첨부 → 견적·고객 정보 입력 시 자동 생성/연동 *(#8, Phase 4)*.

---

## 5. 대시보드 알람 (요구 #7)

현재 유저의 날짜 항목을 모아 "다가옴/오늘/지연"으로 표시:
- CalendarEvent (미팅·마감)
- Study.`reportDraftDueAt`, **`balanceDueAt`(발행+30일)** ★
- Quote.`sentAt` 후 N일 검토 팔로업
- Contract 검토·승인 마감

→ 매 단계 날짜 입력 시 AUTO 이벤트 생성 → 대시보드가 한곳에서 집계.

---

## 6. 결정 사항 (확정)

1. **문서 저장소** — **Vercel Blob** 도입 (앱 전용 파일 저장소; Postgres는 데이터, Blob은 파일). Phase 4. *(확정)*
2. **자동 생성 문서 포맷** — docx: 계약서·시험의뢰서(국/영)·번역의뢰서 / xlsx: 상담기록지·예정원가·세금계산서안분 / pdf: 견적서(기존). *(확정)*
3. **캘린더** — **앱 자체 구현**. *(확정)*
4. **권한 범위** — `ownerId` 소유 + **role 계층**(MEMBER/TEAM_LEAD/CENTER_LEAD/ADMIN)으로 조회범위 확장(팀·센터·전체). 대시보드 개인/관리자 분리. *(확정)*
5. **지급조건** — 단일 텍스트가 아니라 **PaymentTerm 회차 스케줄**. 기본 선금 50%+잔금 50%(발행+30일), 중도금은 회차별/시험번호별. *(확정 → §1 PaymentTerm 반영)*

---

## 6.5 인프라 방향 — 서버 (검토 중, 요구 #1)

현재: **Vercel(서버리스) + Neon(Postgres)**. CRM은 ① 파일 저장(업로드+생성 docx/xlsx) ② 예약 작업(알람·발행일 추적·메일) 이 필요 → 서버리스만으론 별도 서비스(Blob·Cron)를 붙여야 함.

사용자 의견: **"서버를 하나 연결하는 방향"**. 세 갈래:

| 방향 | 구성 | 장점 | 단점 |
|---|---|---|---|
| **A. 지속 서버 PaaS** (권장) | Railway / Render / Fly 등에 앱+파일디스크+크론 한곳 + 관리형 Postgres | 파일·예약작업 단순(디스크·크론 내장), "한 서버" 모델, Git 배포 | Vercel→이전 필요, 약간의 운영 |
| **B. 서버리스 유지 + 부가** | Vercel + Neon + Vercel Blob + Vercel Cron | 이전 없음, 자동 확장 | 서비스 3~4개 조합, 파일/잡 분산 |
| **C. 자체 VPS** | 직접 서버(VM)에 전부 | 완전한 통제 | 운영부담 큼(백업·보안·가동) |

**확정: A (지속 서버 PaaS) + Phase 3 직전 이전.**
- 방향: Railway/Render/Fly 등 지속 서버에 앱+파일디스크+크론, **관리형 Postgres(Neon 등)는 유지**.
- 시점: DB는 이전과 무관하게 유지되므로 **나중에 옮겨도 추가비용 없음** → Phase 1~2(데이터·화면)는 현재 인프라(Vercel+Neon)로 빠르게 구축, **파일·알람(cron)이 필요한 Phase 3 직전에 한 번에 이전.**
- 새 CRM 테이블은 평범한 Prisma 쿼리라 서버리스 제약과 무관 → 이전 시 재작업 없음.

## 7. 단계별 로드맵

| Phase | 범위 | 산출 |
|---|---|---|
| **1. 데이터 기반 + 고객 관리** | Company/Contact/Deal 스키마 · 고객사→의뢰자 CRUD · 기존 Quote에 dealId 연결 | 고객 관리 메뉴, 데모유저 격리 |
| **2. 파이프라인** | Deal 단계 머신(①~⑤) · 진행 체크리스트 · 의뢰자별 진행현황 · 견적→Contract 전환 · Study 추적 | 안건 메뉴, 시험/계약 추적 |
| **3. 기록·일정·알람** | Note · CalendarEvent · 대시보드 날짜 알람 | 개인 기록·캘린더 메뉴, 대시보드 알람 |
| **4. 문서·자동생성** | Document 첨부(Vercel Blob) · 계약서·시험의뢰서(docx)·상담기록지(xlsx) 자동 생성 연동 | 문서함, 자동 문서 |
| **5. 인증 전환** | 데모유저 → 실제 NextAuth 멀티유저, ownerId 전환 검증 | 정식 로그인 |

---

## 8. 기존 자산과의 관계

- **견적 엔진(assemble/suggest)** — 그대로. Deal에서 견적 위저드를 호출해 결과를 Quote로 저장.
- **마스터데이터(카탈로그·템플릿·가이드라인 + DataBlob overlay)** — 그대로. CRM은 이를 읽어 견적 생성에만 사용.
- **인증** — 현재 데모 모드. Phase 5에서 복구. 스키마에 `ownerId`를 처음부터 넣어 무중단 전환.
