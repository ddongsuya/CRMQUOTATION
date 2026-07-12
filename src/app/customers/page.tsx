'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Loader2, Building2, X, Save, Sparkles, GanttChartSquare, ArrowRight, Mail, Phone } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';

type Company = {
  id: number; name: string; bizRegNo: string | null; industry: string | null; address: string | null;
  isNewClient: boolean; updatedAt: string; _count: { contacts: number };
  dealCount: number; activeDeals: number; quoteCount: number; quoteAmount: number; wonAmount: number; vip: boolean;
};
type Seg = 'all' | 'vip' | 'new' | 'dormant';
const fmtM = (n: number) => (n >= 1e6 ? `₩${(n / 1e6).toFixed(1)}M` : n > 0 ? `₩${n.toLocaleString()}` : '₩0');
const isDormant = (c: Company) => c.activeDeals === 0 && !c.isNewClient;

export default function CustomersPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<Seg>('all');
  const [sel, setSel] = useState<number | null>(null);

  const load = () => fetch('/api/crm/companies').then(r => r.json()).then(d => { const cs = d.companies ?? []; setCompanies(cs); setSel(s => s ?? cs[0]?.id ?? null); }).catch(() => setCompanies([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (companies ?? []).filter(c => {
    if (q.trim() && !(c.name.toLowerCase().includes(q.toLowerCase()) || (c.industry ?? '').toLowerCase().includes(q.toLowerCase()))) return false;
    if (seg === 'vip') return c.vip;
    if (seg === 'new') return c.isNewClient;
    if (seg === 'dormant') return isDormant(c);
    return true;
  }), [companies, q, seg]);

  const segCount = useMemo(() => ({
    all: (companies ?? []).length,
    vip: (companies ?? []).filter(c => c.vip).length,
    new: (companies ?? []).filter(c => c.isNewClient).length,
    dormant: (companies ?? []).filter(isDormant).length,
  }), [companies]);
  const SEGS: [Seg, string][] = [['all', '전체'], ['vip', 'VIP'], ['new', '신규'], ['dormant', '휴면']];

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">고객 관리</h1>
          <p className="text-subhead text-ink-body mt-2">거래 고객사·담당자·견적 이력을 한 화면에서 관리하세요.</p>
        </div>
        <Link href="/quote-v2" className="btn-primary"><Icon name="plus" className="w-4 h-4" /> 견적 작성</Link>
      </div>

      {companies === null ? (
        <div className="card p-12 text-center text-ink-subtle text-sm">불러오는 중…</div>
      ) : companies.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-sm font-medium text-ink">아직 등록된 고객사가 없습니다.</div>
          <button onClick={() => setCreating(true)} className="btn-ghost mt-3"><Icon name="plus" className="w-3.5 h-3.5" /> 첫 고객사 등록</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4">
          {/* 좌: 마스터 카드 (검색 + 세그먼트 + 리스트) */}
          <div className="card overflow-hidden self-start">
            <div className="px-4 pt-[14px] pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5 h-[38px] px-[13px] rounded-lg bg-slate-50 border border-slate-200 mb-2.5">
                <Icon name="search" className="w-[15px] h-[15px] text-ink-subtle flex-shrink-0" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="회사명·담당자 검색" className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle outline-none" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SEGS.map(([k, l]) => (
                  <button key={k} onClick={() => setSeg(k)} className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-[5px] text-[12px] font-medium border transition-colors', seg === k ? 'bg-ink text-slate-50 border-ink' : 'text-ink-muted border-slate-200 hover:bg-slate-100')}>
                    {l} <span className={clsx('tabular-nums', seg === k ? 'text-slate-50/70' : 'text-ink-subtle')}>{segCount[k]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[calc(100vh-240px)] overflow-auto">
              {filtered.map(c => (
                <button key={c.id} onClick={() => setSel(c.id)} className={clsx('relative w-full text-left px-4 py-[13px] transition-colors flex items-center gap-3 border-b border-[var(--hairline-soft)]', sel === c.id ? 'bg-slate-100' : 'hover:bg-slate-100')}>
                  {sel === c.id && <span className="absolute left-0 top-[12px] bottom-[12px] w-0.5 rounded-full bg-brand-600" />}
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] bg-slate-100 text-ink-muted font-semibold text-[15px] shrink-0">{c.name.charAt(0)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink text-[15px] truncate">{c.name}</span>
                      {c.vip && <span className="badge-vip">VIP</span>}
                      {c.isNewClient && <span className="tag">신규</span>}
                    </div>
                    <div className="text-[12px] text-ink-subtle truncate mt-0.5">{c.industry || '업종 미지정'} · 견적 {c.quoteCount} · {fmtM(c.wonAmount)}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <div className="p-6 text-center text-xs text-ink-subtle">해당 조건의 고객사가 없습니다.</div>}
            </div>
          </div>

          {/* 우: 상세 패널 */}
          {sel ? <DetailPanel companyId={sel} /> : <div className="card p-12 text-center text-sm text-ink-subtle">고객사를 선택하세요.</div>}
        </div>
      )}

      {creating && <CompanyModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Agg = any;
function DetailPanel({ companyId }: { companyId: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<{ company: any; agg: Agg } | null>(null);
  const [scope, setScope] = useState<number | 'all'>('all'); // 'all'=회사 전체, number=담당자 스코프
  useEffect(() => { setData(null); setScope('all'); fetch(`/api/crm/companies/${companyId}`).then(r => r.json()).then(setData).catch(() => {}); }, [companyId]);
  if (!data) return <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;
  const { company: c, agg } = data;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const contacts: any[] = c.contacts ?? [];
  const scoped = (arr: any[]) => (scope === 'all' ? arr : arr.filter((x: any) => x.contactId === scope));
  const scopedDeals = scoped(agg?.deals ?? []);
  const scopedQuotes = scoped(agg?.quotes ?? []);
  const scopedNotes = scoped(agg?.notes ?? []);
  const scopedEvents = scoped(agg?.events ?? []);
  const dealIds = new Set(scopedDeals.map((d: any) => d.id));
  const scopedStudies = (agg?.studies ?? []).filter((s: any) => dealIds.has(s.dealId));
  const kpi = scope === 'all' ? (agg?.kpi ?? { wonAmount: 0, quoteAmount: 0, quoteCount: 0, dealCount: 0, activeDeals: 0, activeStudies: 0 }) : {
    wonAmount: scopedDeals.reduce((s: number, d: any) => s + (d.wonAmount ?? 0), 0),
    quoteAmount: scopedDeals.reduce((s: number, d: any) => s + (d.quoteAmount ?? 0), 0),
    quoteCount: scopedDeals.reduce((s: number, d: any) => s + (d.quoteCount ?? 0), 0),
    dealCount: scopedDeals.length,
    activeDeals: scopedDeals.filter((d: any) => d.status === 'ACTIVE').length,
    activeStudies: scopedStudies.filter((s: any) => !s.reportDraftIssuedAt).length,
  };
  const wonRate = kpi.quoteAmount > 0 ? Math.round((kpi.wonAmount / kpi.quoteAmount) * 100) : 0;
  const activeDeals = scopedDeals.filter((d: any) => d.status === 'ACTIVE');
  const nextEvent = [...scopedEvents].filter((e: any) => !e.done && new Date(e.startAt) >= new Date(new Date().toDateString())).sort((a: any, b: any) => +new Date(a.startAt) - +new Date(b.startAt))[0];
  const activeContact = scope === 'all' ? null : contacts.find(ct => ct.id === scope);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="space-y-4 min-w-0">
      {/* 프로필 헤더 + 담당자 탭 바(통합, 상단 노출) */}
      <div className="card overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-ink font-bold text-lg shrink-0">{c.name.charAt(0)}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-ink tracking-tight">{c.name}</h2>
                  {c.isNewClient && <span className="pill bg-brand-100 text-brand-700 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />신규</span>}
                </div>
                <div className="text-xs text-ink-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {c.industry && <span>{c.industry}</span>}{c.address && <span>{c.address}</span>}{c.bizRegNo && <span>사업자 {c.bizRegNo}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Link href={`/quote-v2?company=${encodeURIComponent(c.name)}`} className="btn-primary text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 이 고객으로 견적</Link>
              <Link href={`/gantt?company=${c.id}`} className="btn-outline text-xs"><GanttChartSquare className="w-3.5 h-3.5" /> 시험 일정 보기</Link>
              <Link href={`/customers/${c.id}`} className="btn-ghost text-xs">전체 관리 <ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          </div>
        </div>

        {/* 담당자 탭 바 — 회사 전체 ↔ 담당자별 (바로 판단 가능하게 헤더에 노출) */}
        {contacts.length > 0 && (
          <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/40">
            <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-ink-subtle mb-1.5 mt-2">담당자별 보기</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <TabBtn active={scope === 'all'} onClick={() => setScope('all')} icon={<Building2 className="w-3.5 h-3.5" />}>회사 전체</TabBtn>
              {contacts.map(ct => (
                <TabBtn key={ct.id} active={scope === ct.id} onClick={() => setScope(ct.id)} sub={ct.position}>{ct.name}</TabBtn>
              ))}
            </div>
            {activeContact && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-ink-muted">
                {activeContact.email ? <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{activeContact.email}</span> : null}
                {activeContact.phone ? <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{activeContact.phone}</span> : null}
                {!activeContact.email && !activeContact.phone && <span className="text-ink-subtle">연락처 미등록 — ‘전체 관리’에서 추가</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI — 누적수주 블랙 반전(#000) · 진행딜 · 견적 · 수주율 (시안 순서) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[12px] bg-ink px-[22px] py-5 text-white">
          <div className="text-[13px] font-medium text-white/85">누적 수주</div>
          <div className="text-stat tabular-nums mt-2.5">{fmtM(kpi.wonAmount)}</div>
        </div>
        <Kpi label="진행 딜" value={`${kpi.activeDeals}`} unit="건" sub={`전체 ${kpi.dealCount}`} />
        <Kpi label="견적" value={`${kpi.quoteCount}`} unit="건" sub={fmtM(kpi.quoteAmount)} />
        <Kpi label="수주율" value={`${wonRate}%`} sub={`진행 시험 ${kpi.activeStudies ?? 0}`} />
      </div>

      {/* 좌: 최근 견적 · 활동 | 우: 담당자 · 다음 팔로업(다크) */}
      <div className="grid xl:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4 min-w-0">
          {/* 최근 견적 */}
          <Card title="최근 견적" count={scopedQuotes.length}>
            {scopedQuotes.length === 0 ? <Empty>견적 이력이 없습니다.</Empty> : <div>
              {scopedQuotes.slice(0, 5).map((qq: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const st = QUOTE_STATUS[qq.status] ?? QUOTE_STATUS.DRAFT;
                return (
                  <Link key={qq.id} href={`/quote/print?id=${qq.id}`} className="flex items-center gap-2.5 py-2.5 border-t border-[var(--hairline-soft)] first:border-t-0 -mx-1 px-1 rounded hover:bg-slate-100">
                    <span className="font-mono text-[13px] text-brand-600 w-24 flex-shrink-0 truncate">{qq.quoteNumber}</span>
                    <span className="flex-1 min-w-0 text-[13px] text-ink-muted truncate">{qq.modality || qq.dealTitle}</span>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-body flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />{st.label}</span>
                    <span className="text-[15px] font-bold text-ink tabular-nums w-20 text-right flex-shrink-0">{fmtM(qq.grandTotal ?? 0)}</span>
                  </Link>
                );
              })}
            </div>}
          </Card>
          {/* 활동 (스코프 반영) */}
          <Card title="활동" count={scopedNotes.length}>
            {scopedNotes.length === 0 ? <Empty>기록된 활동이 없습니다.</Empty> : (
              <ul className="space-y-3">
                {(scopedNotes.slice(0, 5)).map((n: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <li key={n.id} className="relative pl-4 border-l-2 border-slate-200">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-500" />
                    <div className="text-[11px] text-ink-subtle">{new Date(n.occurredAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} · {n.dealTitle}</div>
                    {n.title && <div className="text-sm font-medium text-ink">{n.title}</div>}
                    <div className="text-sm text-ink-muted line-clamp-2">{n.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* 담당자 — 클릭 시 그 담당자로 스코프 */}
          <Card title="담당자" count={contacts.length}>
            {contacts.length === 0 ? <Empty>등록된 담당자가 없습니다.</Empty> : <div className="space-y-1">
              {contacts.map((ct: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <button key={ct.id} onClick={() => setScope(scope === ct.id ? 'all' : ct.id)} className={clsx('w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 transition-colors', scope === ct.id ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50')}>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-ink text-xs font-semibold shrink-0">{ct.name.charAt(0)}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm text-ink truncate">{ct.name}{ct.position ? ` · ${ct.position}` : ''}</span><span className="block text-[11px] text-ink-subtle truncate">{[ct.email, ct.phone].filter(Boolean).join(' · ') || '연락처 없음'}</span></span>
                  {scope === ct.id && <span className="pill bg-brand-600 text-white shrink-0">보는 중</span>}
                </button>
              ))}
            </div>}
          </Card>
          {/* 다음 팔로업 — 피처 다크 카드(#191919) */}
          <div className="rounded-[12px] bg-slate-900 p-[18px] text-white">
            <div className="text-[13px] text-white/60 mb-1.5 flex items-center gap-1.5"><Icon name="calendar" className="w-3.5 h-3.5" /> 다음 팔로업</div>
            {nextEvent ? <>
              <div className="text-[15px] font-semibold">{nextEvent.title}</div>
              <div className="text-[12px] text-white/60 mt-1">{new Date(nextEvent.startAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} · {nextEvent.dealTitle}</div>
            </> : <div className="text-sm text-white/50">예정된 팔로업이 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children, icon, sub }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode; sub?: string | null }) {
  return (
    <button onClick={onClick} className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
      active ? 'bg-[var(--card)] text-ink border-brand-300 ring-1 ring-brand-200' : 'bg-transparent text-ink-muted border-transparent hover:bg-white/70 hover:text-ink')}>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
      {icon}
      <span>{children}</span>
      {sub && <span className="text-[10px] text-ink-subtle font-normal">· {sub}</span>}
    </button>
  );
}
function Kpi({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return <div className="card pt-[22px] px-[22px] pb-5"><div className="text-[12.5px] font-semibold text-ink-muted mb-3">{label}</div><div className="flex items-baseline gap-1.5"><span className="text-kpi text-ink tabular-nums">{value}</span>{unit && <span className="text-[14px] text-ink-muted">{unit}</span>}</div>{sub && <div className="text-[12.5px] font-semibold text-ink-muted mt-2">{sub}</div>}</div>;
}
function Card({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return <section className="card p-[22px]"><div className="flex items-baseline gap-1.5 mb-3"><h3 className="text-[15px] font-semibold text-ink">{title}</h3>{count != null && <span className="text-[12px] text-ink-subtle tabular-nums">{count}</span>}</div>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) { return <div className="py-6 text-center text-xs text-ink-subtle">{children}</div>; }

// 견적 상태점 색(components.css)
const QUOTE_STATUS: Record<string, { label: string; dot: string }> = {
  DRAFT: { label: '작성중', dot: 'var(--muted-soft)' },
  ISSUED: { label: '발행', dot: 'var(--accent)' },
  SENT: { label: '발송', dot: 'var(--status-sent)' },
  ACCEPTED: { label: '수주', dot: 'var(--success)' },
  REJECTED: { label: '반려', dot: 'var(--error)' },
};

function CompanyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', bizRegNo: '', industry: '', address: '', memo: '', isNewClient: true });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) { toast.error('고객사명을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/companies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success('고객사가 등록되었습니다.'); onSaved();
    } catch (e) { toast.error(`등록 실패: ${e instanceof Error ? e.message : '알 수 없음'}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-ink">새 고객사</div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink"><X className="w-5 h-5" /></button>
        </header>
        <div className="px-5 py-4 space-y-3">
          <Field label="고객사명 *"><input className="input w-full" value={f.name} onChange={e => set('name', e.target.value)} placeholder="예: OOO제약" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="사업자등록번호"><input className="input w-full" value={f.bizRegNo} onChange={e => set('bizRegNo', e.target.value)} /></Field>
            <Field label="업종"><input className="input w-full" value={f.industry} onChange={e => set('industry', e.target.value)} /></Field>
          </div>
          <Field label="주소"><input className="input w-full" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
          <Field label="메모"><textarea className="input w-full min-h-[60px]" value={f.memo} onChange={e => set('memo', e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
            <input type="checkbox" checked={f.isNewClient} onChange={e => set('isNewClient', e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            첫 거래 고객사 (사업자등록증·통장사본 요청 대상)
          </label>
        </div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">취소</button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 등록</button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="label mb-1">{label}</div>{children}</div>;
}
