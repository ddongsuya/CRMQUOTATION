'use client';

/** 고객 상세의 모달 3종 — 고객사 수정 · 의뢰자 추가/수정 · 새 안건. 페이지가 열고 닫으며, 저장 후 reload 한다. */
import { useId, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/lib/toast';
import { formatPhone } from '@/lib/format-phone';
import Field, { TextField } from '@/components/ui/Field';
import { Modal } from './shared';
import type { Company, Contact } from './types';

export function CompanyEditModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
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
      <TextField label="고객사명" required value={f.name} onChange={v => set('name', v)} inputClassName="input w-full" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="사업자등록번호" value={f.bizRegNo} onChange={v => set('bizRegNo', v)} inputClassName="input w-full" />
        <TextField label="업종" value={f.industry} onChange={v => set('industry', v)} inputClassName="input w-full" />
      </div>
      <TextField label="주소" value={f.address} onChange={v => set('address', v)} inputClassName="input w-full" />
      <Field label="메모">{a => <textarea {...a} className="input w-full min-h-[60px]" value={f.memo} onChange={e => set('memo', e.target.value)} />}</Field>
      <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer"><input type="checkbox" checked={f.isNewClient} onChange={e => set('isNewClient', e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />첫 거래 고객사</label>
    </Modal>
  );
}

export function ContactModal({ companyId, contact, onClose, onSaved }: { companyId: number; contact: Contact | null; onClose: () => void; onSaved: () => void }) {
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
        <Field label="이름" required>{a => <input {...a} className="input w-full" value={f.name} onChange={e => set('name', e.target.value)} autoFocus />}</Field>
        <TextField label="직책" value={f.position} onChange={v => set('position', v)} inputClassName="input w-full" />
      </div>
      <TextField label="이메일" value={f.email} onChange={v => set('email', v)} inputClassName="input w-full" />
      <Field label="연락처">{a => <input {...a} className="input w-full" inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={e => set('phone', formatPhone(e.target.value))} />}</Field>
      <Field label="메모">{a => <textarea {...a} className="input w-full min-h-[60px]" value={f.memo} onChange={e => set('memo', e.target.value)} />}</Field>
    </Modal>
  );
}

export function DealModal({ contactId, onClose, onSaved }: { contactId: number; onClose: () => void; onSaved: () => void }) {
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
      <Field label="안건명" required>{a => <input {...a} className="input w-full" value={f.title} onChange={e => set('title', e.target.value)} placeholder="예: OOO 13주 독성 견적" autoFocus />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="모달리티" value={f.modality} onChange={v => set('modality', v)} placeholder="합성신약 등" inputClassName="input w-full" />
        <TextField label="적응증" value={f.indication} onChange={v => set('indication', v)} inputClassName="input w-full" />
      </div>
      <Field label="제출처">
        {a => (
          <select {...a} className="input w-full" value={f.submissionTarget} onChange={e => onTarget(e.target.value)}>
            <option>한국 (MFDS)</option><option>미국 (US FDA)</option><option>유럽 (EMA)</option>
          </select>
        )}
      </Field>
      <div role="group" aria-labelledby={langId}>
        <div id={langId} className="label mb-1">보고서 언어</div>
        <div className="flex gap-1.5">
          {(['KO', 'EN'] as const).map(l => <button key={l} onClick={() => set('reportLanguage', l)} aria-pressed={f.reportLanguage === l} className={clsx('chip', f.reportLanguage === l ? 'chip-active' : 'chip-inactive')}>{l === 'KO' ? '국문' : '영문'}</button>)}
          <span className="text-[11px] text-ink-subtle self-center ml-1">{f.reportLanguage === 'EN' ? '해외 제출 — 영문보고서(추가금 없음)' : ''}</span>
        </div>
      </div>
      <Field label="임상 예정 디자인">{a => <textarea {...a} className="input w-full min-h-[60px]" value={f.clinicalDesign} onChange={e => set('clinicalDesign', e.target.value)} placeholder="투여경로·기간 등 임상 설계 메모" />}</Field>
    </Modal>
  );
}
