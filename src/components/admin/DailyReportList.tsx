'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';
import { fmtWon } from '@/lib/admin/format';

export type Report = {
  id: number; date: string; owner: string;
  workContent: string | null; contractPlan: string | null; activityNote: string | null; contractAmount: number | null;
};

const WD = ['일', '월', '화', '수', '목', '금', '토'];
function label(dateStr: string): string {
  const d = new Date(dateStr);
  return `${dateStr.slice(0, 10)} · ${WD[d.getDay()]}`;
}

/** 본문에서 고객사명을 찾아 견적 현황(해당 고객)으로 링크. */
function linkify(text: string, names: string[]): React.ReactNode {
  if (!text) return text;
  const hits: { i: number; name: string }[] = [];
  for (const name of names) {
    if (name.length < 2) continue;
    let from = 0, idx;
    while ((idx = text.indexOf(name, from)) !== -1) { hits.push({ i: idx, name }); from = idx + name.length; }
  }
  if (!hits.length) return text;
  hits.sort((a, b) => a.i - b.i || b.name.length - a.name.length);
  const out: React.ReactNode[] = []; let cursor = 0;
  for (const h of hits) {
    if (h.i < cursor) continue;                       // 겹침 방지
    if (h.i > cursor) out.push(text.slice(cursor, h.i));
    out.push(<Link key={`${h.i}-${h.name}`} href={`/admin/quotes?company=${encodeURIComponent(h.name)}`} className="text-brand-600 hover:underline font-medium">{h.name}</Link>);
    cursor = h.i + h.name.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function MultiText({ text, names }: { text: string; names: string[] }) {
  return <>{text.split('\n').map((line, i) => <Fragment key={i}>{i > 0 && <br />}{linkify(line, names)}</Fragment>)}</>;
}

export default function DailyReportList({ reports: initial, companyNames }: { reports: Report[]; companyNames: string[] }) {
  const router = useRouter();
  const [reports, setReports] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Report>>({});
  const [busy, setBusy] = useState(false);

  const startEdit = (r: Report) => { setEditing(r.id); setForm({ workContent: r.workContent, contractPlan: r.contractPlan, activityNote: r.activityNote }); };
  const save = async (r: Report) => {
    setBusy(true);
    await fetch(`/api/admin/reports/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    setReports((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...form } as Report : x)));
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const isEdit = editing === r.id;
        return (
          <div key={r.id} className="card card-pad">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[14px] font-bold text-ink tabular-nums">{label(r.date)}</span>
                <span className="text-[12px] text-ink-subtle">{r.owner}</span>
                {r.contractAmount != null && <span className="badge-vip">계약 {fmtWon(r.contractAmount)}</span>}
              </div>
              {isEdit ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className="btn-ghost h-8 text-[12px]">취소</button>
                  <button onClick={() => save(r)} disabled={busy} className="btn-primary h-8 text-[12px] px-3">{busy ? '저장 중…' : '저장'}</button>
                </div>
              ) : (
                <button onClick={() => startEdit(r)} className="icon-btn" title="편집"><Icon name="notebook" className="w-4 h-4" /></button>
              )}
            </div>

            {isEdit ? (
              <div className="space-y-2.5">
                <Field label="업무내용" value={form.workContent ?? ''} onChange={(v) => setForm((f) => ({ ...f, workContent: v }))} rows={4} />
                <Field label="계약 예정(접수)" value={form.contractPlan ?? ''} onChange={(v) => setForm((f) => ({ ...f, contractPlan: v }))} rows={2} />
                <Field label="고객관리·방문·기타" value={form.activityNote ?? ''} onChange={(v) => setForm((f) => ({ ...f, activityNote: v }))} rows={3} />
              </div>
            ) : (
              <div className="space-y-2 text-[13px] text-ink-body leading-relaxed">
                {r.workContent && <div><span className="eyebrow block mb-0.5">업무내용</span><MultiText text={r.workContent} names={companyNames} /></div>}
                {r.contractPlan && <div className="rounded-md px-3 py-2" style={{ background: 'var(--accent-tint)' }}><span className="eyebrow block mb-0.5" style={{ color: 'var(--accent-press)' }}>계약 예정</span><MultiText text={r.contractPlan} names={companyNames} /></div>}
                {r.activityNote && <div className="text-ink-muted"><span className="eyebrow block mb-0.5">고객관리·방문·기타</span><MultiText text={r.activityNote} names={companyNames} /></div>}
                {!r.workContent && !r.contractPlan && !r.activityNote && <span className="text-ink-subtle">내용 없음</span>}
              </div>
            )}
          </div>
        );
      })}
      {reports.length === 0 && <div className="card card-pad py-12 text-center text-ink-subtle">기록 없음 — 엑셀 업로드로 시작하세요.</div>}
    </div>
  );
}

function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div>
      <label className="eyebrow block mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full text-[13px] rounded-md border border-slate-200 px-3 py-2 resize-y focus:border-[var(--accent)]" />
    </div>
  );
}
