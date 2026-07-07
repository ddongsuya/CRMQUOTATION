'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';

export type Prospect = {
  id: number; name: string; pipeline: string | null; platform: string | null; stage: string | null;
  indTarget: string | null; croOutlook: string | null; founded: string | null; location: string | null;
  ceo: string | null; companyType: string | null; note: string | null; companyId: number | null;
};

const FIELD_DEFS: { key: keyof Prospect; label: string }[] = [
  { key: 'pipeline', label: '주요 파이프라인(적응증)' },
  { key: 'platform', label: '약물 플랫폼' },
  { key: 'stage', label: '개발단계' },
  { key: 'indTarget', label: 'IND 목표 시점' },
  { key: 'croOutlook', label: '비임상 CRO 전망' },
];
const PROFILE_DEFS: { key: keyof Prospect; label: string }[] = [
  { key: 'founded', label: '설립' }, { key: 'location', label: '본사' },
  { key: 'ceo', label: '대표' }, { key: 'companyType', label: '유형' },
];

function outlookColor(v: string | null): string {
  if (!v) return 'var(--muted-soft)';
  if (v.includes('높')) return 'var(--success)';
  if (v.includes('중')) return 'var(--accent)';
  if (v.includes('낮')) return 'var(--muted)';
  return 'var(--muted)';
}

export default function ProspectList({ prospects: initial }: { prospects: Prospect[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Prospect>>({});
  const [busy, setBusy] = useState(false);

  const setRow = (id: number, p: Partial<Prospect>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const startEdit = (r: Prospect) => { setEditing(r.id); setForm({ ...r }); };
  const save = async (r: Prospect) => {
    setBusy(true);
    await fetch(`/api/admin/prospects/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false); setRow(r.id, form); setEditing(null);
  };
  const convert = async (r: Prospect) => {
    if (!confirm(`"${r.name}"를 고객사로 전환할까요?`)) return;
    const res = await fetch(`/api/admin/prospects/${r.id}/convert`, { method: 'POST' });
    const j = await res.json().catch(() => null);
    if (j?.ok) { setRow(r.id, { companyId: j.companyId }); router.refresh(); }
  };
  const remove = async (r: Prospect) => {
    if (!confirm(`"${r.name}"를 삭제할까요?`)) return;
    await fetch(`/api/admin/prospects/${r.id}`, { method: 'DELETE' });
    setRows((rs) => rs.filter((x) => x.id !== r.id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {rows.map((r) => {
        const isEdit = editing === r.id;
        return (
          <div key={r.id} className="card card-pad">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[16px] font-bold text-ink">{r.name}</h3>
                {r.croOutlook && <span className="pill" style={{ background: 'color-mix(in srgb, ' + outlookColor(r.croOutlook) + ' 14%, transparent)', color: outlookColor(r.croOutlook) }}>CRO {r.croOutlook.replace(/\s*\(.*\)/, '')}</span>}
                {r.companyId && <span className="tag" style={{ background: 'var(--accent-tint)', color: 'var(--accent-press)' }}>고객 전환됨</span>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {isEdit ? (
                  <>
                    <button onClick={() => setEditing(null)} className="btn-ghost h-8 text-[12px]">취소</button>
                    <button onClick={() => save(r)} disabled={busy} className="btn-primary h-8 text-[12px] px-3">{busy ? '…' : '저장'}</button>
                  </>
                ) : (
                  <>
                    {!r.companyId && <button onClick={() => convert(r)} className="btn-ghost h-8 text-[12px]" title="고객사로 전환"><Icon name="arrow-right" className="w-3.5 h-3.5" /> 고객 전환</button>}
                    <button onClick={() => startEdit(r)} className="icon-btn" title="편집"><Icon name="notebook" className="w-4 h-4" /></button>
                    <button onClick={() => remove(r)} className="icon-btn" title="삭제"><Icon name="x" className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>

            {isEdit ? (
              <div className="space-y-2">
                {[...FIELD_DEFS, ...PROFILE_DEFS].map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className="w-32 text-[12px] text-ink-muted flex-shrink-0">{f.label}</span>
                    <input className="input h-9 text-[13px] flex-1" value={(form[f.key] as string) ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <dl className="space-y-1.5">
                  {FIELD_DEFS.map((f) => r[f.key] && (
                    <div key={f.key} className="flex gap-2 text-[13px]">
                      <dt className="w-32 text-ink-muted flex-shrink-0">{f.label}</dt>
                      <dd className="text-ink-body flex-1">{r[f.key] as string}</dd>
                    </div>
                  ))}
                </dl>
                {(r.founded || r.location || r.ceo || r.companyType) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-subtle">
                    {PROFILE_DEFS.map((f) => r[f.key] && <span key={f.key}>{f.label} <b className="text-ink-body font-medium">{r[f.key] as string}</b></span>)}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {rows.length === 0 && <div className="card card-pad py-12 text-center text-ink-subtle lg:col-span-2">잠재 고객 없음 — 엑셀 업로드 또는 추가로 시작하세요.</div>}
    </div>
  );
}
