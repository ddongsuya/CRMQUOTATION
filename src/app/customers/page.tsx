'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Loader2, Building2, ChevronRight, X, Save, Sparkles } from 'lucide-react';
import { toast } from '@/lib/toast';

type Company = {
  id: number; name: string; bizRegNo: string | null; industry: string | null;
  isNewClient: boolean; updatedAt: string; _count: { contacts: number };
};

export default function CustomersPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => fetch('/api/crm/companies').then(r => r.json()).then(d => setCompanies(d.companies ?? [])).catch(() => setCompanies([]));
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-brand-500" /> 고객 관리</h1>
          <p className="text-sm text-ink-muted mt-0.5">고객사별로 의뢰자를 분류하고, 안건 진행을 관리합니다.</p>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {companies.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`} className="card card-hover p-4 flex items-start gap-3 group">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex-shrink-0"><Building2 className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink truncate">{c.name}</span>
                  {c.isNewClient && <span className="pill bg-amber-100 text-amber-800 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />첫거래</span>}
                </div>
                <div className="text-xs text-ink-subtle mt-0.5 truncate">{c.industry || '업종 미지정'}</div>
                <div className="text-[11px] text-ink-muted mt-1.5">의뢰자 {c._count.contacts}명</div>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-subtle group-hover:text-brand-500 flex-shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      )}

      {creating && <CompanyModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

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
