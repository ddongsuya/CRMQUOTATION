'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { fmtWon, fmtPct } from '@/lib/admin/format';
import { QUOTE_STATUS } from '@/lib/admin/status';

export type Row = {
  id: number; sentAt: string | null; quoteNumber: string; testStandard: string | null;
  projectName: string; customerCompany: string | null; customerName: string | null; customerPhone: string | null;
  submissionPurpose: string | null; substanceType: string | null; owner: string; center: string;
  totalBeforeDiscount: number | null; discountRate: number; grandTotal: number | null;
  status: string; trackingNote: string | null;
};

const STATUS_ORDER = ['DRAFT', 'ISSUED', 'SENT', 'REVIEWED', 'ACCEPTED', 'REJECTED'];

async function patch(id: number, body: Record<string, unknown>) {
  await fetch(`/api/admin/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export default function QuoteStatusTable({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const setRow = (id: number, patchObj: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patchObj } : r)));

  const saveNote = async (r: Row) => {
    const val = taRef.current?.value ?? '';   // 비제어 — blur 시점 실제 값 사용
    setEditing(null);
    if (val === (r.trackingNote ?? '')) return;
    setRow(r.id, { trackingNote: val || null });
    await patch(r.id, { trackingNote: val });
  };
  const changeStatus = async (r: Row, status: string) => { setRow(r.id, { status }); await patch(r.id, { status }); };

  const th = 'px-3 py-2.5 font-medium text-left whitespace-nowrap';
  const td = 'px-3 py-2.5 align-top';

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-[1400px] w-full text-[13px]">
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
            <th className={th}>상태</th>
            <th className={th} style={{ minWidth: 220 }}>결론 · 추적</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
              <td className={`${td} whitespace-nowrap text-ink-body tabular-nums`}>{r.sentAt ?? '—'}</td>
              <td className={`${td} whitespace-nowrap mono-no`}>{r.quoteNumber}</td>
              <td className={`${td} whitespace-nowrap`}>{r.testStandard ? <span className="tag">{r.testStandard}</span> : '—'}</td>
              <td className={`${td} text-ink font-medium max-w-[280px]`}><span className="line-clamp-2" title={r.projectName}>{r.projectName}</span></td>
              <td className={`${td} whitespace-nowrap`}>{r.customerCompany
                ? <Link href="/admin/customers" className="text-ink hover:text-brand-600 transition-colors" title="고객 관리에서 보기">{r.customerCompany}</Link>
                : <span className="text-ink">—</span>}</td>
              <td className={`${td} whitespace-nowrap text-ink-body`}>{r.customerName ?? '—'}<span className="block text-[11px] text-ink-subtle tabular-nums">{r.customerPhone ?? ''}</span></td>
              <td className={`${td} whitespace-nowrap text-ink-body`}>{r.submissionPurpose ?? '—'}</td>
              <td className={`${td} whitespace-nowrap text-ink-body`}>{r.substanceType ?? '—'}</td>
              <td className={`${td} whitespace-nowrap text-ink-body`}>{r.owner}<span className="block text-[11px] text-ink-subtle">{r.center}</span></td>
              <td className={`${td} whitespace-nowrap text-right font-semibold text-ink tabular-nums`}>{fmtWon(r.grandTotal ?? 0)}</td>
              <td className={`${td} whitespace-nowrap text-right text-ink-body tabular-nums`}>{r.discountRate ? fmtPct(r.discountRate, 0) : '—'}</td>
              <td className={td}>
                <select value={r.status} onChange={(e) => changeStatus(r, e.target.value)}
                  className="text-[12px] rounded-md border border-slate-200 bg-[var(--card)] px-2 py-1 cursor-pointer"
                  style={{ color: QUOTE_STATUS[r.status]?.color ?? 'var(--body)' }}>
                  {STATUS_ORDER.map((s) => <option key={s} value={s} style={{ color: 'var(--body)' }}>{QUOTE_STATUS[s]?.label ?? s}</option>)}
                </select>
              </td>
              <td className={td} style={{ minWidth: 220 }}>
                {editing === r.id ? (
                  <textarea ref={taRef} autoFocus defaultValue={r.trackingNote ?? ''} onBlur={() => saveNote(r)}
                    rows={2} className="w-full text-[12px] rounded-md border border-[var(--accent)] px-2 py-1 resize-y"
                    placeholder="추적 관찰 결과 입력…" />
                ) : (
                  <button onClick={() => setEditing(r.id)}
                    className="text-left w-full text-[12px] rounded-md px-2 py-1 hover:bg-[var(--card-cream)] transition-colors min-h-[28px]"
                    style={{ color: r.trackingNote ? 'var(--body)' : 'var(--muted-soft)' }}>
                    {r.trackingNote || '추적 입력…'}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={13} className="py-12 text-center text-ink-subtle">견적 없음 — 엑셀 업로드로 시작하세요.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
