'use client';

import { useEffect, useState, Fragment } from 'react';
import { fmtWon } from '@/lib/admin/format';
import Icon from '../../Icon';
import { useDrawer } from '../DrawerProvider';
import { Section, Loading } from './_shared';

type RD = { id: number; date: string; owner: string; workContent: string | null; contractPlan: string | null; activityNote: string | null; contractAmount: number | null; mentioned: string[] };

export default function ReportPanel({ id }: { id: number }) {
  const { openCompany } = useDrawer();
  const [d, setD] = useState<RD | null>(null);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ workContent: '', contractPlan: '', activityNote: '' });
  const [busy, setBusy] = useState(false);
  const load = () => fetch(`/api/admin/detail/report/${id}`).then((r) => r.json()).then(setD).catch(() => setD(null));
  useEffect(() => { setD(null); setEdit(false); load(); }, [id]);

  const startEdit = () => { if (d) { setF({ workContent: d.workContent ?? '', contractPlan: d.contractPlan ?? '', activityNote: d.activityNote ?? '' }); setEdit(true); } };
  const save = async () => {
    setBusy(true);
    await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setBusy(false); setEdit(false); await load();
  };

  if (!d) return <div className="px-5 py-4"><Loading /></div>;

  const linkify = (text: string) => {
    const names = [...d.mentioned].sort((a, b) => b.length - a.length);
    const hits: { i: number; name: string }[] = [];
    for (const name of names) { let from = 0, idx; while ((idx = text.indexOf(name, from)) !== -1) { hits.push({ i: idx, name }); from = idx + name.length; } }
    hits.sort((a, b) => a.i - b.i);
    const out: React.ReactNode[] = []; let cur = 0;
    for (const h of hits) {
      if (h.i < cur) continue;
      if (h.i > cur) out.push(text.slice(cur, h.i));
      out.push(<button key={`${h.i}-${h.name}`} onClick={() => openCompany(h.name)} className="text-brand-600 hover:underline font-medium inline">{h.name}</button>);
      cur = h.i + h.name.length;
    }
    if (cur < text.length) out.push(text.slice(cur));
    return out;
  };
  const block = (text: string) => text.split('\n').map((ln, i) => <Fragment key={i}>{i > 0 && <br />}{linkify(ln)}</Fragment>);

  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-bold text-ink tabular-nums">{d.date}</h2>
          <p className="text-[12px] text-ink-subtle mt-0.5">{d.owner}{d.contractAmount != null ? ` · 계약 ${fmtWon(d.contractAmount)}` : ''}</p>
        </div>
        {edit ? (
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={() => setEdit(false)} className="btn-ghost h-8 text-[12px]">취소</button>
            <button onClick={save} disabled={busy} className="btn-primary h-8 text-[12px] px-3">{busy ? '…' : '저장'}</button>
          </div>
        ) : (
          <button onClick={startEdit} className="icon-btn flex-shrink-0" title="편집"><Icon name="notebook" className="w-4 h-4" /></button>
        )}
      </div>

      {edit ? (
        <div className="space-y-2.5">
          <Fld label="업무내용" value={f.workContent} onChange={(v) => setF((s) => ({ ...s, workContent: v }))} rows={4} />
          <Fld label="계약 예정(접수)" value={f.contractPlan} onChange={(v) => setF((s) => ({ ...s, contractPlan: v }))} rows={2} />
          <Fld label="고객관리·방문·기타" value={f.activityNote} onChange={(v) => setF((s) => ({ ...s, activityNote: v }))} rows={3} />
        </div>
      ) : (
        <>
          {d.workContent && <Section title="업무내용"><div className="text-[13px] text-ink-body leading-relaxed">{block(d.workContent)}</div></Section>}
          {d.contractPlan && <div className="rounded-md px-3 py-2.5" style={{ background: 'var(--accent-tint)' }}><div className="eyebrow mb-1" style={{ color: 'var(--accent-press)' }}>계약 예정</div><div className="text-[13px] text-ink-body leading-relaxed">{block(d.contractPlan)}</div></div>}
          {d.activityNote && <Section title="고객관리 · 방문 · 기타"><div className="text-[13px] text-ink-body leading-relaxed">{block(d.activityNote)}</div></Section>}
          {!d.workContent && !d.contractPlan && !d.activityNote && <p className="text-[13px] text-ink-subtle">내용 없음</p>}
        </>
      )}
    </div>
  );
}

function Fld({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div>
      <label className="eyebrow block mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full text-[13px] rounded-md border border-slate-200 px-3 py-2 resize-y focus:border-[var(--accent)]" />
    </div>
  );
}
