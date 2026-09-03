/**
 * 고객 상세(/customers/[id]) 화면의 API 응답 타입.
 * GET /api/crm/companies/{id} → { company, agg } · GET /api/crm/tasks?companyId= → { tasks } · GET …/activity → { items, total }
 */

export type Quote = { id: number; quoteNumber: string; status: string; grandTotal: number | null; createdAt: string };
export type Contract = { id: number; status: string; contractNumber: string | null; signedAt: string | null; draftSentAt: string | null } & Record<string, unknown>;
export type Study = { id: number; studyNumber: string | null; director: string | null; itemName: string | null; reportDraftDueAt: string | null; reportDraftIssuedAt: string | null } & Record<string, unknown>;
export type Note = { id: number; type: string; title: string | null; body: string; occurredAt: string };
export type EventT = { id: number; title: string; type: string; startAt: string; done: boolean; location?: string | null; attendeesClient?: string | null; attendeesInternal?: string | null; requests?: string | null };
export type Deal = {
  id: number; title: string; modality: string | null; stage: string; status: string; updatedAt: string;
  quotes: Quote[]; contract: Contract | null; studies: Study[]; notes: Note[]; events: EventT[];
};
export type Contact = { id: number; name: string; email: string | null; phone: string | null; position: string | null; memo: string | null; deals: Deal[] };
export type TaskT = { id: number; title: string; memo: string | null; dueAt: string | null; done: boolean; contact: { id: number; name: string } | null; deal: { id: number; title: string } | null };
export type Company = { id: number; name: string; bizRegNo: string | null; industry: string | null; address: string | null; isNewClient: boolean; memo: string | null; contacts: Contact[] };

export type DealMeta = { dealId: number; dealTitle: string; modality: string | null; stage: string };
export type QuoteRow = { id: number; quoteNumber: string; status: string; grandTotal: number | null; supplyTotal: number; createdAt: string; dealId: number | null; dealTitle: string; modality: string | null; contactId: number | null; contactName?: string | null; supersededAt?: string | null };
export type Agg = {
  kpi: { quoteCount: number; quoteAmount: number; wonAmount: number; dealCount: number; activeDeals: number; activeStudies: number };
  quotes: QuoteRow[];
  deals: (DealMeta & { id: number; title: string; status: string; updatedAt: string; contactName: string; quoteCount: number; quoteAmount: number })[];
  contracts: (Contract & DealMeta)[];
  studies: (Study & DealMeta)[];
  notes: (Note & { dealId: number | null; dealTitle: string | null; contactName: string | null; contactId: number | null })[];
  events: (EventT & { dealId: number | null; dealTitle: string | null; contactName?: string | null; contactId: number | null })[];
};
export type DealOpt = Agg['deals'];
export type ContactOpt = { id: number; name: string };

/** 활동 타임라인 항목 — GET /api/crm/companies/{id}/activity */
export type ActivityItem = {
  at: string;
  kind: 'note' | 'event' | 'task' | 'quote' | 'contract' | 'study' | 'deal';
  type?: string | null;
  title: string;
  detail?: string | null;
  href?: string;
  refId: number;
  dealId?: number | null;
  done?: boolean;
};

export const TABS = ['개요', '할 일', '딜', '연락처', '계약', '시험', '노트', '일정'] as const;
export type Tab = (typeof TABS)[number];
/** URL `?tab=` 영문 별칭 — 전역 검색 등 외부 링크용. 한글 키도 그대로 받는다. */
export const TAB_ALIAS: Record<string, Tab> = {
  overview: '개요', tasks: '할 일', deals: '딜', contacts: '연락처', contracts: '계약', studies: '시험', notes: '노트', schedule: '일정',
};
export const TAB_TO_ALIAS: Record<Tab, string> = { 개요: 'overview', '할 일': 'tasks', 딜: 'deals', 연락처: 'contacts', 계약: 'contracts', 시험: 'studies', 노트: 'notes', 일정: 'schedule' };
export function parseTab(raw: string | null | undefined): Tab | null {
  if (!raw) return null;
  if ((TABS as readonly string[]).includes(raw)) return raw as Tab;
  return TAB_ALIAS[raw.toLowerCase()] ?? null;
}

/** 개요 카드·타임라인에서 "특정 항목 수정/추가 폼 열기"로 탭을 넘길 때 전달하는 1회성 지시 */
export type JumpOpts = { editId?: number; open?: boolean };
export type GoTo = (t: Tab, opts?: JumpOpts) => void;
