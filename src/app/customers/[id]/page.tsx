'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { Loader2, Pencil, Trash2, Save, Briefcase, Sparkles, FileSignature, FlaskConical, NotebookPen, Receipt } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { formatPhone } from '@/lib/format-phone';
import EventDetailFields from '@/components/crm/EventDetailFields';

type Quote = { id: number; quoteNumber: string; status: string; grandTotal: number | null; createdAt: string };
type Contract = { id: number; status: string; contractNumber: string | null; signedAt: string | null; draftSentAt: string | null } & Record<string, unknown>;
type Study = { id: number; studyNumber: string | null; director: string | null; itemName: string | null; reportDraftDueAt: string | null; reportDraftIssuedAt: string | null } & Record<string, unknown>;
type Note = { id: number; type: string; title: string | null; body: string; occurredAt: string };
type EventT = { id: number; title: string; type: string; startAt: string; done: boolean; location?: string | null; attendeesClient?: string | null; attendeesInternal?: string | null; requests?: string | null };
type Deal = {
  id: number; title: string; modality: string | null; stage: string; status: string; updatedAt: string;
  quotes: Quote[]; contract: Contract | null; studies: Study[]; notes: Note[]; events: EventT[];
};
type Contact = { id: number; name: string; email: string | null; phone: string | null; position: string | null; memo: string | null; deals: Deal[] };
type TaskT = { id: number; title: string; memo: string | null; dueAt: string | null; done: boolean; contact: { id: number; name: string } | null; deal: { id: number; title: string } | null };
type Company = { id: number; name: string; bizRegNo: string | null; industry: string | null; address: string | null; isNewClient: boolean; memo: string | null; contacts: Contact[] };

type DealMeta = { dealId: number; dealTitle: string; modality: string | null; stage: string };
type QuoteRow = { id: number; quoteNumber: string; status: string; grandTotal: number | null; supplyTotal: number; createdAt: string; dealId: number | null; dealTitle: string; modality: string | null; contactId: number | null; contactName?: string | null; supersededAt?: string | null };
type Agg = {
  kpi: { quoteCount: number; quoteAmount: number; wonAmount: number; dealCount: number; activeDeals: number; activeStudies: number };
  quotes: QuoteRow[];
  deals: (DealMeta & { id: number; title: string; status: string; updatedAt: string; contactName: string; quoteCount: number; quoteAmount: number })[];
  contracts: (Contract & DealMeta)[];
  studies: (Study & DealMeta)[];
  notes: (Note & { dealId: number | null; dealTitle: string | null; contactName: string | null; contactId: number | null })[];
  events: (EventT & { dealId: number | null; dealTitle: string | null; contactName?: string | null; contactId: number | null })[];
};

const STAGE: Record<string, { label: string; cls: string }> = {
  INQUIRY: { label: '문의접수', cls: 'bg-slate-200 text-ink-muted' },
  QUOTE: { label: '견적', cls: 'bg-brand-100 text-brand-700' },
  INTAKE: { label: '시험접수', cls: 'tone-sent' },
  CONTRACT: { label: '계약', cls: 'bg-amber-100 text-amber-800' },
  STUDY: { label: '시험진행', cls: 'tone-blue' },
  INVOICE: { label: '세금계산서', cls: 'bg-emerald-100 text-emerald-700' },
  DONE: { label: '완료', cls: 'bg-emerald-100 text-emerald-700' },
};
const CONTRACT_ST: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '초안', cls: 'bg-slate-200 text-ink-muted' },
  SENT: { label: '송부', cls: 'bg-amber-100 text-amber-800' },
  REVIEWED: { label: '검토', cls: 'tone-blue' },
  APPROVED: { label: '승인', cls: 'bg-brand-100 text-brand-700' },
  SIGNED: { label: '체결', cls: 'bg-emerald-100 text-emerald-700' },
};
const NOTE_T: Record<string, { label: string; cls: string }> = {
  MEETING: { label: '미팅', cls: 'bg-brand-100 text-brand-700' },
  CALL: { label: '통화', cls: 'tone-blue' },
  MEMO: { label: '메모', cls: 'bg-slate-200 text-ink-muted' },
};
const EVENT_T: Record<string, string> = { MEETING: 'bg-brand-400', DEADLINE: 'bg-red-400', MILESTONE: 'bg-[var(--status-sent)]', REMINDER: 'bg-amber-400' };

