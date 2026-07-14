'use client';

import CustomerFields, { type CustomerInfo } from '@/components/quote/CustomerFields';

/**
 * STEP 2 · 고객 정보 — 독성 모듈(quote-v2)과 동일한 공용 블록(CustomerFields)을 사용한다.
 * 고객사는 CRM 자동완성으로 기존 고객사와 연결되고, 신규면 저장 시 고객 관리에 자동 등록된다.
 */
export default function Step2Client({ value, companies, dealId, onChange }: {
  value: CustomerInfo; companies: string[]; dealId: number | null; onChange: (u: Partial<CustomerInfo>) => void;
}) {
  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-6">
        <div className="eyebrow mb-2">STEP 2 · 고객 정보</div>
        <h1 className="text-[34px] font-extrabold tracking-tight text-ink leading-[1.1] m-0">견적서에 표기할 고객 정보</h1>
        <p className="mt-2 mb-0 text-[15px] text-ink-muted">고객사는 CRM과 연결됩니다. 신규 고객사면 저장 시 고객 관리에 자동 등록됩니다.</p>
      </div>

      <div className="card card-pad space-y-3.5">
        <CustomerFields
          value={value} onChange={onChange} companyNames={companies} dealId={dealId}
          projectPlaceholder="예: 심부전 TAC 모델 효력 평가"
          substancePlaceholder="예: CSC-101 (시험물질)"
        />
      </div>
    </div>
  );
}
