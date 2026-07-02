'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Users, Plus, Loader2, Building2, X, Save, Sparkles, Search, GanttChartSquare, ArrowRight, Briefcase, Receipt, FlaskConical, NotebookPen, CalendarDays, User, Mail, Phone } from 'lucide-react';
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

  const SEGS: [Seg, string][] = [['all', '전체'], ['vip', 'VIP'], ['new', '신규'], ['dormant', '휴면']];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-brand-500" /> 고객 관리</h1>
          <p className="text-sm text-ink-muted mt-0.5">고객사·의뢰자·거래 현황을 한 화면에서 관리합니다.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="w-4 h-4" /> 새 고객사</button>
      </div>

      {companies === null ? (
        <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>
      ) : companies.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 text-brand-400 mb-3"><Building2 className="w-6 h-6" /></div>
          <div className="text-sm font-medium text-ink">아직 등록된 고객사가 없습니다.</div>
          <button onClick={() => setCreating(true)} className="btn-ghost text-xs mt-3"><Plus className="w-3.5 h-3.5" /> 첫 고객사 등록</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
          {/* 좌: 검색 + 세그먼트 + 리스트 */}
          <div className="space-y-2 self-start">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="회사명·업종 검색" className="input pl-9 w-full" />
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs w-full">
              {SEGS.map(([k, l]) => <button key={k} onClick={() => setSeg(k)} className={clsx('flex-1 px-2 py-1.5 rounded-md font-medium transition-colors', seg === k ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}>{l}</button>)}
            </div>
            <div className="card p-2 max-h-[calc(100vh-240px)] overflow-auto">
              {filtered.map(c => (
                <button key={c.id} onClick={() => setSel(c.id)} className={clsx('w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-2.5', sel === c.id ? 'bg-slate-100' : 'hover:bg-slate-50')}>
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-ink font-bold text-sm shrink-0">{c.name.charAt(0)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink text-sm truncate">{c.name}</span>
                      {c.vip && <span className="pill bg-brand-600 text-white">VIP</span>}
                      {c.isNewClient && <span className="pill bg-brand-100 text-brand-700">신규</span>}
                    </div>
                    <div className="text-[11px] text-ink-subtle truncate">{c.industry || '업종 미지정'}</div>
                    <div className="text-[11px] text-ink-muted mt-0.5 flex items-center gap-1.5 tabular-nums">
                      <span>딜 {c.activeDeals}</span><span className="text-ink-subtle/40">·</span><span>견적 {c.quoteCount}</span><span className="text-ink-subtle/40">·</span><span className="text-brand-600 font-medium">{fmtM(c.wonAmount)}</span>
                    </div>
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

      {/* KPI — 누적수주 블랙 반전 (스코프 반영) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-900 p-4 text-white">
          <div className="text-xs text-white/60 mb-1">누적 수주</div>
          <div className="text-xl font-bold tabular-nums tracking-tight">{fmtM(kpi.wonAmount)}</div>
          <div className="text-[11px] text-white/60 mt-0.5">수주율 {wonRate}%</div>
        </div>
        <Kpi label="진행 딜" value={`${kpi.activeDeals}`} unit="건" sub={`전체 ${kpi.dealCount}`} />
        <Kpi label="누적 견적" value={fmtM(kpi.quoteAmount)} sub={`${kpi.quoteCount}건`} />
        <Kpi label="진행 시험" value={`${kpi.activeStudies ?? 0}`} unit="건" sub="보고서 발행 전" />
      </div>

      <div className="grid xl:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4 min-w-0">
          {/* 진행 중 딜 */}
          <Card icon={<Briefcase className="w-4 h-4 text-brand-500" />} title="진행 중 딜" count={activeDeals.length}>
            {activeDeals.length === 0 ? <Empty>진행 중인 딜이 없습니다.</Empty> : <div className="divide-y divide-slate-100">
              {activeDeals.map((d: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center gap-2 py-2 hover:bg-slate-50/60 -mx-2 px-2 rounded">
                  <span className="flex-1 min-w-0"><span className="block text-sm text-ink truncate">{d.title}</span><span className="block text-[11px] text-ink-subtle">{d.modality || '모달리티 미정'} · {d.contactName}</span></span>
                  <span className="text-sm font-semibold text-ink tabular-nums">{d.quoteAmount ? fmtM(d.quoteAmount) : '—'}</span>
                </Link>
              ))}
            </div>}
          </Card>
          {/* 최근 활동 (스코프 반영) */}
          <Card icon={<NotebookPen className="w-4 h-4 text-brand-500" />} title="최근 활동" count={scopedNotes.length}>
            {scopedNotes.length === 0 ? <Empty>기록된 활동이 없습니다.</Empty> : (
              <ul className="space-y-3">
                {(scopedNotes.slice(0, 5)).map((n: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <li key={n.id} className="relative pl-4 border-l-2 border-slate-100">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-300" />
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
          {/* 다음 팔로업 — 다크 카드 */}
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <div className="text-xs text-white/60 mb-1.5 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> 다음 팔로업</div>
            {nextEvent ? <>
              <div className="text-sm font-semibold">{nextEvent.title}</div>
              <div className="text-[11px] text-white/60 mt-0.5">{new Date(nextEvent.startAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} · {nextEvent.dealTitle}</div>
            </> : <div className="text-sm text-white/50">예정된 팔로업이 없습니다.</div>}
          </div>
          {/* 담당자 — 클릭 시 그 담당자로 스코프 */}
          <Card icon={<User className="w-4 h-4 text-brand-500" />} title="담당자" count={contacts.length}>
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
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children, icon, sub }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode; sub?: string | null }) {
  return (
    <button onClick={onClick} className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
      active ? 'bg-white text-ink border-brand-300 ring-1 ring-brand-200 shadow-sm' : 'bg-transparent text-ink-muted border-transparent hover:bg-white/70 hover:text-ink')}>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
      {icon}
      <span>{children}</span>
      {sub && <span className="text-[10px] text-ink-subtle font-normal">· {sub}</span>}
    </button>
  );
}
function Kpi({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return <div className="card p-4"><div className="text-xs text-ink-subtle mb-1">{label}</div><div className="flex items-baseline gap-1"><span className="text-xl font-bold text-ink tabular-nums tracking-tight">{value}</span>{unit && <span className="text-xs text-ink-subtle">{unit}</span>}</div>{sub && <div className="text-[11px] text-ink-subtle mt-0.5">{sub}</div>}</div>;
}
function Card({ icon, title, count, children }: { icon: React.ReactNode; title: string; count?: number; children: React.ReactNode }) {
  return <section className="card p-5"><div className="flex items-center gap-1.5 mb-3"><h3 className="text-sm font-bold text-ink flex items-center gap-1.5">{icon}{title}</h3>{count != null && <span className="text-xs text-ink-subtle">{count}</span>}</div>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) { return <div className="py-6 text-center text-xs text-ink-subtle">{children}</div>; }

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
