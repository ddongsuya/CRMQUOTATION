'use client';

import type { Client } from '../_lib/state';

const FIELDS: { label: string; key: keyof Client; ph: string }[] = [
  { label: '고객사', key: 'org', ph: '예: OO바이오' },
  { label: '담당자', key: 'name', ph: '담당자명' },
  { label: '연락처', key: 'phone', ph: '010-0000-0000' },
  { label: '이메일', key: 'email', ph: 'name@company.com' },
  { label: '적응증', key: 'indication', ph: '예: 골관절염' },
];

/** STEP 2 · 고객 정보 — 최대폭 680 중앙, 2열 폼. "고객사"는 견적서 표지/명세에 표기되고 CRM 고객사로 등록된다. */
export default function Step2Client({ client, companies, onChange }: {
  client: Client; companies: string[]; onChange: (u: Partial<Client>) => void;
}) {
  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-6">
        <div className="eyebrow mb-2">STEP 2 · 고객 정보</div>
        <h1 className="text-[34px] font-extrabold tracking-tight text-ink leading-[1.1] m-0">견적서에 표기할 고객 정보</h1>
        <p className="mt-2 mb-0 text-[15px] text-ink-muted">고객사명은 견적서 표지·명세에 표기되며, 신규 고객사면 고객 관리에 자동 등록됩니다.</p>
      </div>

      <div className="card card-pad">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.key === 'indication' ? 'sm:col-span-2' : ''}>
              <label className="label">{f.label}{f.key === 'org' && <span style={{ color: 'var(--accent)' }}> *</span>}</label>
              <input
                className="input"
                style={{ height: 42, borderRadius: 10 }}
                value={client[f.key]}
                placeholder={f.ph}
                list={f.key === 'org' ? 'eff-companies' : undefined}
                onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<Client>)}
              />
            </div>
          ))}
        </div>
        <datalist id="eff-companies">
          {companies.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
    </div>
  );
}
