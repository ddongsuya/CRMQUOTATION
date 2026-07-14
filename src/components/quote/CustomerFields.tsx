'use client';

/**
 * 견적 고객 정보 — 독성(quote-v2) · 효력(quote-efficacy) 공용 블록.
 * 두 모듈이 동일한 필드·동일한 CRM 자동완성·동일한 안건 연동을 쓴다.
 * 저장 시 고객사는 정규화 매칭으로 Company를 find-or-create 하여 고객 관리에 자동 등록된다.
 */
export type CustomerInfo = {
  company: string; name: string; email: string; phone: string;
  projectName: string; substanceName: string; indication: string;
};

export const EMPTY_CUSTOMER: CustomerInfo = {
  company: '', name: '', email: '', phone: '', projectName: '', substanceName: '', indication: '',
};

export default function CustomerFields({
  value, onChange, companyNames, dealId, projectPlaceholder, substancePlaceholder, extra,
}: {
  value: CustomerInfo;
  onChange: (u: Partial<CustomerInfo>) => void;
  companyNames: string[];
  dealId?: number | null;
  projectPlaceholder?: string;
  substancePlaceholder?: string;
  /** 모듈 전용 필드(예: 독성의 제출처) — 그리드 안에 함께 배치 */
  extra?: React.ReactNode;
}) {
  return (
    <>
      {dealId ? <div className="pill tone-sent mb-1">안건 #{dealId} 연동</div> : null}

      <Field label="프로젝트명 *">
        <input className="input" value={value.projectName} placeholder={projectPlaceholder ?? '예: CT-P17 비임상 독성 평가'}
          onChange={(e) => onChange({ projectName: e.target.value })} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-2">
        <Field label="고객사 *">
          <div className="flex items-center gap-2.5 h-10 px-2.5 rounded-lg border border-slate-200 bg-[var(--card)] focus-within:border-brand-500">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-ink-muted text-[11px] font-semibold flex-shrink-0">
              {(value.company || '?').trim().charAt(0)}
            </span>
            <input className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink placeholder:text-slate-400"
              value={value.company} placeholder="고객사 (CRM)" list="crm-companies"
              onChange={(e) => onChange({ company: e.target.value })} />
          </div>
          <datalist id="crm-companies">{companyNames.map((n) => <option key={n} value={n} />)}</datalist>
        </Field>

        <Field label="물질명">
          <input className="input" value={value.substanceName} placeholder={substancePlaceholder ?? '예: CTP-17 (성분 미정)'}
            onChange={(e) => onChange({ substanceName: e.target.value })} />
        </Field>

        <Field label="적응증">
          <input className="input" value={value.indication} placeholder="예: 류마티스 관절염"
            onChange={(e) => onChange({ indication: e.target.value })} />
        </Field>

        {extra}
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <Field label="담당자">
          <input className="input" value={value.name} placeholder="담당자 이름" onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="연락처">
          <input className="input" value={value.phone} placeholder="010-0000-0000" onChange={(e) => onChange({ phone: e.target.value })} />
        </Field>
        <Field label="이메일">
          <input className="input" value={value.email} placeholder="email@company.com" onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
