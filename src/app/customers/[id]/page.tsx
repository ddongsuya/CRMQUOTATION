'use client';

import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { Loader2, Pencil, Sparkles, FileSignature, FlaskConical, Receipt } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { fmtWonM } from '@/components/customer/shared';
import { CompanyEditModal, ContactModal, DealModal } from '@/components/customer/modals';
import OverviewTab from '@/components/customer/tabs/OverviewTab';
import TasksTab from '@/components/customer/tabs/TasksTab';
import DealsTab from '@/components/customer/tabs/DealsTab';
import ContactsTab from '@/components/customer/tabs/ContactsTab';
import ContractsTab from '@/components/customer/tabs/ContractsTab';
import StudiesTab from '@/components/customer/tabs/StudiesTab';
import NotesTab from '@/components/customer/tabs/NotesTab';
import ScheduleTab from '@/components/customer/tabs/ScheduleTab';
import { TABS, TAB_TO_ALIAS, parseTab, type Agg, type Company, type Contact, type JumpOpts, type Tab, type TaskT } from '@/components/customer/types';

// useSearchParams 는 Suspense 경계가 필요하다(quote/print 와 같은 패턴)
export default function CompanyDetailPage() {
  return <Suspense fallback={null}><CompanyDetail /></Suspense>;
}

function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [agg, setAgg] = useState<Agg | null>(null);
  // 초기 탭은 URL `?tab=` (한글 키·영문 별칭 모두 허용 — 전역 검색이 ?tab=contacts|notes|tasks 로 연결)
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')) ?? '개요');
  const [editCompany, setEditCompany] = useState(false);
  const [contactModal, setContactModal] = useState<{ contact: Contact | null } | null>(null);
  const [dealModal, setDealModal] = useState<{ contactId: number } | null>(null);
  const [tasks, setTasks] = useState<TaskT[]>([]);
  // 개요 카드·타임라인에서 "특정 항목 수정/추가 폼 열기"로 탭을 넘길 때 전달하는 1회성 지시
  const [jump, setJump] = useState<JumpOpts | null>(null);
  const goTo = (t: Tab, opts?: JumpOpts) => { setJump(opts ?? null); setTab(t); };
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

  // 탭 ↔ URL 동기화. 탭이 바뀌면 ?tab= 를 영문 별칭으로 replace(히스토리 누적 없음), 외부에서 URL 이 바뀌면 탭을 따라간다.
  const urlTab = searchParams.get('tab');
  useEffect(() => {
    const fromUrl = parseTab(urlTab);
    if (fromUrl && fromUrl !== tab) { setJump(null); setTab(fromUrl); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);
  useEffect(() => {
    const alias = TAB_TO_ALIAS[tab];
    if (parseTab(urlTab) === tab) return;
    const sp = new URLSearchParams(searchParams.toString());
    if (tab === '개요') sp.delete('tab'); else sp.set('tab', alias);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
      {tab === '할 일' && <TasksTab companyId={company.id} tasks={tasks} deals={agg?.deals ?? []} contacts={company.contacts} reload={load} initial={jump ?? undefined} />}
      {tab === '딜' && <DealsTab agg={agg} contacts={company.contacts} onAddDeal={cid => setDealModal({ contactId: cid })} onAddContact={() => setContactModal({ contact: null })} />}
      {tab === '연락처' && (
        <ContactsTab company={company} quotes={agg?.quotes ?? []} onAdd={() => setContactModal({ contact: null })} onEdit={c => setContactModal({ contact: c })} onDel={delContact} onAddDeal={cid => setDealModal({ contactId: cid })} />
      )}
      {tab === '계약' && <ContractsTab agg={agg} deals={agg?.deals ?? []} reload={load} />}
      {tab === '시험' && <StudiesTab agg={agg} deals={agg?.deals ?? []} reload={load} />}
      {tab === '노트' && <NotesTab agg={agg} companyId={company.id} deals={agg?.deals ?? []} contacts={company.contacts} reload={load} initial={jump ?? undefined} />}
      {tab === '일정' && <ScheduleTab agg={agg} companyId={company.id} deals={agg?.deals ?? []} contacts={company.contacts} reload={load} initial={jump ?? undefined} />}
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
