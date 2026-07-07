'use client';

import { useState } from 'react';
import { fmtWon, fmtPct } from '@/lib/admin/format';
import { CONCLUSIONS, quoteStatus, statusFromConclusion } from '@/lib/admin/status';
import CompanyLink from './CompanyLink';

export type Row = {
  id: number; sentAt: string | null; quoteNumber: string; testStandard: string | null;
  projectName: string; customerCompany: string | null; customerName: string | null; customerPhone: string | null;
  submissionPurpose: string | null; substanceType: string | null; owner: string; center: string;
  totalBeforeDiscount: number | null; discountRate: number; grandTotal: number | null;
  status: string; trackingNote: string | null;
};

async function patch(id: number, body: Record<string, unknown>) {
  await fetch(`/api/admin/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export default function QuoteStatusTable({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const setRow = (id: number, patchObj: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patchObj } : r)));

  // 결론 변경 → 상태 자동 파생 + 저장
  const changeConclusion = async (r: Row, val: string) => {
    const status = statusFromConclusion(val);
    setRow(r.id, { trackingNote: val || null, status });
    await patch(r.id, { trackingNote: val, status });
  };

  const th = 'px-3 py-2.5 font-medium text-left whitespace-nowrap';
  const td = 'px-3 py-2.5 align-top';

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-[1440px] w-full text-[13px]">
        <thead>
          <tr className="table-head border-b border-slate-200">
            <th className={th}>송부일</th>
            <th className={th}>견적번호</th>
            <th className={th}>시험기준</th>
            <th className={th}>견적명</th>
            <th className={th}>의뢰기관</th>
            <th className={th}>의뢰자</th>
            <th className={th}>제출용도</th>
            <th className={th}>물질종류</th>
            <th className={th}>담당자</th>
            <th className={`${th} text-right`}>견적금액</th>
            <th className={`${th} text-right`}>할인</th>
            <th className={th} style={{ minWidth: 170 }}>결론</th>
            <th className={th}>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = quoteStatus(r.status);
            return (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                <td className={`${td} whitespace-nowrap text-ink-body tabular-nums`}>{r.sentAt ?? '—'}</td>
                <td className={`${td} whitespace-nowrap mono-no`}>{r.quoteNumber}</td>
                <td className={`${td} whitespace-nowrap`}>{r.testStandard ? <span className="tag">{r.testStandard}</span> : '—'}</td>
                <td className={`${td} text-ink font-medium max-w-[280px]`}><span className="line-clamp-2" title={r.projectName}>{r.projectName}</span></td>
                <td className={`${td} whitespace-nowrap`}>{r.customerCompany
                  ? <CompanyLink name={r.customerCompany} className="text-ink hover:text-brand-600 transition-colors text-left" />
                  : <span className="text-ink">—</span>}</td>
                <td className={`${td} whitespace-nowrap text-ink-body`}>{r.customerName ?? '—'}<span className="block text-[11px] text-ink-subtle tabular-nums">{r.customerPhone ?? ''}</span></td>
                <td className={`${td} whitespace-nowrap text-ink-body`}>{r.submissionPurpose ?? '—'}</td>
                <td className={`${td} whitespace-nowrap text-ink-body`}>{r.substanceType ?? '—'}</td>
                <td className={`${td} whitespace-nowrap text-ink-body`}>{r.owner}<span className="block text-[11px] text-ink-subtle">{r.center}</span></td>
                <td className={`${td} whitespace-nowrap text-right font-semibold text-ink tabular-nums`}>{fmtWon(r.grandTotal ?? 0)}</td>
                <td className={`${td} whitespace-nowrap text-right text-ink-body tabular-nums`}>{r.discountRate ? fmtPct(r.discountRate, 0) : '—'}</td>
                <td className={td} style={{ minWidth: 170 }}>
                  <select value={CONCLUSIONS.includes(r.trackingNote as never) ? (r.trackingNote as string) : ''}
                    onChange={(e) => changeConclusion(r, e.target.value)}
                    className="text-[12px] rounded-md border border-slate-200 bg-[var(--card)] px-2 py-1 cursor-pointer w-full">
                    <option value="">— 미정 —</option>
                    {CONCLUSIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: st.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={13} className="py-12 text-center text-ink-subtle">견적 없음 — 엑셀 업로드로 시작하세요.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
