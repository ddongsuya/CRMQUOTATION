'use client';

import { useEffect, useState } from 'react';
import { fmtWon, fmtPct } from '@/lib/admin/format';
import { quoteStatus } from '@/lib/admin/status';
import { useDrawer } from '../DrawerProvider';
import { Stat, Section, KV, Loading } from './_shared';

type Detail = {
  name: string;
  company: { industry: string | null; memo: string | null; isNewClient: boolean; owner: string; center: string;
    contacts: { name: string; position: string | null; email: string | null; phone: string | null }[] } | null;
  prospect: { pipeline: string | null; stage: string | null; indTarget: string | null; croOutlook: string | null } | null;
  stats: { wonAmount: number; pipelineAmount: number; quoteCount: number; winRate: number | null };
  quotes: { id: number; quoteNumber: string; sentAt: string | null; projectName: string; grandTotal: number | null; status: string; trackingNote: string | null; testStandard: string | null }[];
  reports: { id: number; date: string; snippet: string }[];
};

export default function CompanyPanel({ name }: { name: string }) {
  const { openQuote, openReport } = useDrawer();
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    setD(null);
    fetch(`/api/admin/detail/company/${encodeURIComponent(name)}`).then((r) => r.json()).then(setD).catch(() => setD(null));
  }, [name]);

  if (!d) return <div className="px-5 py-4"><h2 className="text-[18px] font-bold text-ink">{name}</h2><Loading /></div>;
  const s = d.stats;

  return (
    <div className="px-5 py-4 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-bold text-ink">{name}</h2>
          {d.company?.isNewClient && <span className="tag">신규</span>}
          {!d.company && d.prospect && <span className="tag" style={{ background: 'var(--accent-tint)', color: 'var(--accent-press)' }}>잠재고객</span>}
        </div>
        {d.company && <p className="text-[12px] text-ink-subtle mt-0.5">{d.company.owner} · {d.company.center} · {d.company.industry ?? '—'}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="누적 수주" value={fmtWon(s.wonAmount)} dark />
        <Stat label="진행 파이프라인" value={fmtWon(s.pipelineAmount)} />
        <Stat label="견적" value={`${s.quoteCount}건`} />
        <Stat label="수주율" value={s.winRate != null ? fmtPct(s.winRate, 0) : '—'} />
      </div>

      {d.prospect && (
        <Section title="잠재 고객 리서치">
          <div className="space-y-1">
            {d.prospect.pipeline && <KV k="파이프라인" v={d.prospect.pipeline} />}
            {d.prospect.stage && <KV k="개발단계" v={d.prospect.stage} />}
            {d.prospect.indTarget && <KV k="IND 목표" v={d.prospect.indTarget} />}
            {d.prospect.croOutlook && <KV k="CRO 전망" v={d.prospect.croOutlook} />}
          </div>
        </Section>
      )}

      {d.company?.contacts?.length ? (
        <Section title={`연락처 ${d.company.contacts.length}`}>
          <div className="space-y-2">
            {d.company.contacts.map((c, i) => (
              <div key={i} className="text-[13px]">
                <span className="font-medium text-ink">{c.name}</span>{c.position && <span className="text-ink-subtle"> · {c.position}</span>}
                <div className="text-[12px] text-ink-muted tabular-nums">{[c.phone, c.email].filter(Boolean).join('  ·  ')}</div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={`견적 ${d.quotes.length}`} link={`/admin/quotes?company=${encodeURIComponent(name)}`}>
        {d.quotes.length ? (
          <div className="space-y-2">
            {d.quotes.map((q) => {
              const st = quoteStatus(q.status);
              return (
                <button key={q.id} onClick={() => openQuote(q.id)} className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono-no text-[12px]">{q.quoteNumber}</span>
                    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: st.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{q.trackingNote || st.label}</span>
                  </div>
                  <div className="text-[12px] text-ink-body mt-0.5 line-clamp-1" title={q.projectName}>{q.projectName}</div>
                  <div className="flex items-center justify-between mt-1 text-[12px]">
                    <span className="text-ink-subtle tabular-nums">{q.sentAt ?? '—'}{q.testStandard ? ` · ${q.testStandard}` : ''}</span>
                    <span className="font-semibold text-ink tabular-nums">{fmtWon(q.grandTotal ?? 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : <div className="text-[13px] text-ink-subtle">없음</div>}
      </Section>

      {d.reports.length > 0 && (
        <Section title={`업무 기록 ${d.reports.length}`} link="/admin/reports">
          <div className="space-y-1.5">
            {d.reports.map((r) => (
              <button key={r.id} onClick={() => openReport(r.id)} className="w-full text-left text-[12px] rounded-md px-2 py-1.5 hover:bg-slate-50 transition-colors">
                <span className="tabular-nums text-ink-muted">{r.date}</span>
                <span className="text-ink-body"> · {r.snippet}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
