'use client';

import { useEffect, useState, Fragment } from 'react';
import { fmtWon } from '@/lib/admin/format';
import { useDrawer } from '../DrawerProvider';
import { Section, Loading } from './_shared';

type RD = { id: number; date: string; owner: string; workContent: string | null; contractPlan: string | null; activityNote: string | null; contractAmount: number | null; mentioned: string[] };

export default function ReportPanel({ id }: { id: number }) {
  const { openCompany } = useDrawer();
  const [d, setD] = useState<RD | null>(null);
  useEffect(() => { setD(null); fetch(`/api/admin/detail/report/${id}`).then((r) => r.json()).then(setD).catch(() => setD(null)); }, [id]);

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
      <div>
        <h2 className="text-[16px] font-bold text-ink tabular-nums">{d.date}</h2>
        <p className="text-[12px] text-ink-subtle mt-0.5">{d.owner}{d.contractAmount != null ? ` · 계약 ${fmtWon(d.contractAmount)}` : ''}</p>
      </div>
      {d.workContent && <Section title="업무내용"><div className="text-[13px] text-ink-body leading-relaxed">{block(d.workContent)}</div></Section>}
      {d.contractPlan && <div className="rounded-md px-3 py-2.5" style={{ background: 'var(--accent-tint)' }}><div className="eyebrow mb-1" style={{ color: 'var(--accent-press)' }}>계약 예정</div><div className="text-[13px] text-ink-body leading-relaxed">{block(d.contractPlan)}</div></div>}
      {d.activityNote && <Section title="고객관리 · 방문 · 기타"><div className="text-[13px] text-ink-body leading-relaxed">{block(d.activityNote)}</div></Section>}
      {!d.workContent && !d.contractPlan && !d.activityNote && <p className="text-[13px] text-ink-subtle">내용 없음</p>}
    </div>
  );
}
