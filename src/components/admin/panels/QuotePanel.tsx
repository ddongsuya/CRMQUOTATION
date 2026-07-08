'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Icon from '../../Icon';
import { fmtWon, fmtPct } from '@/lib/admin/format';
import { CONCLUSIONS, quoteStatus, statusFromConclusion } from '@/lib/admin/status';
import { useDrawer } from '../DrawerProvider';
import { Stat, Section, KV, Loading } from './_shared';

type QD = {
  id: number; quoteNumber: string; sentAt: string | null; projectName: string; customerCompany: string | null;
  customerName: string | null; customerPhone: string | null; customerEmail: string | null;
  testStandard: string | null; submissionPurpose: string | null; substanceType: string | null; modality: string;
  totalBeforeDiscount: number | null; discountRate: number; grandTotal: number | null; contractNo: string | null; contractAmount: number | null;
  status: string; trackingNote: string | null;
  trackingLog: { id: number; conclusion: string | null; status: string | null; note: string | null; createdAt: string; author: string }[];
};

export default function QuotePanel({ id }: { id: number }) {
  const { openCompany } = useDrawer();
  const [d, setD] = useState<QD | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { fetch(`/api/admin/detail/quote/${id}`).then((r) => r.json()).then(setD).catch(() => setD(null)); }, [id]);
  useEffect(() => { setD(null); load(); }, [load]);

  const changeConclusion = async (val: string) => {
    setSaving(true);
    await fetch(`/api/admin/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackingNote: val, status: statusFromConclusion(val) }) });
    setSaving(false); load();
  };

  if (!d) return <div className="px-5 py-4"><Loading /></div>;
  const st = quoteStatus(d.status);
  const curConc = CONCLUSIONS.includes(d.trackingNote as never) ? (d.trackingNote as string) : '';

  return (
    <div className="px-5 py-4 space-y-5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="mono-no text-[13px]">{d.quoteNumber}</span>
          <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: st.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}</span>
        </div>
        <h2 className="text-[15px] font-semibold text-ink mt-1 leading-snug">{d.projectName}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="견적금액" value={fmtWon(d.grandTotal ?? 0)} dark />
        <Stat label="할인" value={d.discountRate ? fmtPct(d.discountRate, 0) : '—'} />
      </div>

      {/* 결론 편집 */}
      <div>
        <label className="eyebrow block mb-1.5">결론 · 추적</label>
        <select value={curConc} onChange={(e) => changeConclusion(e.target.value)} disabled={saving}
          className="w-full text-[13px] rounded-md border border-slate-200 bg-[var(--card)] px-3 py-2 cursor-pointer">
          <option value="">— 미정 —</option>
          {CONCLUSIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <Section title="정보">
        <div className="space-y-1">
          {d.customerCompany && <div className="flex gap-2 text-[13px]"><span className="w-20 text-ink-muted flex-shrink-0">의뢰기관</span><button onClick={() => openCompany(d.customerCompany!)} className="text-brand-600 hover:underline flex-1 text-left">{d.customerCompany}</button></div>}
          {d.customerName && <KV k="의뢰자" v={`${d.customerName}${d.customerPhone ? ` · ${d.customerPhone}` : ''}`} />}
          {d.testStandard && <KV k="시험기준" v={d.testStandard} />}
          {d.submissionPurpose && <KV k="제출용도" v={d.submissionPurpose} />}
          {d.substanceType && <KV k="물질종류" v={d.substanceType} />}
          {d.contractNo && <KV k="계약번호" v={d.contractNo} />}
          {d.contractAmount != null && <KV k="계약금액" v={fmtWon(d.contractAmount)} />}
        </div>
      </Section>

      {/* 추적 타임라인 */}
      <Section title={`추적 이력 ${d.trackingLog.length}`}>
        {d.trackingLog.length ? (
          <ol className="relative border-l border-slate-200 ml-1 space-y-3">
            {d.trackingLog.map((t) => (
              <li key={t.id} className="pl-3.5 relative">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full" style={{ background: quoteStatus(t.status ?? '').color }} />
                <div className="text-[12px] text-ink-body"><b className="text-ink">{t.conclusion ?? quoteStatus(t.status ?? '').label}</b>{t.note ? ` — ${t.note}` : ''}</div>
                <div className="text-[11px] text-ink-subtle tabular-nums">{t.createdAt} · {t.author}</div>
              </li>
            ))}
          </ol>
        ) : <div className="text-[13px] text-ink-subtle">이력 없음</div>}
      </Section>

      <div className="flex gap-2">
        {d.customerCompany && <button onClick={() => openCompany(d.customerCompany!)} className="btn-ghost flex-1 justify-center"><Icon name="users" className="w-4 h-4" /> 이 회사</button>}
        <Link href={`/quote/print?id=${d.id}`} target="_blank" className="btn-ghost flex-1 justify-center"><Icon name="arrow-right" className="w-4 h-4" /> 견적서</Link>
      </div>
    </div>
  );
}
