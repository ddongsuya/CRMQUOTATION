/**
 * CRM API 요청 본문 스키마 (zod) — src/app/api/crm/** 라우트의 손 파싱을 대체.
 *
 *  · 생성(Create) 스키마: 선택 텍스트는 없음·null·'' → null, 날짜는 ''·null → null(또는 라우트 기본값).
 *  · 수정(Patch) 스키마: 키가 없으면 undefined(변경 없음) — Prisma 가 undefined 를 무시하므로 그대로 data 로 전달 가능.
 *    키가 있으면 기존 라우트와 같은 정규화(trim, ''→null, falsy id → null 해제).
 *  · id 류는 숫자 문자열도 허용(z.coerce). 날짜는 기존 `new Date(x)` 관용을 유지하되 Invalid Date 는 400.
 *  · 오류 메시지는 전부 한국어 — parseBody 가 첫 이슈 메시지를 { error } 로 돌려준다.
 */
import { z } from 'zod';

const ID_MSG = 'ID 형식이 올바르지 않습니다.';
const DATE_MSG = '날짜 형식이 올바르지 않습니다.';
const TEXT_MSG = '문자열이어야 합니다.';
const NUM_MSG = '숫자여야 합니다.';
const BOOL_MSG = '참/거짓 값이어야 합니다.';

// ── 공통 프리미티브 ─────────────────────────────────────────────────────────
/** 필수 텍스트 — 없음·null·공백 모두 msg 로 거부, trim 적용 */
const reqText = (msg: string) => z.string({ required_error: msg, invalid_type_error: msg }).trim().min(1, msg);
/** 선택 텍스트(생성) — 없음·null·'' → null, 그 외 trim */
const optText = z.string({ invalid_type_error: TEXT_MSG }).nullish().transform(v => v?.trim() || null);
/** 선택 텍스트(수정) — 키 없음 → undefined(변경 없음), null·'' → null */
const patchText = z.string({ invalid_type_error: TEXT_MSG }).nullable().transform(v => v?.trim() || null).optional();
/** 필수 텍스트(수정) — 키 없음 → 변경 없음, 키가 있으면 비울 수 없음 */
const patchReqText = (msg: string) => z.string({ invalid_type_error: msg }).nullable()
  .transform((v, ctx) => {
    const t = v?.trim() ?? '';
    if (!t) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg }); return z.NEVER; }
    return t;
  }).optional();

/** 필수 양의 정수 id (숫자 문자열 허용) */
const reqId = (msg: string = ID_MSG) => z.coerce.number({ required_error: msg, invalid_type_error: msg }).int(msg).positive(msg);
/** 연결 id — falsy(''·0·null) → null(해제), 그 외 양의 정수. 기존 `b.x ? Number(b.x) : null` 관용 */
const linkId = z.preprocess(
  v => (v === '' || v === 0 || v === false ? null : v),
  z.coerce.number({ invalid_type_error: ID_MSG }).int(ID_MSG).positive(ID_MSG).nullable(),
);
const linkIdNull = linkId.default(null);   // 생성: 없음 → null
const linkIdOpt = linkId.optional();       // 수정: 없음 → 변경 없음

/** 날짜 문자열 → Date (`new Date(x)` 관용 유지, Invalid Date 는 거부) */
const toDate = (v: string, ctx: z.RefinementCtx): Date => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: DATE_MSG }); return z.NEVER; }
  return d;
};
const dateInput = z.string({ required_error: DATE_MSG, invalid_type_error: DATE_MSG }).transform(toDate);
/** 필수 날짜 — 없음·'' 는 msg 로 거부 */
const reqDate = (msg: string) => z.string({ required_error: msg, invalid_type_error: msg }).min(1, msg).transform(toDate);
/** ''·null → null, 그 외 Date. 기존 `v ? new Date(String(v)) : null` 관용 */
const nullableDate = z.preprocess(v => (v === '' ? null : v), dateInput.nullable());
const optDate = nullableDate.default(null);   // 생성: 없음 → null
const patchDate = nullableDate.optional();     // 수정: 없음 → 변경 없음

/** 생성용 불리언 — 없음·null → true (기존 `b.x ?? true`) */
const boolDefaultTrue = z.boolean({ invalid_type_error: BOOL_MSG }).nullish().transform(v => v ?? true);
/** 수정용 불리언 — 키 없음 → 변경 없음, 있으면 `!!v` 와 동일하게 강제 변환 */
const patchBool = z.coerce.boolean().optional();

/** 선택 숫자 — 없음·null → null, 그 외 Number(). 기존 `v == null ? null : Number(v)` 관용('' → 0 포함) */
const nullableNumber = z.coerce.number({ invalid_type_error: NUM_MSG }).nullish().transform(v => v ?? null);

