'use client';

import { useWizard } from '@/lib/store';

export default function SectionProject() {
  const s = useWizard();
  return (
    <div className="space-y-4">
      <Field label="프로젝트명" required>
        <input className="input" value={s.projectName} onChange={(e) => s.patch({ projectName: e.target.value })} placeholder="예: XYZ 비임상 패키지" />
      </Field>
      <Field label="시험물질명">
        <input className="input" value={s.substanceName} onChange={(e) => s.patch({ substanceName: e.target.value })} placeholder="시험물질 코드 또는 명칭" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="고객사">
          <input className="input" value={s.customerCompany} onChange={(e) => s.patch({ customerCompany: e.target.value })} placeholder="회사명" />
        </Field>
        <Field label="담당자">
          <input className="input" value={s.customerName} onChange={(e) => s.patch({ customerName: e.target.value })} placeholder="담당자명" />
        </Field>
      </div>
      <Field label="이메일">
        <input type="email" className="input" value={s.customerEmail} onChange={(e) => s.patch({ customerEmail: e.target.value })} placeholder="contact@example.com" />
      </Field>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