const fmtWon = (n: number | null | undefined) => `₩${(n ?? 0).toLocaleString()}`;
const fmtWonM = (n: number) => (n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(1)}M` : `₩${n.toLocaleString()}`);
const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '—');
function dday(s: string | null | undefined): { label: string; cls: string } | null {
  if (!s) return null;
  const days = Math.ceil((new Date(s).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return { label: 'D-DAY', cls: 'bg-red-100 text-red-700' };
  if (days < 0) return { label: `D+${-days}`, cls: 'bg-slate-200 text-ink-subtle' };
  return { label: `D-${days}`, cls: days <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-ink-muted' };
}

const TABS = ['개요', '할 일', '딜', '연락처', '계약', '시험', '노트', '일정'] as const;
type Tab = (typeof TABS)[number];

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [agg, setAgg] = useState<Agg | null>(null);
  const [tab, setTab] = useState<Tab>('개요');
  const [editCompany, setEditCompany] = useState(false);
  const [contactModal, setContactModal] = useState<{ contact: Contact | null } | null>(null);
  const [dealModal, setDealModal] = useState<{ contactId: number } | null>(null);
  const [tasks, setTasks] = useState<TaskT[]>([]);
  // 개요 카드에서 "특정 항목 수정/추가 폼 열기"로 탭을 넘길 때 전달하는 1회성 지시
  const [jump, setJump] = useState<{ editId?: number; open?: boolean } | null>(null);
  const goTo = (t: Tab, opts?: { editId?: number; open?: boolean }) => { setJump(opts ?? null); setTab(t); };
  const tabsId = useId();
  // 탭리스트 좌우 방향키 이동 (WAI-ARIA tabs 패턴)
  const onTabKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = TABS.indexOf(tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length];
    setJump(null); setTab(next);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[TABS.indexOf(next)]?.focus();
  };

  const [loadError, setLoadError] = useState(false);
  const reqSeq = useRef(0);   // 빠른 화면 전환 시 이전 응답이 현재 고객사를 덮어쓰지 않게
  const load = useCallback(() => {
    const my = ++reqSeq.current;
    setLoadError(false);
    fetch(`/api/crm/companies/${id}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (my === reqSeq.current) { setCompany(d.company ?? null); setAgg(d.agg ?? null); } })
      .catch(e => { if (my === reqSeq.current) { setLoadError(true); console.error('[company] load failed', e); } });
    fetch(`/api/crm/tasks?companyId=${id}`).then(r => r.json()).then(d => { if (my === reqSeq.current) setTasks(d.tasks ?? []); }).catch(e => console.error('[company] tasks load failed', e));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const delContact = async (cid: number) => {
    if (!confirm('이 의뢰자와 연결된 안건도 삭제됩니다. 계속할까요?')) return;
    const res = await fetch(`/api/crm/contacts/${cid}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다.'); load(); } else toast.error('삭제 실패');
  };

  const firstContactId = company?.contacts[0]?.id;
  const tabCount: Record<Tab, number | null> = useMemo(() => ({
    개요: null, '할 일': tasks.filter(t => !t.done).length, 딜: agg?.deals.length ?? 0, 연락처: company?.contacts.length ?? 0,
    계약: agg?.contracts.length ?? 0, 시험: agg?.studies.length ?? 0, 노트: agg?.notes.length ?? 0, 일정: agg?.events.filter(e => !e.done).length ?? 0,
  }), [agg, company, tasks]);

  if (!company) return loadError
    ? <div role="alert" className="card p-12 text-center text-sm text-red-700">고객사 정보를 불러오지 못했습니다. <button onClick={load} className="btn-ghost text-sm ml-2">다시 시도</button></div>
    : <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/customers" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"><Icon name="chevron-left" className="w-3.5 h-3.5" /> 고객 관리</Link>

      {/* 고객사 헤더 + KPI */}
      <div className="card p-[22px]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-[10px] bg-brand-100 text-brand-700 font-bold text-lg flex-shrink-0">{company.name.charAt(0)}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1] break-keep">{company.name}</h1>
                {company.isNewClient && <span className="pill tone-accent inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />첫거래</span>}
              </div>
              <div className="text-xs text-ink-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                {company.industry && <span>{company.industry}</span>}
                {company.bizRegNo && <span>사업자 {company.bizRegNo}</span>}
                {company.address && <span>{company.address}</span>}
              </div>
              {company.memo && <div className="text-xs text-ink-subtle mt-1.5 whitespace-pre-wrap">{company.memo}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setEditCompany(true)} className="btn-outline text-xs"><Pencil className="w-3.5 h-3.5" /> 수정</button>
            <Link href={`/quote-v2?company=${encodeURIComponent(company.name)}`} className="btn-outline text-xs"><Receipt className="w-3.5 h-3.5" /> 견적</Link>
            {firstContactId && <button onClick={() => setDealModal({ contactId: firstContactId })} className="btn-primary text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 안건</button>}
          </div>
        </div>

        {agg && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <KpiCell icon={<Receipt className="w-3.5 h-3.5" />} label="누적 견적" value={fmtWonM(agg.kpi.quoteAmount)} sub={`${agg.kpi.quoteCount}건 · VAT 별도`} />
            <KpiCell icon={<FileSignature className="w-3.5 h-3.5" />} label="수주" value={fmtWonM(agg.kpi.wonAmount)} sub={`진행 딜 ${agg.kpi.activeDeals} · VAT 별도`} />
            <KpiCell icon={<FlaskConical className="w-3.5 h-3.5" />} label="진행 시험" value={`${agg.kpi.activeStudies}건`} sub={`전체 ${agg.kpi.dealCount} 안건`} />
          </div>
        )}
      </div>

      {/* 탭 바 */}
      <div role="tablist" aria-label="고객사 상세 탭" onKeyDown={onTabKey} className="flex gap-1 border-b border-slate-200 overflow-x-auto -mx-1 px-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            role="tab"
            id={`${tabsId}-tab-${i}`}
            aria-selected={tab === t}
            aria-controls={`${tabsId}-panel`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => { setJump(null); setTab(t); }}
            className={clsx('px-3.5 py-2 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5',
              tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {t}
            {tabCount[t] != null && <span className={clsx('text-[10px] tabular-nums px-1.5 rounded-full', tab === t ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-ink-subtle')}>{tabCount[t]}</span>}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-tab-${TABS.indexOf(tab)}`}>
      {tab === '개요' && (
        <OverviewTab agg={agg} company={company} tasks={tasks} reload={load} onGo={goTo}
          onAddContact={() => setContactModal({ contact: null })} onEditContact={c => setContactModal({ contact: c })} />
      )}
      {tab === '할 일' && <TasksTab companyId={company.id} tasks={tasks} deals={agg?.deals ?? []} contacts={company.contacts} reload={load} />}
      {tab === '딜' && <DealsTab agg={agg} contacts={company.contacts} onAddDeal={cid => setDealModal({ contactId: cid })} />}
      {tab === '연락처' && (
        <ContactsTab company={company} quotes={agg?.quotes ?? []} onAdd={() => setContactModal({ contact: null })} onEdit={c => setContactModal({ contact: c })} onDel={delContact} onAddDeal={cid => setDealModal({ contactId: cid })} />
      )}
      {tab === '계약' && <ContractsTab agg={agg} deals={agg?.deals ?? []} reload={load} />}
      {tab === '시험' && <StudiesTab agg={agg} deals={agg?.deals ?? []} reload={load} />}
      {tab === '노트' && <NotesTab agg={agg} deals={agg?.deals ?? []} contacts={company.contacts} reload={load} initial={jump ?? undefined} />}
      {tab === '일정' && <ScheduleTab agg={agg} deals={agg?.deals ?? []} contacts={company.contacts} reload={load} initial={jump ?? undefined} />}
      </div>

      {editCompany && <CompanyEditModal company={company} onClose={() => setEditCompany(false)} onSaved={() => { setEditCompany(false); load(); }} />}
      {contactModal && <ContactModal companyId={company.id} contact={contactModal.contact} onClose={() => setContactModal(null)} onSaved={() => { setContactModal(null); load(); }} />}
      {dealModal && <DealModal contactId={dealModal.contactId} onClose={() => setDealModal(null)} onSaved={() => { setDealModal(null); load(); }} />}
    </div>
  );
}

function KpiCell({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[12px] bg-slate-900 text-white px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1 text-white/60 text-[11px]">{icon}<span className="truncate">{label}</span></div>
      <div className="text-lg font-bold text-white tabular-nums mt-0.5 truncate">{value}</div>
      <div className="text-[10px] text-white/60 truncate">{sub}</div>
    </div>
  );
}