const koEnum = <T extends [string, ...string[]]>(values: T, msg: string) =>
  z.enum(values, { errorMap: () => ({ message: msg }) });

// ── 값 집합 (prisma/schema.prisma 주석과 동일) ─────────────────────────────────
export const DEAL_STAGES = ['INQUIRY', 'QUOTE', 'INTAKE', 'CONTRACT', 'STUDY', 'INVOICE', 'DONE'] as const;
export const DEAL_STATUSES = ['ACTIVE', 'WON', 'LOST'] as const;
export const REPORT_LANGUAGES = ['KO', 'EN'] as const;
export const NOTE_TYPES = ['MEETING', 'CALL', 'MEMO'] as const;
export const EVENT_TYPES = ['MEETING', 'DEADLINE', 'MILESTONE', 'REMINDER'] as const;
export const CONTRACT_STATUSES = ['DRAFT', 'SENT', 'REVIEWED', 'APPROVED', 'SIGNED'] as const;
export const PAYMENT_KINDS = ['ADVANCE', 'INTERIM', 'BALANCE'] as const;
export const CHANGE_QUOTE_KINDS = ['DEDUCT', 'ADD'] as const;

const dealStage = koEnum([...DEAL_STAGES], '안건 단계 값이 올바르지 않습니다.');
const dealStatus = koEnum([...DEAL_STATUSES], '안건 상태 값이 올바르지 않습니다.');
const reportLanguage = koEnum([...REPORT_LANGUAGES], '보고서 언어는 KO 또는 EN 이어야 합니다.');
const noteType = koEnum([...NOTE_TYPES], '기록 유형이 올바르지 않습니다.');
const eventType = koEnum([...EVENT_TYPES], '일정 유형이 올바르지 않습니다.');
const contractStatus = koEnum([...CONTRACT_STATUSES], '계약 상태 값이 올바르지 않습니다.');
const paymentKind = koEnum([...PAYMENT_KINDS], '지급 회차 종류가 올바르지 않습니다.');
const changeQuoteKind = koEnum([...CHANGE_QUOTE_KINDS], '변경견적 종류는 DEDUCT 또는 ADD 이어야 합니다.');

// ── 고객사 ───────────────────────────────────────────────────────────────────
export const companyCreateSchema = z.object({
  name: reqText('고객사명을 입력하세요.'),
  bizRegNo: optText,
  industry: optText,
  address: optText,
  isNewClient: boolDefaultTrue,
  memo: optText,
});
export const companyPatchSchema = z.object({
  name: patchReqText('고객사명은 비울 수 없습니다.'),
  bizRegNo: patchText,
  industry: patchText,
  address: patchText,
  memo: patchText,
  isNewClient: patchBool,
});

// ── 의뢰자 ───────────────────────────────────────────────────────────────────
const CONTACT_REQ = 'companyId·name 이 필요합니다.';
export const contactCreateSchema = z.object({
  companyId: reqId(CONTACT_REQ),
  name: reqText(CONTACT_REQ),
  email: optText,
  phone: optText,
  position: optText,
  memo: optText,
});
export const contactPatchSchema = z.object({
  name: patchReqText('의뢰자명은 비울 수 없습니다.'),
  email: patchText,
  phone: patchText,
  position: patchText,
  memo: patchText,
});

// ── 안건 ─────────────────────────────────────────────────────────────────────
const DEAL_REQ = 'contactId·title 이 필요합니다.';
export const dealCreateSchema = z.object({
  contactId: reqId(DEAL_REQ),
  title: reqText(DEAL_REQ),
  modality: optText,
  indication: optText,
  clinicalDesign: optText,
  submissionTarget: optText,
  reportLanguage: reportLanguage.default('KO'),
});
export const dealPatchSchema = z.object({
  title: patchReqText('안건명은 비울 수 없습니다.'),
  modality: patchText,
  indication: patchText,
  clinicalDesign: patchText,
  submissionTarget: patchText,
  lostReason: patchText,
  reportLanguage: reportLanguage.optional(),
  translationRequested: patchBool,
  stage: dealStage.optional(),
  status: dealStatus.optional(),
});

// ── 기록(노트) ───────────────────────────────────────────────────────────────
export const noteCreateSchema = z.object({
  type: noteType.default('MEMO'),
  title: optText,
  body: reqText('내용을 입력하세요.'),
  occurredAt: nullableDate.optional().transform(v => v ?? new Date()),   // 없음·'' → 지금
  contactId: linkIdNull,
  dealId: linkIdNull,
});
export const notePatchSchema = z.object({
  title: patchText,
  body: patchReqText('내용은 비울 수 없습니다.'),
  type: noteType.optional(),
  occurredAt: nullableDate.transform(v => v ?? new Date()).optional(),   // 키 있고 비어 있으면 → 지금
});

