'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import {
  ArrowLeft, Loader2, Plus, Pencil, Trash2, X, Save, User, Mail, Phone, Briefcase,
  Sparkles, FileSignature, FlaskConical, NotebookPen, CalendarDays, Receipt,
} from 'lucide-react';
import { toast } from '@/lib/toast';

type Quote = { id: number; quoteNumber: string; status: string; grandTotal: number | null; createdAt: string };
type Contract = { id: number; status: string; contractNumber: string | null; signedAt: string | null; draftSentAt: string | null } & Record<string, unknown>;
type Study = { id: number; studyNumber: string | null; director: string | null; itemName: string | null; reportDraftDueAt: string | null; reportDraftIssuedAt: string | null } & Record<string, unknown>;
type Note = { id: number; type: string; title: string | null; body: string; occurredAt: string };
type EventT = { id: number; title: string; type: string; startAt: string; done: boolean };
type Deal = {
  id: number; title: string; modality: string | null; stage: string; status: string; updatedAt: string;
  quotes: Quote[]; contract: Contract | null; studies: Study[]; notes: Note[]; events: EventT[];
};
type Contact = { id: number; name: string; email: string | null; phone: string | null; position: string | null; memo: string | null; deals: Deal[] };
type Company = { id: number; name: string; bizRegNo: string | null; industry: string | null; address: string | null; isNewClient: boolean; memo: string | null; contacts: Contact[] };

type DealMeta = { dealId: number; dealTitle: string; modality: string | null; stage: string };
type Agg = {
  kpi: { quoteCount: number; quoteAmount: number; wonAmount: number; dealCount: number; activeDeals: number; activeStudies: number };
  deals: (DealMeta & { id: number; title: string; status: string; updatedAt: string; contactName: string; quoteCount: number; quoteAmount: number })[];
  contracts: (Contract & DealMeta)[];
  studies: (Study & DealMeta)[];
  notes: (Note & DealMeta & { contactName: string })[];
  events: (EventT & DealMeta)[];
};

const STAGE: Record<string, { label: string; cls: string }> = {
  INQUIRY: { label: '문의접수', cls: 'bg-slate-200 text-ink-muted' },
  QUOTE: { label: '견적', cls: 'bg-brand-100 text-brand-700' },
  INTAKE: { label: '시험접수', cls: 'bg-violet-100 text-violet-700' },
  CONTRACT: { label: '계약', cls: 'bg-amber-100 text-amber-800' },
  STUDY: { label: '시험진행', cls: 'bg-sky-100 text-sky-700' },
  INVOICE: { label: '세금계산서', cls: 'bg-emerald-100 text-emerald-700' },
  DONE: { label: '완료', cls: 'bg-emerald-100 text-emerald-700' },
};
const CONTRACT_ST: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '초안', cls: 'bg-slate-200 text-ink-muted' },
  SENT: { label: '송부', cls: 'bg-amber-100 text-amber-800' },
  REVIEWED: { label: '검토', cls: 'bg-sky-100 text-sky-700' },
  APPROVED: { label: '승인', cls: 'bg-brand-100 text-brand-700' },
  SIGNED: { label: '체결', cls: 'bg-emerald-100 text-emerald-700' },
};
const NOTE_T: Record<string, { label: string; cls: string }> = {
  MEETING: { label: '미팅', cls: 'bg-brand-100 text-brand-700' },
  CALL: { label: '통화', cls: 'bg-sky-100 text-sky-700' },
  MEMO: { label: '메모', cls: 'bg-slate-200 text-ink-muted' },
};
const EVENT_T: Record<string, string> = { MEETING: 'bg-brand-400', DEADLINE: 'bg-red-400', MILESTONE: 'bg-violet-400', REMINDER: 'bg-amber-400' };

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

