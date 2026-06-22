'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { ArrowLeft, Building2, Loader2, Plus, Pencil, Trash2, X, Save, User, Mail, Phone, Briefcase, Sparkles } from 'lucide-react';
import { toast } from '@/lib/toast';

type Deal = { id: number; title: string; modality: string | null; stage: string; status: string; updatedAt: string };
type Contact = { id: number; name: string; email: string | null; phone: string | null; position: string | null; memo: string | null; deals: Deal[] };
type Company = { id: number; name: string; bizRegNo: string | null; industry: string | null; address: string | null; isNewClient: boolean; memo: string | null; contacts: Contact[] };

const STAGE: Record<string, { label: string; cls: string }> = {
  INQUIRY: { label: '문의접수', cls: 'bg-slate-200 text-ink-muted' },
  QUOTE: { label: '견적', cls: 'bg-brand-100 text-brand-700' },
  INTAKE: { label: '시험접수', cls: 'bg-violet-100 text-violet-700' },
  CONTRACT: { label: '계약', cls: 'bg-amber-100 text-amber-800' },
  STUDY: { label: '시험진행', cls: 'bg-sky-100 text-sky-700' },
  INVOICE: { label: '세금계산서', cls: 'bg-emerald-100 text-emerald-700' },
  DONE: { label: '완료', cls: 'bg-emerald-100 text-emerald-700' },
};

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [editCompany, setEditCompany] = useState(false);
  const [contactModal, setContactModal] = useState<{ contact: Contact | null } | null>(null);
  const [dealModal, setDealModal] = useState<{ contactId: number } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/crm/companies/${id}`).then(r => r.json()).then(d => setCompany(d.company ?? null)).catch(() => {});
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const delContact = async (cid: number) => {
    if (!confirm('이 의뢰자와 연결된 안건도 삭제됩니다. 계속할까요?')) return;
    const res = await fetch(`/api/crm/contacts/${cid}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다.'); load(); } else toast.error('삭제 실패');
  };

  if (!company) return <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/customers" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"><ArrowLeft className="w-3.5 h-3.5" /> 고객 관리</Link>

      {/* 고객사 헤더 */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 text-brand-500 flex-shrink-0"><Building2 className="w-6 h-6" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-ink">{company.name}</h1>
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
          <button onClick={() => setEditCompany(true)} className="btn-outline text-xs flex-shrink-0"><Pencil className="w-3.5 h-3.5" /> 수정</button>
        </div>
      </div>

      {/* 의뢰자 + 안건 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink flex items-center gap-1.5"><User className="w-4 h-4 text-brand-500" /> 의뢰자 {company.contacts.length}명</h2>
        <button onClick={() => setContactModal({ contact: null })} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 의뢰자 추가</button>
      </div>

      {company.contacts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-subtle">등록된 의뢰자가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {company.contacts.map(ct => (
            <div key={ct.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink flex items-center gap-2">{ct.name}{ct.position && <span className="text-xs font-normal text-ink-subtle">{ct.position}</span>}</div>
                  <div className="text-xs text-ink-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {ct.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{ct.email}</span>}
                    {ct.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{ct.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setContactModal({ contact: ct })} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => delContact(ct.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* 안건 목록 */}
              <div className="mt-3 pl-1 space-y-1.5">
                {ct.deals.map(d => {
                  const st = STAGE[d.stage] ?? STAGE.INQUIRY;
                  return (
                    <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center gap-2 py-1.5 px-2 -mx-1 rounded-lg hover:bg-slate-50/70 group">
                      <Briefcase className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-sm text-ink truncate">{d.title}{d.modality && <span className="text-ink-subtle text-xs ml-1.5">{d.modality}</span>}</span>
                      <span className={clsx('pill', st.cls)}>{st.label}</span>
                      {d.status === 'LOST' && <span className="pill bg-red-100 text-red-700">중단</span>}
                    </Link>
                  );
                })}
                <button onClick={() => setDealModal({ contactId: ct.id })} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 py-1"><Plus className="w-3.5 h-3.5" /> 안건 추가</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editCompany && <CompanyEditModal company={company} onClose={() => setEditCompany(false)} onSaved={() => { setEditCompany(false); load(); }} />}
      {contactModal && <ContactModal companyId={company.id} contact={contactModal.contact} onClose={() => setContactModal(null)} onSaved={() => { setContactModal(null); load(); }} />}
      {dealModal && <DealModal contactId={dealModal.contactId} onClose={() => setDealModal(null)} onSaved={() => { setDealModal(null); load(); }} />}
    </div>
  );
}

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
  // 제출처 해외면 보고서 영문 자동
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