// ── 일정 ─────────────────────────────────────────────────────────────────────
const EVENT_REQ = '제목·날짜가 필요합니다.';
export const eventCreateSchema = z.object({
  title: reqText(EVENT_REQ),
  type: eventType.default('MEETING'),
  startAt: reqDate(EVENT_REQ),
  endAt: optDate,
  allDay: boolDefaultTrue,
  dealId: linkIdNull,
  contactId: linkIdNull,
  location: optText,
  attendeesClient: optText,
  attendeesInternal: optText,
  requests: optText,
});
export const eventPatchSchema = z.object({
  title: patchReqText('제목은 비울 수 없습니다.'),
  type: eventType.optional(),
  startAt: dateInput.optional(),   // null 불가 (시작일은 필수 컬럼)
  endAt: patchDate,
  done: patchBool,
  dealId: linkIdOpt,
  contactId: linkIdOpt,
  location: patchText,
  attendeesClient: patchText,
  attendeesInternal: patchText,
  requests: patchText,
});

// ── 할 일 ────────────────────────────────────────────────────────────────────
export const taskCreateSchema = z.object({
  title: reqText('할 일 내용을 입력하세요.'),
  memo: optText,
  dueAt: optDate,
  companyId: linkIdNull,
  contactId: linkIdNull,
  dealId: linkIdNull,
});
export const taskPatchSchema = z.object({
  title: patchReqText('내용은 비울 수 없습니다.'),
  memo: patchText,
  dueAt: patchDate,
  done: patchBool,
  companyId: linkIdOpt,
  contactId: linkIdOpt,
  dealId: linkIdOpt,
});

// ── 계약 ─────────────────────────────────────────────────────────────────────
export const contractCreateSchema = z.object({
  dealId: reqId('dealId 가 필요합니다.'),
});
const paymentTermSchema = z.object({
  seq: z.coerce.number({ invalid_type_error: NUM_MSG }).int('회차 순번은 정수여야 합니다.').nullish(),   // 없으면 배열 index+1
  kind: paymentKind.default('INTERIM'),
  ratio: nullableNumber,
  amount: nullableNumber,
  condition: optText,
  studyId: z.coerce.number({ invalid_type_error: ID_MSG }).int(ID_MSG).nullish().transform(v => v ?? null),
  dueAt: optDate,
  paidAt: optDate,
});
export const contractPatchSchema = z.object({
  status: contractStatus.optional(),
  contractNumber: patchText,
  costEstimateSentAt: patchDate,
  draftSentAt: patchDate,
  approvedAt: patchDate,
  signedAt: patchDate,
  /** 지급회차 전체 교체 — seq 미지정 시 index+1 */
  paymentTerms: z.array(paymentTermSchema, { invalid_type_error: '지급 회차는 배열이어야 합니다.' })
    .transform(arr => arr.map((t, i) => ({ ...t, seq: t.seq ?? i + 1 })))
    .optional(),
});
export type PaymentTermInput = NonNullable<z.infer<typeof contractPatchSchema>['paymentTerms']>[number];

// ── 시험 ─────────────────────────────────────────────────────────────────────
export const studyCreateSchema = z.object({
  dealId: reqId('dealId 가 필요합니다.'),
  itemName: optText,
  studyNumber: optText,
  director: optText,
});
export const studyPatchSchema = z.object({
  itemName: patchText,
  studyNumber: patchText,
  director: patchText,
  department: patchText,
  requestSentAt: patchDate,
  studyEndAt: patchDate,
  intakeCompletedAt: patchDate,
  reportDraftDueAt: patchDate,
  reportDraftIssuedAt: patchDate,
  invoiceRequestedAt: patchDate,
  invoiceIssuedAt: patchDate,
});

// ── 변경견적 ─────────────────────────────────────────────────────────────────
const CHANGE_REQ = 'dealId·금액·사유가 필요합니다.';
export const changeQuoteCreateSchema = z.object({
  dealId: reqId(CHANGE_REQ),
  kind: changeQuoteKind.default('ADD'),
  amount: z.coerce.number({ required_error: CHANGE_REQ, invalid_type_error: CHANGE_REQ }).finite(CHANGE_REQ),   // 부호는 라우트에서 Math.abs
  reason: reqText(CHANGE_REQ),
  studyId: linkIdNull,
});