const TABS = ['개요', '딜', '연락처', '계약', '시험', '노트', '일정'] as const;
type Tab = (typeof TABS)[number];

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [agg, setAgg] = useState<Agg | null>(null);
  const [tab, setTab] = useState<Tab>('개요');
  const [editCompany, setEditCompany] = useState(false);
  const [contactModal, setContactModal] = useState<{ contact: Contact | null } | null>(null);
  const [dealModal, setDealModal] = useState<{ contactId: number } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/crm/companies/${id}`).then(r => r.json()).then(d => { setCompany(d.company ?? null); setAgg(d.agg ?? null); }).catch(() => {});
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const delContact = async (cid: number) => {
    if (!confirm('이 의뢰자와 연결된 안건도 삭제됩니다. 계속할까요?')) return;
    const res = await fetch(`/api/crm/contacts/${cid}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다.'); load(); } else toast.error('삭제 실패');
  };

  const firstContactId = company?.contacts[0]?.id;
  const tabCount: Record<Tab, number | null> = useMemo(() => ({
    개요: null, 딜: agg?.deals.length ?? 0, 연락처: company?.contacts.length ?? 0,
    계약: agg?.contracts.length ?? 0, 시험: agg?.studies.length ?? 0, 노트: agg?.notes.length ?? 0, 일정: agg?.events.filter(e => !e.done).length ?? 0,
  }), [agg, company]);

  if (!company) return <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/customers" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"><ArrowLeft className="w-3.5 h-3.5" /> 고객 관리</Link>

      {/* 고객사 헤더 + KPI */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 font-bold text-lg flex-shrink-0">{company.name.charAt(0)}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-ink break-keep">{company.name}</h1>
                {company.isNewClient && <span className="pill bg-amber-100 text-amber-800 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />첫거래</span>}
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
            {firstContactId && <button onClick={() => setDealModal({ contactId: firstContactId })} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> 안건</button>}
          </div>
        </div>

        {agg && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <KpiCell icon={<Receipt className="w-3.5 h-3.5" />} label="누적 견적" value={fmtWonM(agg.kpi.quoteAmount)} sub={`${agg.kpi.quoteCount}건`} />
            <KpiCell icon={<FileSignature className="w-3.5 h-3.5" />} label="수주" value={fmtWonM(agg.kpi.wonAmount)} sub={`진행 딜 ${agg.kpi.activeDeals}`} />
            <KpiCell icon={<FlaskConical className="w-3.5 h-3.5" />} label="진행 시험" value={`${agg.kpi.activeStudies}건`} sub={`전체 ${agg.kpi.dealCount} 안건`} />
          </div>
        )}
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto -mx-1 px-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx('px-3.5 py-2 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5',
              tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {t}
            {tabCount[t] != null && <span className={clsx('text-[10px] tabular-nums px-1.5 rounded-full', tab === t ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-ink-subtle')}>{tabCount[t]}</span>}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      {tab === '개요' && <OverviewTab agg={agg} company={company} />}
      {tab === '딜' && <DealsTab agg={agg} />}
      {tab === '연락처' && (
        <ContactsTab company={company} onAdd={() => setContactModal({ contact: null })} onEdit={c => setContactModal({ contact: c })} onDel={delContact} onAddDeal={cid => setDealModal({ contactId: cid })} />
      )}
      {tab === '계약' && <ContractsTab agg={agg} />}
      {tab === '시험' && <StudiesTab agg={agg} />}
      {tab === '노트' && <NotesTab agg={agg} />}
      {tab === '일정' && <ScheduleTab agg={agg} />}

      {editCompany && <CompanyEditModal company={company} onClose={() => setEditCompany(false)} onSaved={() => { setEditCompany(false); load(); }} />}
      {contactModal && <ContactModal companyId={company.id} contact={contactModal.contact} onClose={() => setContactModal(null)} onSaved={() => { setContactModal(null); load(); }} />}
      {dealModal && <DealModal contactId={dealModal.contactId} onClose={() => setDealModal(null)} onSaved={() => { setDealModal(null); load(); }} />}
    </div>
  );
}

function KpiCell({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-slate-50/70 border border-slate-100 px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1 text-ink-subtle text-[11px]">{icon}<span className="truncate">{label}</span></div>
      <div className="text-lg font-bold text-ink tabular-nums mt-0.5 truncate">{value}</div>
      <div className="text-[10px] text-ink-subtle truncate">{sub}</div>
    </div>
  );
}

function SectionCard({ title, icon, count, children, action }: { title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">{icon} {title}{count != null && <span className="text-xs text-ink-subtle font-normal">{count}</span>}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

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
function OverviewTab({ agg, company }: { agg: Agg | null; company: Company }) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  const activeDeals = agg.deals.filter(d => d.status === 'ACTIVE').slice(0, 5);
  const runningStudies = agg.studies.filter(s => !s.reportDraftIssuedAt).slice(0, 5);
  const recentNotes = agg.notes.slice(0, 4);
  const upcoming = agg.events.filter(e => !e.done && new Date(e.startAt) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 5);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <SectionCard title="진행 중 딜" icon={<Briefcase className="w-4 h-4 text-brand-500" />} count={activeDeals.length}>
        {activeDeals.length === 0 ? <Empty>진행 중인 딜이 없습니다.</Empty> : <div className="divide-y divide-slate-100">{activeDeals.map(d => <DealLine key={d.id} d={d} />)}</div>}
      </SectionCard>

      <SectionCard title="시험 진행" icon={<FlaskConical className="w-4 h-4 text-brand-500" />} count={runningStudies.length}>
        {runningStudies.length === 0 ? <Empty>진행 중인 시험이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {runningStudies.map(s => {
              const dd = dday(s.reportDraftDueAt);
              return (
                <li key={s.id} className="flex items-center gap-2 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink truncate">{s.itemName || s.dealTitle}</span>
                    <span className="block text-[11px] text-ink-subtle truncate">{s.studyNumber ? `${s.studyNumber} · ` : ''}{s.director || '책임자 미정'}</span>
                  </span>
                  {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="담당자" icon={<User className="w-4 h-4 text-brand-500" />} count={company.contacts.length}>
        {company.contacts.length === 0 ? <Empty>등록된 의뢰자가 없습니다.</Empty> : (
          <ul className="space-y-2.5">
            {company.contacts.map(c => (
              <li key={c.id} className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-600 font-bold text-xs flex-shrink-0">{c.name.charAt(0)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink truncate">{c.name}{c.position && <span className="text-ink-subtle text-xs ml-1.5">{c.position}</span>}</span>
                  <span className="block text-[11px] text-ink-subtle truncate">{[c.email, c.phone].filter(Boolean).join(' · ') || '연락처 없음'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="예정 일정" icon={<CalendarDays className="w-4 h-4 text-brand-500" />} count={upcoming.length}>
        {upcoming.length === 0 ? <Empty>예정된 일정이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map(e => {
              const dd = dday(e.startAt);
              return (
                <li key={e.id} className="flex items-center gap-2 py-2.5">
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', EVENT_T[e.type] ?? 'bg-slate-300')} />
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{e.title}</span>
                  {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="최근 노트" icon={<NotebookPen className="w-4 h-4 text-brand-500" />} count={recentNotes.length}>
        {recentNotes.length === 0 ? <Empty>기록된 노트가 없습니다.</Empty> : (
          <ul className="space-y-3">
            {recentNotes.map(n => (
              <li key={n.id} className="text-sm">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={clsx('pill', (NOTE_T[n.type] ?? NOTE_T.MEMO).cls)}>{(NOTE_T[n.type] ?? NOTE_T.MEMO).label}</span>
                  <span className="text-[11px] text-ink-subtle">{fmtDate(n.occurredAt)} · {n.dealTitle}</span>
                </div>
                <p className="text-ink-muted line-clamp-2">{n.title ? <span className="font-medium text-ink">{n.title} — </span> : null}{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ─── 딜 ───
function DealsTab({ agg }: { agg: Agg | null }) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  return (
    <SectionCard title="전체 딜" icon={<Briefcase className="w-4 h-4 text-brand-500" />} count={agg.deals.length}>
      {agg.deals.length === 0 ? <Empty>등록된 딜이 없습니다.</Empty> : <div className="divide-y divide-slate-100">{agg.deals.map(d => <DealLine key={d.id} d={d} />)}</div>}
    </SectionCard>
  );
}

// ─── 연락처 ───
function ContactsTab({ company, onAdd, onEdit, onDel, onAddDeal }: {
  company: Company; onAdd: () => void; onEdit: (c: Contact) => void; onDel: (id: number) => void; onAddDeal: (id: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink flex items-center gap-1.5"><User className="w-4 h-4 text-brand-500" /> 의뢰자 {company.contacts.length}명</h2>
        <button onClick={onAdd} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 의뢰자 추가</button>
      </div>
      {company.contacts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-subtle">등록된 의뢰자가 없습니다.</div>
      ) : company.contacts.map(ct => (
        <div key={ct.id} className="card p-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-ink flex items-center gap-2 flex-wrap">{ct.name}{ct.position && <span className="text-xs font-normal text-ink-subtle">{ct.position}</span>}</div>
              <div className="text-xs text-ink-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {ct.email && <span className="inline-flex items-center gap-1 min-w-0"><Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{ct.email}</span></span>}
                {ct.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{ct.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onEdit(ct)} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDel(ct.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
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
            <button onClick={() => onAddDeal(ct.id)} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 py-1"><Plus className="w-3.5 h-3.5" /> 안건 추가</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 계약 ───
function ContractsTab({ agg }: { agg: Agg | null }) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  return (
    <SectionCard title="계약" icon={<FileSignature className="w-4 h-4 text-brand-500" />} count={agg.contracts.length}>
      {agg.contracts.length === 0 ? <Empty>등록된 계약이 없습니다.</Empty> : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
              <th className="py-2 pr-2 font-medium">안건</th><th className="py-2 px-2 font-medium w-32">계약번호</th>
              <th className="py-2 px-2 font-medium w-20">상태</th><th className="py-2 pl-2 font-medium w-24 text-right">체결일</th>
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
function StudiesTab({ agg }: { agg: Agg | null }) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  return (
    <SectionCard title="시험" icon={<FlaskConical className="w-4 h-4 text-brand-500" />} count={agg.studies.length}>
      {agg.studies.length === 0 ? <Empty>등록된 시험이 없습니다.</Empty> : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
              <th className="py-2 pr-2 font-medium">시험 / 안건</th><th className="py-2 px-2 font-medium w-24">시험번호</th>
              <th className="py-2 px-2 font-medium w-20">책임자</th><th className="py-2 px-2 font-medium w-24">보고서안 예정</th>
              <th className="py-2 pl-2 font-medium w-16 text-right">상태</th>
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
                      {s.reportDraftIssuedAt ? <span className="pill bg-emerald-100 text-emerald-700">발행</span> : dd ? <span className={clsx('pill', dd.cls)}>{dd.label}</span> : <span className="pill bg-sky-100 text-sky-700">진행</span>}
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
function NotesTab({ agg }: { agg: Agg | null }) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  return (
    <SectionCard title="노트" icon={<NotebookPen className="w-4 h-4 text-brand-500" />} count={agg.notes.length}>
      {agg.notes.length === 0 ? <Empty>기록된 노트가 없습니다.</Empty> : (
        <ul className="space-y-4">
          {agg.notes.map(n => (
            <li key={n.id} className="relative pl-4 border-l-2 border-slate-100">
              <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-300" />
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className={clsx('pill', (NOTE_T[n.type] ?? NOTE_T.MEMO).cls)}>{(NOTE_T[n.type] ?? NOTE_T.MEMO).label}</span>
                <span className="text-[11px] text-ink-subtle">{fmtDate(n.occurredAt)}</span>
                <Link href={`/deals/${n.dealId}`} className="text-[11px] text-brand-600 hover:underline truncate">{n.dealTitle}</Link>
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
function ScheduleTab({ agg }: { agg: Agg | null }) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  const sorted = [...agg.events].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  return (
    <SectionCard title="일정" icon={<CalendarDays className="w-4 h-4 text-brand-500" />} count={sorted.length}>
      {sorted.length === 0 ? <Empty>등록된 일정이 없습니다.</Empty> : (
        <ul className="divide-y divide-slate-100">
          {sorted.map(e => {
            const dd = dday(e.startAt);
            return (
              <li key={e.id} className={clsx('flex items-center gap-2.5 py-2.5', e.done && 'opacity-50')}>
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', EVENT_T[e.type] ?? 'bg-slate-300')} />
                <span className="flex-1 min-w-0">
                  <span className={clsx('block text-sm text-ink truncate', e.done && 'line-through')}>{e.title}</span>
                  <span className="block text-[11px] text-ink-subtle">{fmtDate(e.startAt)} · {e.dealTitle}</span>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-ink">{title}</div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink"><X className="w-5 h-5" /></button>
        </header>
        <div className="px-5 py-4 space-y-3 overflow-auto">{children}</div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="label mb-1">{label}</div>{children}</div>;
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
      <Field label="연락처"><input className="input w-full" value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
      <Field label="메모"><textarea className="input w-full min-h-[60px]" value={f.memo} onChange={e => set('memo', e.target.value)} /></Field>
    </Modal>
  );
}

function DealModal({ contactId, onClose, onSaved }: { contactId: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', modality: '', indication: '', clinicalDesign: '', submissionTarget: '한국 (MFDS)', reportLanguage: 'KO' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const onTarget = (v: string) => setF(p => ({ ...p, submissionTarget: v, reportLanguage: /FDA|EMA|해외|영문/i.test(v) ? 'EN' : 'KO' }));
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
      <Field label="보고서 언어">
        <div className="flex gap-1.5">
          {(['KO', 'EN'] as const).map(l => <button key={l} onClick={() => set('reportLanguage', l)} className={clsx('chip', f.reportLanguage === l ? 'chip-active' : 'chip-inactive')}>{l === 'KO' ? '국문' : '영문'}</button>)}
          <span className="text-[11px] text-ink-subtle self-center ml-1">{f.reportLanguage === 'EN' ? '해외 제출 — 영문보고서(추가금 없음)' : ''}</span>
        </div>
      </Field>
      <Field label="임상 예정 디자인"><textarea className="input w-full min-h-[60px]" value={f.clinicalDesign} onChange={e => set('clinicalDesign', e.target.value)} placeholder="투여경로·기간 등 임상 설계 메모" /></Field>
    </Modal>
  );
}