function SectionCard({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-[22px] min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-1.5">{title}{count != null && <span className="text-xs text-ink-subtle font-normal">{count}</span>}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type DealOpt = Agg['deals'];
function DealSelect({ deals, value, onChange }: { deals: DealOpt; value: number | ''; onChange: (v: number) => void }) {
  return (
    <select className="input text-sm" aria-label="안건" value={value} onChange={e => onChange(Number(e.target.value))}>
      <option value="">안건 선택…</option>
      {deals.map(d => <option key={d.id} value={d.id}>{d.title}{d.contactName ? ` · ${d.contactName}` : ''}</option>)}
    </select>
  );
}
function AddToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return <button onClick={onToggle} className="btn-ghost text-xs">{open ? <Icon name="x" className="w-3.5 h-3.5" /> : <Icon name="plus" className="w-3.5 h-3.5" />} {open ? '취소' : label}</button>;
}

// 노트·일정의 연결 대상 — 안건 또는 의뢰자(안건이 없어도 기록 가능). 값: "d:<id>" | "c:<id>"
function TargetSelect({ deals, contacts, value, onChange }: { deals: DealOpt; contacts: { id: number; name: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="input text-sm" aria-label="대상 (안건·의뢰자)" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">대상 선택 (안건·의뢰자)…</option>
      {deals.length > 0 && <optgroup label="안건">{deals.map(d => <option key={`d${d.id}`} value={`d:${d.id}`}>{d.title}{d.contactName ? ` · ${d.contactName}` : ''}</option>)}</optgroup>}
      {contacts.length > 0 && <optgroup label="의뢰자">{contacts.map(c => <option key={`c${c.id}`} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>}
    </select>
  );
}
const parseTarget = (t: string): { dealId?: number; contactId?: number } =>
  t.startsWith('d:') ? { dealId: Number(t.slice(2)) } : t.startsWith('c:') ? { contactId: Number(t.slice(2)) } : {};

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-ink-subtle">{children}</div>;
}

function DealLine({ d }: { d: Agg['deals'][number] }) {
  const st = STAGE[d.stage] ?? STAGE.INQUIRY;
  return (
    <Link href={`/deals/${d.id}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-slate-50/70 transition-colors">
      <span className="order-1 sm:order-none flex-1 min-w-0 text-sm text-ink truncate">
        {d.title}{d.modality && <span className="text-ink-subtle text-xs ml-1.5">{d.modality}</span>}
      </span>
      <div className="order-2 sm:order-none flex items-center gap-2 sm:contents">
        <span className="text-[11px] text-ink-subtle truncate sm:order-first">{d.contactName}</span>
        <span className={clsx('pill flex-shrink-0 ml-auto sm:ml-0', st.cls)}>{st.label}</span>
        {d.status === 'LOST' && <span className="pill bg-red-100 text-red-700 flex-shrink-0">중단</span>}
        {d.status === 'WON' && <span className="pill bg-emerald-100 text-emerald-700 flex-shrink-0">수주</span>}
        <span className="text-sm font-semibold text-ink tabular-nums whitespace-nowrap flex-shrink-0">{d.quoteAmount ? fmtWon(d.quoteAmount) : '—'}</span>
      </div>
    </Link>
  );
}

// ─── 개요 ───
function OverviewTab({ agg, company, tasks, reload, onGo, onAddContact, onEditContact }: {
  agg: Agg | null; company: Company; tasks: TaskT[]; reload: () => void;
  onGo: (t: Tab, opts?: { editId?: number; open?: boolean }) => void;
  onAddContact: () => void; onEditContact: (c: Contact) => void;
}) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  const activeDeals = agg.deals.filter(d => d.status === 'ACTIVE').slice(0, 5);
  const runningStudies = agg.studies.filter(s => !s.reportDraftIssuedAt).slice(0, 5);
  const recentNotes = agg.notes.slice(0, 4);
  const upcoming = agg.events.filter(e => !e.done && new Date(e.startAt) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 5);
  const openTasks = tasks.filter(t => !t.done).slice(0, 5);
  // 개요에서도 전용 탭과 같은 조작 — 완료 토글은 바로 반영, 수정은 해당 탭의 편집 폼으로
  const toggleEvent = async (e: Agg['events'][number]) => {
    const res = await fetch(`/api/crm/events/${e.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !e.done }) });
    if (res.ok) reload(); else toast.error('변경 실패');
  };
  const toggleTask = async (t: TaskT) => {
    const res = await fetch(`/api/crm/tasks/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !t.done }) });
    if (res.ok) reload(); else toast.error('변경 실패');
  };
  const More = ({ t }: { t: Tab }) => <button onClick={() => onGo(t)} className="text-[12px] text-brand-600 hover:underline">전체 보기</button>;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <SectionCard title="진행 중 딜" count={activeDeals.length} action={<More t="딜" />}>
        {activeDeals.length === 0 ? <Empty>진행 중인 딜이 없습니다.</Empty> : <div className="divide-y divide-slate-100">{activeDeals.map(d => <DealLine key={d.id} d={d} />)}</div>}
      </SectionCard>

      <SectionCard title="시험 진행" count={runningStudies.length} action={<More t="시험" />}>
        {runningStudies.length === 0 ? <Empty>진행 중인 시험이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {runningStudies.map(s => {
              const dd = dday(s.reportDraftDueAt);
              return (
                <li key={s.id}>
                  <Link href={`/deals/${s.dealId}`} className="flex items-center gap-2 py-2.5 -mx-2 px-2 rounded-lg hover:bg-slate-50/70" title="딜 상세에서 시험 정보 수정">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink truncate">{s.itemName || s.dealTitle}</span>
                      <span className="block text-[11px] text-ink-subtle truncate">{s.studyNumber ? `${s.studyNumber} · ` : ''}{s.director || '책임자 미정'}</span>
                    </span>
                    {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                    <Pencil className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="할 일" count={openTasks.length}
        action={<div className="flex items-center gap-2"><button onClick={() => onGo('할 일')} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 할 일 추가</button><More t="할 일" /></div>}>
        {openTasks.length === 0 ? <Empty>미완료 할 일이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {openTasks.map(t => {
              const dd = t.dueAt ? dday(t.dueAt) : null;
              return (
                <li key={t.id} className="flex items-center gap-2.5 py-2">
                  <button onClick={() => toggleTask(t)} role="checkbox" aria-checked={false} aria-label={`${t.title} 완료 처리`} className="w-[18px] h-[18px] rounded-md border border-slate-300 hover:border-brand-400 flex items-center justify-center shrink-0" title="완료 처리" />
                  <button onClick={() => onGo('할 일')} className="flex-1 min-w-0 text-left text-sm text-ink truncate hover:text-brand-600">{t.title}</button>
                  {(t.deal || t.contact) && <span className="text-[11px] text-ink-subtle truncate max-w-[120px]">{t.deal?.title ?? t.contact?.name}</span>}
                  {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="담당자" count={company.contacts.length}
        action={<div className="flex items-center gap-2"><button onClick={onAddContact} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 의뢰자 추가</button><More t="연락처" /></div>}>
        {company.contacts.length === 0 ? <Empty>등록된 의뢰자가 없습니다.</Empty> : (
          <ul className="space-y-1">
            {company.contacts.map(c => {
              const cq = agg.quotes.filter(q => q.contactId === c.id);
              return (
              <li key={c.id} className="flex items-center gap-2.5 py-1.5 -mx-2 px-2 rounded-lg hover:bg-slate-50/70 group">
                <button onClick={() => onEditContact(c)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left" title="의뢰자 정보 수정">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-600 font-bold text-xs flex-shrink-0">{c.name.charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink truncate">{c.name}{c.position && <span className="text-ink-subtle text-xs ml-1.5">{c.position}</span>}</span>
                    <span className="block text-[11px] text-ink-subtle truncate">{[c.email, c.phone].filter(Boolean).join(' · ') || '연락처 없음'}</span>
                  </span>
                </button>
                {cq.length > 0 && <button onClick={() => onGo('연락처')} className="pill bg-brand-100 text-brand-700 flex-shrink-0 hover:bg-brand-200" title="담당자별 견적 보기">견적 {cq.length}건</button>}
                <Pencil className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0 opacity-0 group-hover:opacity-100" />
              </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="예정 일정" count={upcoming.length}
        action={<div className="flex items-center gap-2"><button onClick={() => onGo('일정', { open: true })} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 일정 추가</button><More t="일정" /></div>}>
        {upcoming.length === 0 ? <Empty>예정된 일정이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map(e => {
              const dd = dday(e.startAt);
              return (
                <li key={e.id} className="flex items-center gap-2 py-2 group">
                  <button onClick={() => toggleEvent(e)} role="checkbox" aria-checked={false} aria-label={`${e.title} 완료 처리`} className="w-[18px] h-[18px] rounded-md border border-slate-300 hover:border-emerald-500 flex items-center justify-center shrink-0" title="완료 처리" />
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', EVENT_T[e.type] ?? 'bg-slate-300')} />
                  <button onClick={() => onGo('일정', { editId: e.id })} className="flex-1 min-w-0 text-left hover:text-brand-600" title="일정 수정">
                    <span className="block text-sm text-ink truncate">{e.title}</span>
                    <span className="block text-[11px] text-ink-subtle truncate">{fmtDate(e.startAt)}{e.location ? ` · ${e.location}` : ''}</span>
                  </button>
                  {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                  <Pencil className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0 opacity-0 group-hover:opacity-100" />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="최근 노트" count={recentNotes.length}
        action={<div className="flex items-center gap-2"><button onClick={() => onGo('노트', { open: true })} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 기록 추가</button><More t="노트" /></div>}>
        {recentNotes.length === 0 ? <Empty>기록된 노트가 없습니다.</Empty> : (
          <ul className="space-y-1">
            {recentNotes.map(n => (
              <li key={n.id}>
                <button onClick={() => onGo('노트', { editId: n.id })} className="w-full text-left text-sm py-2 -mx-2 px-2 rounded-lg hover:bg-slate-50/70 group" title="노트 수정">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={clsx('pill', (NOTE_T[n.type] ?? NOTE_T.MEMO).cls)}>{(NOTE_T[n.type] ?? NOTE_T.MEMO).label}</span>
                    <span className="text-[11px] text-ink-subtle">{fmtDate(n.occurredAt)}{(n.dealTitle || n.contactName) ? ` · ${n.dealTitle ?? n.contactName}` : ''}</span>
                    <Pencil className="w-3 h-3 text-ink-subtle ml-auto opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-ink-muted line-clamp-2">{n.title ? <span className="font-medium text-ink">{n.title} — </span> : null}{n.body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ─── 딜 ───
function DealsTab({ agg, contacts, onAddDeal }: { agg: Agg | null; contacts: { id: number; name: string }[]; onAddDeal: (contactId: number) => void }) {
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState<number | ''>('');
  if (!agg) return <Empty>불러오는 중…</Empty>;
  const start = () => {
    if (contacts.length === 1) { onAddDeal(contacts[0].id); return; }
    setOpen(v => !v);
  };
  return (
    <SectionCard title="전체 딜" count={agg.deals.length}
      action={contacts.length > 0 && <AddToggle open={open} onToggle={start} label="안건 추가" />}>
      {open && contacts.length > 1 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 flex gap-2">
          <select className="input text-sm" aria-label="의뢰자" value={cid} onChange={e => setCid(Number(e.target.value))}>
            <option value="">의뢰자 선택…</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => { if (!cid) { toast.error('의뢰자를 선택하세요.'); return; } setOpen(false); onAddDeal(cid); }} className="btn-primary text-sm shrink-0"><Icon name="plus" className="w-4 h-4" /> 만들기</button>
        </div>
      )}
      {agg.deals.length === 0 ? <Empty>등록된 딜이 없습니다.{contacts.length === 0 && ' 먼저 연락처 탭에서 의뢰자를 등록하세요.'}</Empty> : <div className="divide-y divide-slate-100">{agg.deals.map(d => <DealLine key={d.id} d={d} />)}</div>}
    </SectionCard>
  );
}

// ─── 연락처 ───
function ContactsTab({ company, quotes, onAdd, onEdit, onDel, onAddDeal }: {
  company: Company; quotes: QuoteRow[]; onAdd: () => void; onEdit: (c: Contact) => void; onDel: (id: number) => void; onAddDeal: (id: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-1.5">의뢰자 {company.contacts.length}명</h2>
        <button onClick={onAdd} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 의뢰자 추가</button>
      </div>
      {company.contacts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-subtle">등록된 의뢰자가 없습니다.</div>
      ) : company.contacts.map(ct => {
        // 담당자 기반 집계 — 이 의뢰자 명의로 저장된 견적(Quote.contactId). 금액은 공급가(VAT 별도)
        const ctQuotes = quotes.filter(q => q.contactId === ct.id);
        const ctQuoteSum = ctQuotes.reduce((s, q) => s + (q.supplyTotal ?? 0), 0);
        return (
        <div key={ct.id} className="card p-[22px] min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-ink flex items-center gap-2 flex-wrap">
                {ct.name}{ct.position && <span className="text-xs font-normal text-ink-subtle">{ct.position}</span>}
                {ctQuotes.length > 0 && <span className="pill bg-brand-100 text-brand-700">견적 {ctQuotes.length}건 · {fmtWonM(ctQuoteSum)} <span className="font-normal opacity-70">VAT 별도</span></span>}
              </div>
              <div className="text-xs text-ink-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {ct.email && <span className="inline-flex items-center gap-1 min-w-0"><Icon name="mail" className="w-3 h-3 flex-shrink-0" /><span className="truncate">{ct.email}</span></span>}
                {ct.phone && <span className="inline-flex items-center gap-1"><Icon name="phone" className="w-3 h-3" />{ct.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onEdit(ct)} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정" aria-label="수정"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDel(ct.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제" aria-label="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="mt-3 pl-1 space-y-1.5">
            {ct.deals.map(d => {
              const st = STAGE[d.stage] ?? STAGE.INQUIRY;
              return (
                <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center gap-2 py-1.5 px-2 -mx-1 rounded-lg hover:bg-slate-50/70">
                  <Briefcase className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{d.title}{d.modality && <span className="text-ink-subtle text-xs ml-1.5">{d.modality}</span>}</span>
                  <span className={clsx('pill flex-shrink-0', st.cls)}>{st.label}</span>
                  {d.status === 'LOST' && <span className="pill bg-red-100 text-red-700 flex-shrink-0">중단</span>}
                </Link>
              );
            })}
            {ctQuotes.map(q => (
              <Link key={`q-${q.id}`} href={`/quote/print?id=${q.id}`} className="flex items-center gap-2 py-1.5 px-2 -mx-1 rounded-lg hover:bg-slate-50/70">
                <Receipt className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
                <span className="font-mono text-[12px] text-brand-600 flex-shrink-0">{q.quoteNumber}</span>
                {q.supersededAt && <span className="pill bg-slate-200 text-ink-subtle flex-shrink-0">변경 전</span>}
                <span className="flex-1 min-w-0 text-xs text-ink-subtle truncate">{q.modality ?? ''}</span>
                <span className="text-sm font-semibold text-ink tabular-nums flex-shrink-0">{q.supplyTotal ? fmtWon(q.supplyTotal) : '—'}</span>
                <span className="text-[10px] text-ink-subtle flex-shrink-0">VAT 별도</span>
              </Link>
            ))}
            <button onClick={() => onAddDeal(ct.id)} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 py-1"><Icon name="plus" className="w-3.5 h-3.5" /> 안건 추가</button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ─── 계약 ───
function ContractsTab({ agg, deals, reload }: { agg: Agg | null; deals: DealOpt; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [dealId, setDealId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const noContractDeals = deals.filter(d => !(agg?.contracts ?? []).some(c => c.dealId === d.id));
  // 딜 없는 견적(임포트) → 계약 전환 대상
  const convertible = (agg?.quotes ?? []).filter((q) => !q.dealId && q.status !== 'REJECTED' && !q.supersededAt);   // 최신본만 전환 대상
  const convert = async (qid: number) => {
    setConvId(qid);
    const res = await fetch(`/api/crm/quotes/${qid}/to-contract`, { method: 'POST' });
    setConvId(null);
    if (res.ok) { toast.success('계약으로 전환 — 안건·계약 생성됨. 시험·노트 탭에서 이어서 관리하세요.'); reload(); }
    else toast.error('전환 실패');
  };
  const start = async () => {
    if (!dealId) { toast.error('안건을 선택하세요.'); return; }
    setBusy(true);
    const res = await fetch('/api/crm/contracts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId }) });
    setBusy(false);
    if (res.ok) { toast.success('계약 시작 — 기본 지급조건(선금50/잔금50) 생성'); setDealId(''); setOpen(false); reload(); } else toast.error('실패 — 견적이 있는 안건인지 확인하세요.');
  };
  if (!agg) return <Empty>불러오는 중…</Empty>;
  return (
    <SectionCard title="계약" count={agg.contracts.length}
      action={noContractDeals.length > 0 && <AddToggle open={open} onToggle={() => setOpen(v => !v)} label="계약 시작" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <p className="text-[11px] text-ink-subtle">견적 기반으로 계약을 시작합니다(선금 50% + 잔금 50%). 계약번호·회차는 딜 상세에서 편집.</p>
          <div className="flex gap-2">
            <DealSelect deals={noContractDeals} value={dealId} onChange={setDealId} />
            <button onClick={start} disabled={busy} className="btn-primary text-sm shrink-0">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 시작</button>
          </div>
        </div>
      )}
      {convertible.length > 0 && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <p className="text-[12px] font-medium text-ink mb-2">견적에서 계약 전환 <span className="text-ink-subtle font-normal">· 송부한 견적을 계약으로</span></p>
          <div className="space-y-1.5">
            {convertible.slice(0, 8).map((q) => (
              <div key={q.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[12px] text-brand-600 w-28 flex-shrink-0 truncate">{q.quoteNumber}</span>
                <span className="flex-1 min-w-0 text-ink-muted truncate">{q.contactName ? `${q.contactName} · ` : ''}{q.modality ?? ''}</span>
                <span className="text-[13px] font-semibold text-ink tabular-nums flex-shrink-0">{q.supplyTotal ? fmtWon(q.supplyTotal) : '—'}</span>
                <span className="text-[10px] text-ink-subtle flex-shrink-0">VAT 별도</span>
                <button onClick={() => convert(q.id)} disabled={convId === q.id} className="btn-ghost text-xs shrink-0">
                  {convId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />} 계약 전환
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {agg.contracts.length === 0 ? <Empty>등록된 계약이 없습니다.</Empty> : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
              <th scope="col" className="py-2 pr-2 font-medium">안건</th><th scope="col" className="py-2 px-2 font-medium w-32">계약번호</th>
              <th scope="col" className="py-2 px-2 font-medium w-20">상태</th><th scope="col" className="py-2 pl-2 font-medium w-24 text-right">체결일</th>
            </tr></thead>
            <tbody>
              {agg.contracts.map(c => {
                const st = CONTRACT_ST[c.status] ?? CONTRACT_ST.DRAFT;
                return (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-2"><Link href={`/deals/${c.dealId}`} className="text-ink hover:text-brand-600 truncate block max-w-[220px]">{c.dealTitle}</Link></td>
                    <td className="py-2.5 px-2 text-ink-muted tabular-nums">{c.contractNumber || '—'}</td>
                    <td className="py-2.5 px-2"><span className={clsx('pill', st.cls)}>{st.label}</span></td>
                    <td className="py-2.5 pl-2 text-right text-ink-muted tabular-nums">{fmtDate(c.signedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── 시험 ───
function StudiesTab({ agg, deals, reload }: { agg: Agg | null; deals: DealOpt; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ dealId: number | ''; itemName: string }>({ dealId: '', itemName: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!f.dealId || !f.itemName.trim()) { toast.error('안건·시험 항목명을 입력하세요.'); return; }
    setBusy(true);
    const res = await fetch('/api/crm/studies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId: f.dealId, itemName: f.itemName }) });
    setBusy(false);
    if (res.ok) { toast.success('시험 추가됨'); setF({ dealId: '', itemName: '' }); setOpen(false); reload(); } else toast.error('저장 실패');
  };
  if (!agg) return <Empty>불러오는 중…</Empty>;
  return (
    <SectionCard title="시험" count={agg.studies.length}
      action={deals.length > 0 && <AddToggle open={open} onToggle={() => setOpen(v => !v)} label="시험 추가" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <DealSelect deals={deals} value={f.dealId} onChange={v => setF(s => ({ ...s, dealId: v }))} />
          <input className="input text-sm w-full" placeholder="시험 항목명 (예: 설치류 13주 반복투여 독성)" aria-label="시험 항목명" value={f.itemName} onChange={e => setF(s => ({ ...s, itemName: e.target.value }))} />
          <div className="flex justify-end"><button onClick={add} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 추가</button></div>
        </div>
      )}
      {agg.studies.length === 0 ? <Empty>등록된 시험이 없습니다.{deals.length === 0 && <><br />견적을 계약으로 전환(계약 탭)하면 안건·계약·시험이 자동 생성됩니다.</>}</Empty> : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
              <th scope="col" className="py-2 pr-2 font-medium">시험 / 안건</th><th scope="col" className="py-2 px-2 font-medium w-24">시험번호</th>
              <th scope="col" className="py-2 px-2 font-medium w-20">책임자</th><th scope="col" className="py-2 px-2 font-medium w-24">보고서안 예정</th>
              <th scope="col" className="py-2 pl-2 font-medium w-16 text-right">상태</th>
            </tr></thead>
            <tbody>
              {agg.studies.map(s => {
                const dd = dday(s.reportDraftDueAt);
                return (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-2"><Link href={`/deals/${s.dealId}`} className="text-ink hover:text-brand-600 truncate block max-w-[200px]">{s.itemName || s.dealTitle}</Link></td>
                    <td className="py-2.5 px-2 text-ink-muted tabular-nums">{s.studyNumber || '—'}</td>
                    <td className="py-2.5 px-2 text-ink-muted">{s.director || '—'}</td>
                    <td className="py-2.5 px-2 text-ink-muted tabular-nums">{fmtDate(s.reportDraftDueAt)}</td>
                    <td className="py-2.5 pl-2 text-right">
                      {s.reportDraftIssuedAt ? <span className="pill bg-emerald-100 text-emerald-700">발행</span> : dd ? <span className={clsx('pill', dd.cls)}>{dd.label}</span> : <span className="pill tone-blue">진행</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── 노트 ───
function NotesTab({ agg, deals, contacts, reload, initial }: { agg: Agg | null; deals: DealOpt; contacts: { id: number; name: string }[]; reload: () => void; initial?: { editId?: number; open?: boolean } }) {
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };   // 로컬 기준 (UTC면 오전 9시 전 어제로 나옴)
  const EMPTY = { target: '', type: 'MEMO', title: '', body: '', occurredAt: today() };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [f, setF] = useState<{ target: string; type: string; title: string; body: string; occurredAt: string }>(EMPTY);
  const [busy, setBusy] = useState(false);
  const startEdit = (n: Agg['notes'][number]) => {
    setEditId(n.id);
    setF({ target: n.dealId ? `d:${n.dealId}` : n.contactId ? `c:${n.contactId}` : '', type: n.type, title: n.title ?? '', body: n.body, occurredAt: n.occurredAt.slice(0, 10) });
    setOpen(true);
  };
  const closeForm = () => { setOpen(false); setEditId(null); setF(EMPTY); };
  // 개요 카드에서 넘어온 지시(특정 노트 수정 / 추가 폼) — 1회 적용
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !initial || !agg) return;
    applied.current = true;
    if (initial.editId) { const n = agg.notes.find(x => x.id === initial.editId); if (n) startEdit(n); }
    else if (initial.open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, agg]);
  const save = async () => {
    const tgt = parseTarget(f.target);
    if ((!editId && !tgt.dealId && !tgt.contactId) || !f.body.trim()) { toast.error('대상·내용을 입력하세요.'); return; }
    setBusy(true);
    const payload = { ...tgt, type: f.type, title: f.title || null, body: f.body, occurredAt: f.occurredAt || undefined };
    const res = editId
      ? await fetch(`/api/crm/notes/${editId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/crm/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (res.ok) { toast.success(editId ? '기록 수정됨' : '기록 추가됨'); closeForm(); reload(); } else toast.error('저장 실패');
  };
  const del = async (id: number) => {
    if (!confirm('이 기록을 삭제할까요?')) return;
    const res = await fetch(`/api/crm/notes/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제됨'); if (editId === id) closeForm(); reload(); } else toast.error('삭제 실패');
  };
  if (!agg) return <Empty>불러오는 중…</Empty>;
  return (
    <SectionCard title="노트" count={agg.notes.length}
      action={(deals.length > 0 || contacts.length > 0) && <AddToggle open={open} onToggle={() => open ? closeForm() : setOpen(true)} label="기록 추가" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          {editId && <div className="pill bg-brand-100 text-brand-700 w-fit">기록 수정 중</div>}
          <div className="grid grid-cols-2 gap-2">
            <TargetSelect deals={deals} contacts={contacts} value={f.target} onChange={v => setF(s => ({ ...s, target: v }))} />
            <select className="input text-sm" aria-label="기록 유형" value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>{Object.entries(NOTE_T).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-ink-subtle">대화·미팅 날짜</span>
              <input type="date" className="input text-sm w-full" value={f.occurredAt} onChange={e => setF(s => ({ ...s, occurredAt: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-subtle">제목(선택)</span>
              <input className="input text-sm w-full" placeholder="제목(선택)" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} />
            </label>
          </div>
          <textarea className="input text-sm w-full min-h-[64px]" placeholder="내용" aria-label="내용" value={f.body} onChange={e => setF(s => ({ ...s, body: e.target.value }))} />
          <div className="flex justify-end gap-2">
            {editId && <button onClick={closeForm} className="btn-ghost text-sm">취소</button>}
            <button onClick={save} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editId ? '수정 저장' : '저장'}</button>
          </div>
        </div>
      )}
      {agg.notes.length === 0 ? <Empty>기록된 노트가 없습니다.</Empty> : (
        <ul className="space-y-4">
          {agg.notes.map(n => (
            <li key={n.id} className="relative pl-4 border-l-2 border-slate-100 group">
              <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-300" />
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className={clsx('pill', (NOTE_T[n.type] ?? NOTE_T.MEMO).cls)}>{(NOTE_T[n.type] ?? NOTE_T.MEMO).label}</span>
                <span className="text-[11px] text-ink-subtle">{fmtDate(n.occurredAt)}</span>
                {n.dealId
                  ? <Link href={`/deals/${n.dealId}`} className="text-[11px] text-brand-600 hover:underline truncate">{n.dealTitle}</Link>
                  : n.contactName && <span className="text-[11px] text-ink-subtle truncate">{n.contactName}</span>}
                <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(n)} className="p-1 rounded text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정" aria-label="수정"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(n.id)} className="p-1 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제" aria-label="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                </span>
              </div>
              {n.title && <div className="text-sm font-semibold text-ink">{n.title}</div>}
              <p className="text-sm text-ink-muted whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ─── 일정 ───
// ─── 할 일 (기업별 to-do — 일정(약속)과 구분되는 액션 아이템) ───
function TasksTab({ companyId, tasks, deals, contacts, reload }: { companyId: number; tasks: TaskT[]; deals: DealOpt; contacts: { id: number; name: string }[]; reload: () => void }) {
  const [f, setF] = useState({ title: '', dueAt: '', target: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!f.title.trim()) { toast.error('할 일 내용을 입력하세요.'); return; }
    setBusy(true);
    const tgt = parseTarget(f.target);
    const res = await fetch('/api/crm/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: f.title, dueAt: f.dueAt || null, companyId, ...tgt }) });
    setBusy(false);
    if (res.ok) { toast.success('할 일 추가됨'); setF({ title: '', dueAt: '', target: '' }); reload(); } else toast.error('추가 실패');
  };
  const patch = async (id: number, data: Record<string, unknown>) => {
    const res = await fetch(`/api/crm/tasks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) reload(); else toast.error('수정 실패');
  };
  const del = async (id: number) => { const res = await fetch(`/api/crm/tasks/${id}`, { method: 'DELETE' }); if (res.ok) reload(); else toast.error('삭제 실패'); };
  const open = tasks.filter(t => !t.done);
  const doneList = tasks.filter(t => t.done);
  const row = (t: TaskT) => {
    const dd = t.dueAt ? dday(t.dueAt) : null;
    return (
      <li key={t.id} className={clsx('flex items-center gap-2.5 py-2 group', t.done && 'opacity-50')}>
        <button onClick={() => patch(t.id, { done: !t.done })} role="checkbox" aria-checked={t.done} aria-label={`${t.title} 완료`}
          className={clsx('w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors', t.done ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 hover:border-brand-400')}>
          {t.done && <Icon name="check" className="w-3 h-3" />}
        </button>
        <input key={`tt-${t.id}-${t.title}`} aria-label="할 일 제목" className={clsx('flex-1 min-w-0 bg-transparent outline-none text-sm text-ink rounded px-1 -mx-1 focus:bg-slate-50', t.done && 'line-through text-ink-subtle')}
          defaultValue={t.title} onBlur={e => e.target.value.trim() && e.target.value !== t.title && patch(t.id, { title: e.target.value })} />
        {(t.deal || t.contact) && <span className="text-[11px] text-ink-subtle truncate max-w-[140px] shrink-0">{t.deal?.title ?? t.contact?.name}</span>}
        <input key={`td-${t.id}-${t.dueAt ?? ''}`} type="date" className="input text-xs w-auto shrink-0 py-1" title="기한" aria-label="기한" defaultValue={t.dueAt ? t.dueAt.slice(0, 10) : ''}
          onBlur={e => e.target.value !== (t.dueAt ? t.dueAt.slice(0, 10) : '') && patch(t.id, { dueAt: e.target.value || null })} />
        {!t.done && dd && <span className={clsx('pill shrink-0', dd.cls)}>{dd.label}</span>}
        <button onClick={() => del(t.id)} aria-label="할 일 삭제" className="p-1 rounded text-ink-subtle hover:text-red-600 opacity-0 group-hover:opacity-100 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
      </li>
    );
  };
  return (
    <SectionCard title="할 일" count={open.length}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <input className="input text-sm flex-1 min-w-[180px]" placeholder="할 일 추가 (예: 번역의뢰서 영문본 재요청)" aria-label="할 일 추가" value={f.title}
          onChange={e => setF(s => ({ ...s, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <input type="date" className="input text-sm w-auto" title="기한(선택)" aria-label="기한(선택)" value={f.dueAt} onChange={e => setF(s => ({ ...s, dueAt: e.target.value }))} />
        <select className="input text-sm w-auto max-w-[160px]" aria-label="대상(선택)" value={f.target} onChange={e => setF(s => ({ ...s, target: e.target.value }))}>
          <option value="">대상(선택)…</option>
          {deals.length > 0 && <optgroup label="안건">{deals.map(d => <option key={`d${d.id}`} value={`d:${d.id}`}>{d.title}</option>)}</optgroup>}
          {contacts.length > 0 && <optgroup label="의뢰자">{contacts.map(c => <option key={`c${c.id}`} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>}
        </select>
        <button onClick={add} disabled={busy} className="btn-primary text-sm shrink-0">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="plus" className="w-4 h-4" />} 추가</button>
      </div>
      {open.length === 0 && doneList.length === 0 ? <Empty>등록된 할 일이 없습니다. 위 입력창에서 바로 추가하세요.</Empty> : (
        <>
          <ul className="divide-y divide-slate-100">{open.map(row)}</ul>
          {doneList.length > 0 && (
            <details className="mt-3">
              <summary className="text-[12px] text-ink-subtle cursor-pointer select-none">완료 {doneList.length}건 보기</summary>
              <ul className="divide-y divide-slate-100 mt-1">{doneList.map(row)}</ul>
            </details>
          )}
        </>
      )}
    </SectionCard>
  );
}

const EMPTY_EVENT_FORM = { target: '', title: '', startAt: '', type: 'MEETING', location: '', attendeesClient: '', attendeesInternal: '', requests: '' };
function ScheduleTab({ agg, deals, contacts, reload, initial }: { agg: Agg | null; deals: DealOpt; contacts: { id: number; name: string }[]; reload: () => void; initial?: { editId?: number; open?: boolean } }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);   // 수정 중인 일정 id (null = 신규)
  const [f, setF] = useState<typeof EMPTY_EVENT_FORM>(EMPTY_EVENT_FORM);
  const [busy, setBusy] = useState(false);
  const startEdit = (e: Agg['events'][number]) => {
    setEditId(e.id);
    setF({
      target: e.dealId ? `d:${e.dealId}` : e.contactId ? `c:${e.contactId}` : '',
      title: e.title, startAt: e.startAt.slice(0, 10), type: e.type,
      location: e.location ?? '', attendeesClient: e.attendeesClient ?? '', attendeesInternal: e.attendeesInternal ?? '', requests: e.requests ?? '',
    });
    setOpen(true);
  };
  const closeForm = () => { setOpen(false); setEditId(null); setF(EMPTY_EVENT_FORM); };
  // 개요 카드에서 넘어온 지시(특정 일정 수정 / 추가 폼) — 1회 적용
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !initial || !agg) return;
    applied.current = true;
    if (initial.editId) { const e = agg.events.find(x => x.id === initial.editId); if (e) startEdit(e); }
    else if (initial.open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, agg]);
  const save = async () => {
    const tgt = parseTarget(f.target);
    if ((!editId && !tgt.dealId && !tgt.contactId) || !f.title.trim() || !f.startAt) { toast.error('대상·제목·날짜를 입력하세요.'); return; }
    setBusy(true);
    const payload = {
      // 수정 시 대상 전환(안건↔의뢰자)이 반영되도록 두 키를 모두 명시 (한쪽은 null 로 해제)
      ...(editId && (tgt.dealId || tgt.contactId) ? { dealId: tgt.dealId ?? null, contactId: tgt.contactId ?? null } : tgt),
      title: f.title, startAt: new Date(f.startAt).toISOString(), type: f.type, allDay: true,
      location: f.location, attendeesClient: f.attendeesClient, attendeesInternal: f.attendeesInternal, requests: f.requests,
    };
    const res = editId
      ? await fetch(`/api/crm/events/${editId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/crm/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (res.ok) { toast.success(editId ? '일정 수정됨' : '일정 추가됨'); closeForm(); reload(); } else toast.error('저장 실패');
  };
  const toggleDone = async (e: Agg['events'][number]) => {
    const res = await fetch(`/api/crm/events/${e.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !e.done }) });
    if (res.ok) reload(); else toast.error('변경 실패');
  };
  const del = async (id: number) => {
    if (!confirm('이 일정을 삭제할까요?')) return;
    const res = await fetch(`/api/crm/events/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제됨'); if (editId === id) closeForm(); reload(); } else toast.error('삭제 실패');
  };
  if (!agg) return <Empty>불러오는 중…</Empty>;
  const sorted = [...agg.events].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  return (
    <SectionCard title="일정" count={sorted.length}
      action={(deals.length > 0 || contacts.length > 0) && <AddToggle open={open} onToggle={() => open ? closeForm() : setOpen(true)} label="일정 추가" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          {editId && <div className="pill bg-brand-100 text-brand-700 w-fit">일정 수정 중</div>}
          <div className="grid grid-cols-2 gap-2">
            <TargetSelect deals={deals} contacts={contacts} value={f.target} onChange={v => setF(s => ({ ...s, target: v }))} />
            <select className="input text-sm" aria-label="일정 유형" value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>{['MEETING', 'DEADLINE', 'MILESTONE', 'REMINDER'].map(k => <option key={k} value={k}>{k === 'MEETING' ? '미팅' : k === 'DEADLINE' ? '마감' : k === 'MILESTONE' ? '마일스톤' : '리마인더'}</option>)}</select>
          </div>
          <input className="input text-sm w-full" placeholder="일정 제목" aria-label="일정 제목" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} />
          <label className="block">
            <span className="text-[11px] text-ink-subtle">날짜</span>
            <input type="date" className="input text-sm w-full" value={f.startAt} onChange={e => setF(s => ({ ...s, startAt: e.target.value }))} />
          </label>
          <EventDetailFields dense f={f} set={(k, v) => setF(s => ({ ...s, [k]: v }))} />
          <div className="flex justify-end gap-2">
            {editId && <button onClick={closeForm} className="btn-ghost text-sm">취소</button>}
            <button onClick={save} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editId ? '수정 저장' : '저장'}</button>
          </div>
        </div>
      )}
      {sorted.length === 0 ? <Empty>등록된 일정이 없습니다.</Empty> : (
        <ul className="divide-y divide-slate-100">
          {sorted.map(e => {
            const dd = dday(e.startAt);
            return (
              <li key={e.id} className={clsx('group flex items-center gap-2.5 py-2.5', e.done && 'opacity-50')}>
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', EVENT_T[e.type] ?? 'bg-slate-300')} />
                <span className="flex-1 min-w-0">
                  <span className={clsx('block text-sm text-ink truncate', e.done && 'line-through')}>{e.title}</span>
                  <span className="block text-[11px] text-ink-subtle">{fmtDate(e.startAt)}{(e.dealTitle || e.contactName) ? ` · ${e.dealTitle ?? e.contactName}` : ''}{e.location ? ` · ${e.location}` : ''}</span>
                  {(e.attendeesClient || e.attendeesInternal) && (
                    <span className="block text-[11px] text-ink-subtle truncate">
                      {[e.attendeesClient && `고객사: ${e.attendeesClient}`, e.attendeesInternal && `자사: ${e.attendeesInternal}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {e.requests && <span className="block text-[11px] text-ink-muted whitespace-pre-wrap mt-0.5">요청사항: {e.requests}</span>}
                </span>
                <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => toggleDone(e)} className="p-1.5 rounded-lg text-ink-subtle hover:text-emerald-600 hover:bg-emerald-50" title={e.done ? '완료 해제' : '완료 처리'} aria-label={e.done ? '완료 해제' : '완료 처리'}><Icon name="check" className="w-3.5 h-3.5" /></button>
                  <button onClick={() => startEdit(e)} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정" aria-label="수정"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(e.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제" aria-label="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                </span>
                {e.done ? <span className="pill bg-slate-200 text-ink-subtle flex-shrink-0">완료</span> : dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ════════════════ 모달 ════════════════
function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded-[12px] border border-slate-200 w-full max-w-md max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div id={titleId} className="font-semibold text-ink">{title}</div>
          <button onClick={onClose} aria-label="닫기" className="text-ink-subtle hover:text-ink"><Icon name="x" className="w-5 h-5" /></button>
        </header>
        <div className="px-5 py-4 space-y-3 overflow-auto">{children}</div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label mb-1">{label}</span>{children}</label>;
}

function CompanyEditModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: company.name, bizRegNo: company.bizRegNo ?? '', industry: company.industry ?? '', address: company.address ?? '', memo: company.memo ?? '', isNewClient: company.isNewClient });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) { toast.error('고객사명을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/companies/${company.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'fail'); toast.success('수정되었습니다.'); onSaved();
    } catch (e) { toast.error(`수정 실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setSaving(false); }
  };
  return (
    <Modal title="고객사 수정" onClose={onClose} footer={<><button onClick={onClose} className="btn-ghost text-sm">취소</button><button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장</button></>}>
      <Field label="고객사명 *"><input className="input w-full" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="사업자등록번호"><input className="input w-full" value={f.bizRegNo} onChange={e => set('bizRegNo', e.target.value)} /></Field>
        <Field label="업종"><input className="input w-full" value={f.industry} onChange={e => set('industry', e.target.value)} /></Field>
      </div>
      <Field label="주소"><input className="input w-full" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
      <Field label="메모"><textarea className="input w-full min-h-[60px]" value={f.memo} onChange={e => set('memo', e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer"><input type="checkbox" checked={f.isNewClient} onChange={e => set('isNewClient', e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />첫 거래 고객사</label>
    </Modal>
  );
}

function ContactModal({ companyId, contact, onClose, onSaved }: { companyId: number; contact: Contact | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: contact?.name ?? '', email: contact?.email ?? '', phone: contact?.phone ?? '', position: contact?.position ?? '', memo: contact?.memo ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) { toast.error('의뢰자명을 입력하세요.'); return; }
    setSaving(true);
    try {
      const url = contact ? `/api/crm/contacts/${contact.id}` : '/api/crm/contacts';
      const res = await fetch(url, { method: contact ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(contact ? f : { ...f, companyId }) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'fail'); toast.success(contact ? '수정되었습니다.' : '의뢰자가 추가되었습니다.'); onSaved();
    } catch (e) { toast.error(`실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setSaving(false); }
  };
  return (
    <Modal title={contact ? '의뢰자 수정' : '의뢰자 추가'} onClose={onClose} footer={<><button onClick={onClose} className="btn-ghost text-sm">취소</button><button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="이름 *"><input className="input w-full" value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
        <Field label="직책"><input className="input w-full" value={f.position} onChange={e => set('position', e.target.value)} /></Field>
      </div>
      <Field label="이메일"><input className="input w-full" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
      <Field label="연락처"><input className="input w-full" inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={e => set('phone', formatPhone(e.target.value))} /></Field>
      <Field label="메모"><textarea className="input w-full min-h-[60px]" value={f.memo} onChange={e => set('memo', e.target.value)} /></Field>
    </Modal>
  );
}

function DealModal({ contactId, onClose, onSaved }: { contactId: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', modality: '', indication: '', clinicalDesign: '', submissionTarget: '한국 (MFDS)', reportLanguage: 'KO' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const onTarget = (v: string) => setF(p => ({ ...p, submissionTarget: v, reportLanguage: /FDA|EMA|해외|영문/i.test(v) ? 'EN' : 'KO' }));
  const langId = useId();
  const save = async () => {
    if (!f.title.trim()) { toast.error('안건명을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/deals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, contactId }) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'fail'); toast.success('안건이 생성되었습니다.'); onSaved();
    } catch (e) { toast.error(`실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setSaving(false); }
  };
  return (
    <Modal title="새 안건" onClose={onClose} footer={<><button onClick={onClose} className="btn-ghost text-sm">취소</button><button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 생성</button></>}>
      <Field label="안건명 *"><input className="input w-full" value={f.title} onChange={e => set('title', e.target.value)} placeholder="예: OOO 13주 독성 견적" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="모달리티"><input className="input w-full" value={f.modality} onChange={e => set('modality', e.target.value)} placeholder="합성신약 등" /></Field>
        <Field label="적응증"><input className="input w-full" value={f.indication} onChange={e => set('indication', e.target.value)} /></Field>
      </div>
      <Field label="제출처">
        <select className="input w-full" value={f.submissionTarget} onChange={e => onTarget(e.target.value)}>
          <option>한국 (MFDS)</option><option>미국 (US FDA)</option><option>유럽 (EMA)</option>
        </select>
      </Field>
      <div role="group" aria-labelledby={langId}>
        <div id={langId} className="label mb-1">보고서 언어</div>
        <div className="flex gap-1.5">
          {(['KO', 'EN'] as const).map(l => <button key={l} onClick={() => set('reportLanguage', l)} aria-pressed={f.reportLanguage === l} className={clsx('chip', f.reportLanguage === l ? 'chip-active' : 'chip-inactive')}>{l === 'KO' ? '국문' : '영문'}</button>)}
          <span className="text-[11px] text-ink-subtle self-center ml-1">{f.reportLanguage === 'EN' ? '해외 제출 — 영문보고서(추가금 없음)' : ''}</span>
        </div>
      </div>
      <Field label="임상 예정 디자인"><textarea className="input w-full min-h-[60px]" value={f.clinicalDesign} onChange={e => set('clinicalDesign', e.target.value)} placeholder="투여경로·기간 등 임상 설계 메모" /></Field>
    </Modal>
  );
}
