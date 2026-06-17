'use client';

import { useWizard } from '@/lib/store';

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

  const setCompany = (v: string) => s.patch({ customerCompany: v, projectName: deriveProjectName(v, s.indication) });
  const setIndication = (v: string) => s.patch({ indication: v, projectName: deriveProjectName(s.customerCompany, v) });
  const setTarget = (v: string) => {
    const t = SUBMISSION_TARGETS.find(x => x.value === v);
    s.patch({ submissionTarget: v, priceStandard: t?.std ?? 'MFDS' });
  };

  return (
    <div className="space-y-4">
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
