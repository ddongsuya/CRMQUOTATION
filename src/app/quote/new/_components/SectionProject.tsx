'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, X, Plus } from 'lucide-react';
import { useWizard } from '@/lib/store';

type CrmCompany = { id: number; name: string; industry: string | null; isNewClient?: boolean; _count: { contacts: number } };
type CrmContact = { id: number; name: string; email: string | null; phone: string | null; position: string | null };

// 제출처 → 가격 기준 매핑 (한국=MFDS, 그 외=OECD)
const SUBMISSION_TARGETS: { value: string; std: 'MFDS' | 'OECD' }[] = [
  { value: '한국 (MFDS)', std: 'MFDS' },
  { value: '미국 (FDA)', std: 'OECD' },
  { value: '유럽 (EMA)', std: 'OECD' },
];

/** 고객사명·적응증으로 프로젝트명 자동 생성 (다운스트림에서 견적 제목으로 사용) */
function deriveProjectName(company: string, indication: string): string {
  const parts = [company.trim(), indication.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : '';
}

export default function SectionProject() {
  const s = useWizard();

  // ── CRM 고객사 연결 ──
  const [companies, setCompanies] = useState<CrmCompany[] | null>(null);
  const [linkedId, setLinkedId] = useState<number | ''>('');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [contactId, setContactId] = useState<number | ''>('');

  useEffect(() => {
    fetch('/api/crm/companies').then(r => r.json()).then(d => setCompanies(d.companies ?? [])).catch(() => setCompanies([]));
  }, []);

  const linkCompany = async (id: number) => {
    const c = companies?.find(x => x.id === id);
    if (!c) return;
    setLinkedId(id);
    setContactId('');
    setCompany(c.name);
    try {
      const d = await fetch(`/api/crm/companies/${id}`).then(r => r.json());
      const cs: CrmContact[] = d.company?.contacts ?? [];
      setContacts(cs);
      if (cs.length === 1) pickContact(cs[0].id, cs); // 의뢰자 1명이면 자동 선택
    } catch { setContacts([]); }
  };
  const unlink = () => { setLinkedId(''); setContacts([]); setContactId(''); };
  const pickContact = (id: number, list = contacts) => {
    const ct = list.find(x => x.id === id);
    if (!ct) return;
    setContactId(id);
    s.patch({ customerName: ct.name, customerEmail: ct.email ?? '', customerPhone: ct.phone ?? '' });
  };
  const linked = companies?.find(c => c.id === linkedId);

  const setCompany = (v: string) => s.patch({ customerCompany: v, projectName: deriveProjectName(v, s.indication) });
  const setIndication = (v: string) => s.patch({ indication: v, projectName: deriveProjectName(s.customerCompany, v) });
  const setTarget = (v: string) => {
    const t = SUBMISSION_TARGETS.find(x => x.value === v);
    s.patch({ submissionTarget: v, priceStandard: t?.std ?? 'MFDS' });
  };

  return (
    <div className="space-y-4">
      {/* CRM 고객사 연결 */}
      <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="label flex items-center gap-1.5 !mb-0"><Users className="w-3.5 h-3.5 text-brand-600" /> CRM 고객사 연결</span>
          <Link href="/customers" className="text-[11px] text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> 고객 관리
          </Link>
        </div>
        {linked ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-brand-200 text-sm font-medium text-ink">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-100 text-brand-700 text-[10px] font-bold">{linked.name.charAt(0)}</span>
              {linked.name}
              {linked.isNewClient && <span className="pill bg-amber-100 text-amber-800 text-[9px]">신규</span>}
            </span>
            <button onClick={unlink} className="text-[11px] text-ink-subtle hover:text-red-600 inline-flex items-center gap-0.5"><X className="w-3 h-3" /> 변경</button>
            {contacts.length > 0 && (
              <select className="input !w-auto text-xs py-1.5 ml-auto" value={contactId} onChange={e => pickContact(Number(e.target.value))}>
                <option value="">의뢰자 선택…</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.position ? ` · ${c.position}` : ''}</option>)}
              </select>
            )}
          </div>
        ) : companies === null ? (
          <div className="text-xs text-ink-subtle">불러오는 중…</div>
        ) : companies.length === 0 ? (
          <div className="text-xs text-ink-subtle">등록된 고객사가 없습니다 — 아래에 직접 입력하거나 <Link href="/customers" className="text-brand-600 hover:underline">고객 관리</Link>에서 등록하세요.</div>
        ) : (
          <select className="input text-sm" defaultValue="" onChange={e => e.target.value && linkCompany(Number(e.target.value))}>
            <option value="">기존 고객사에서 선택… (또는 아래 직접 입력)</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c._count.contacts ? ` (의뢰자 ${c._count.contacts})` : ''}</option>)}
          </select>
        )}
      </div>

      <Field label="고객사명" required>
        <input className="input" value={s.customerCompany} onChange={(e) => setCompany(e.target.value)} placeholder="예: ㈜OOO바이오" />
      </Field>

      <Field label="담당자명">
        <input className="input" value={s.customerName} onChange={(e) => s.patch({ customerName: e.target.value })} placeholder="담당자 성함" />
      </Field>

      <Field label="담당자 e-mail">
        <input type="email" className="input" value={s.customerEmail} onChange={(e) => s.patch({ customerEmail: e.target.value })} placeholder="contact@company.com" autoComplete="email" />
      </Field>

      <Field label="담당자 연락처">
        <input className="input" value={s.customerPhone} onChange={(e) => s.patch({ customerPhone: e.target.value })} placeholder="010-0000-0000" inputMode="tel" />
      </Field>

      <Field label="적응증">
        <input className="input" value={s.indication} onChange={(e) => setIndication(e.target.value)} placeholder="예: 비소세포폐암, 류마티스 관절염" />
      </Field>

      <Field label="제출처" hint="규제 제출 기관 — 가격 기준이 자동 설정됩니다">
        <select className="input" value={s.submissionTarget} onChange={(e) => setTarget(e.target.value)}>
          {SUBMISSION_TARGETS.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
        </select>
      </Field>

      {s.projectName && (
        <div className="text-[11px] text-ink-subtle pt-1">
          프로젝트명(자동): <span className="font-medium text-ink-muted">{s.projectName}</span>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label flex items-baseline gap-2">
        <span>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
        {hint && <span className="text-[10px] font-normal text-ink-subtle">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}
