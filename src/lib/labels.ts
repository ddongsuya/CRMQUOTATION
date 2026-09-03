/**
 * enum → 한국어 라벨 단일 사전. 화면마다 흩어져 있던 인라인 맵(STAGE·TYPE_LABEL·FILTERS…)의 정본.
 * 새 라벨은 여기에만 추가하고, 화면에서는 label(...) 또는 개별 사전을 import 한다.
 * 색 클래스(tone)는 화면 컨텍스트에 따라 다를 수 있어 여기서는 "기본 톤" 하나만 제공한다.
 */

type Entry = { label: string; tone: string };
const t = (label: string, tone = 'bg-slate-200 text-ink-muted'): Entry => ({ label, tone });

/** 견적(Quote.status) — DRAFT / ISSUED / SENT / REVIEWED / ACCEPTED / REJECTED */
export const QUOTE_STATUS: Record<string, Entry> = {
  DRAFT: t('작성중'),
  ISSUED: t('발행', 'bg-brand-100 text-brand-700'),
  SENT: t('발송', 'tone-sent'),
  REVIEWED: t('검토중', 'tone-blue'),
  ACCEPTED: t('수주', 'bg-emerald-100 text-emerald-700'),
  REJECTED: t('반려', 'bg-red-100 text-red-700'),
};
export const QUOTE_STATUS_ORDER = ['DRAFT', 'ISSUED', 'SENT', 'REVIEWED', 'ACCEPTED', 'REJECTED'] as const;
/** 진행 중(파이프라인)으로 치는 견적 상태 — 대시보드·홈·목록 공통 정의 */
export const QUOTE_OPEN_STATUSES = ['DRAFT', 'ISSUED', 'SENT', 'REVIEWED'] as const;

/** 안건(Deal.stage) — INQUIRY → DONE */
export const DEAL_STAGE: Record<string, Entry> = {
  INQUIRY: t('문의접수'),
  QUOTE: t('견적', 'bg-brand-100 text-brand-700'),
  INTAKE: t('시험접수', 'tone-sent'),
  CONTRACT: t('계약', 'bg-amber-100 text-amber-800'),
  STUDY: t('시험진행', 'tone-blue'),
  INVOICE: t('세금계산서', 'bg-emerald-100 text-emerald-700'),
  DONE: t('완료', 'bg-emerald-100 text-emerald-700'),
};
export const DEAL_STAGE_ORDER = ['INQUIRY', 'QUOTE', 'INTAKE', 'CONTRACT', 'STUDY', 'INVOICE', 'DONE'] as const;

/** 안건(Deal.status) — ACTIVE / WON / LOST */
export const DEAL_STATUS: Record<string, Entry> = {
  ACTIVE: t('진행중', 'bg-brand-100 text-brand-700'),
  WON: t('수주', 'bg-emerald-100 text-emerald-700'),
  LOST: t('실주', 'bg-red-100 text-red-700'),
};

/** 실주 사유(Deal.lostReason) — 자유 입력이지만 기본 선택지는 통일 */
export const LOST_REASONS = ['가격', '경쟁사 선정', '일정 불가', '과제 중단·보류', '내부 검토 종료', '기타'] as const;

/** 계약(Contract.status) — DRAFT / SENT / REVIEWED / APPROVED / SIGNED */
export const CONTRACT_STATUS: Record<string, Entry> = {
  DRAFT: t('초안'),
  SENT: t('송부', 'bg-amber-100 text-amber-800'),
  REVIEWED: t('검토', 'tone-blue'),
  APPROVED: t('승인', 'bg-brand-100 text-brand-700'),
  SIGNED: t('체결', 'bg-emerald-100 text-emerald-700'),
};
export const CONTRACT_STATUS_ORDER = ['DRAFT', 'SENT', 'REVIEWED', 'APPROVED', 'SIGNED'] as const;

/** 지급 회차(PaymentTerm.kind) */
export const PAYMENT_KIND: Record<string, string> = { ADVANCE: '선금', INTERIM: '중도금', BALANCE: '잔금' };

/** 일정(CalendarEvent.type) + 아젠다의 TASK 항목 */
export const EVENT_TYPE: Record<string, Entry> = {
  MEETING: t('미팅', 'bg-brand-500'),
  DEADLINE: t('마감', 'bg-red-500'),
  MILESTONE: t('보고서안', 'bg-emerald-500'),
  REMINDER: t('팔로업', 'bg-[var(--status-sent)]'),
  TASK: t('할 일', 'bg-[var(--status-sent)]'),
};
/** 일정 생성 폼의 설명 라벨(캘린더 새 일정 모달) */
export const EVENT_TYPE_LONG: Record<string, string> = {
  MEETING: '미팅/일정', TASK: '할 일(기한)', DEADLINE: '마감(잔금 등)', MILESTONE: '보고서(안) 발행', REMINDER: '팔로업',
};

/** 기록(Note.type) */
export const NOTE_TYPE: Record<string, string> = { MEETING: '미팅', CALL: '통화', MEMO: '메모' };

/** 사용자 직책(User.role) — lib/admin/roles.ts 의 roleLabel 과 동일 값 */
export const ROLE: Record<string, string> = { ADMIN: '본부장', CENTER_LEAD: '센터장', TEAM_LEAD: '팀장', MEMBER: '구성원', admin: '관리자', user: '구성원' };

/** 어떤 사전이든 안전하게 라벨만 — 미등록 값은 원문 그대로(영문 enum 노출을 피하려면 사전에 추가할 것) */
export function label(dict: Record<string, Entry | string>, key: string | null | undefined, fallback = '—'): string {
  if (!key) return fallback;
  const e = dict[key];
  if (!e) return key;
  return typeof e === 'string' ? e : e.label;
}
export function tone(dict: Record<string, Entry>, key: string | null | undefined, fallback = 'bg-slate-200 text-ink-muted'): string {
  if (!key) return fallback;
  return dict[key]?.tone ?? fallback;
}

/** 금액 표기 접미 — CRM 화면의 금액은 공급가(VAT 별도) */
export const VAT_EXCL = 'VAT 별도';
