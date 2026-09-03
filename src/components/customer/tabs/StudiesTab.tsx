'use client';

// ─── 시험 ───
import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/lib/toast';
import { fmtDate } from '@/lib/dates';
import { EmptyState, LoadingState } from '@/components/ui/State';
import { SectionCard, AddToggle, DealSelect, dday } from '../shared';
import type { Agg, DealOpt } from '../types';

export default function StudiesTab({ agg, deals, reload }: { agg: Agg | null; deals: DealOpt; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ dealId: number | ''; itemName: string }>({ dealId: '', itemName: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!f.dealId || !f.itemName.trim()) { toast.error('안건·시험 항목명을 입력하세요.'); return; }
    setBusy(true);
    const res = await fetch('/api/crm/studies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId: f.dealId, itemName: f.itemName }) });
    setBusy(false);
    if (res.ok) { toast.success('시험 추가됨'); setF({ dealId: '', itemName: '' }); setOpen(false); reload(); } else toast.error('저장 실패');
  };
  if (!agg) return <LoadingState compact />;
  return (
    <SectionCard title="시험" count={agg.studies.length}
      action={deals.length > 0 && <AddToggle open={open} onToggle={() => setOpen(v => !v)} label="시험 추가" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <DealSelect deals={deals} value={f.dealId} onChange={v => setF(s => ({ ...s, dealId: v }))} />
          <input className="input text-sm w-full" placeholder="시험 항목명 (예: 설치류 13주 반복투여 독성)" aria-label="시험 항목명" value={f.itemName} onChange={e => setF(s => ({ ...s, itemName: e.target.value }))} />
          <div className="flex justify-end"><button onClick={add} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 추가</button></div>
        </div>
      )}
      {agg.studies.length === 0 ? (
        <EmptyState compact title="등록된 시험이 없습니다"
          description={deals.length === 0 ? '견적을 계약으로 전환(계약 탭)하면 안건·계약·시험이 자동 생성됩니다.' : '안건에 시험 항목을 추가하면 시험번호·책임자·보고서 일정을 여기서 추적합니다.'}
          action={deals.length > 0 ? { label: '시험 추가', onClick: () => setOpen(true) } : undefined} />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
              <th scope="col" className="py-2 pr-2 font-medium">시험 / 안건</th><th scope="col" className="py-2 px-2 font-medium w-24">시험번호</th>
              <th scope="col" className="py-2 px-2 font-medium w-20">책임자</th><th scope="col" className="py-2 px-2 font-medium w-24">보고서안 예정</th>
              <th scope="col" className="py-2 pl-2 font-medium w-16 text-right">상태</th>
            </tr></thead>
            <tbody>
              {agg.studies.map(s => {
                const dd = dday(s.reportDraftDueAt);
                return (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-2"><Link href={`/deals/${s.dealId}`} className="text-ink hover:text-brand-600 truncate block max-w-[200px]">{s.itemName || s.dealTitle}</Link></td>
                    <td className="py-2.5 px-2 text-ink-muted tabular-nums">{s.studyNumber || '—'}</td>
                    <td className="py-2.5 px-2 text-ink-muted">{s.director || '—'}</td>
                    <td className="py-2.5 px-2 text-ink-muted tabular-nums">{fmtDate(s.reportDraftDueAt)}</td>
                    <td className="py-2.5 pl-2 text-right">
                      {s.reportDraftIssuedAt ? <span className="pill bg-emerald-100 text-emerald-700">발행</span> : dd ? <span className={clsx('pill', dd.cls)}>{dd.label}</span> : <span className="pill tone-blue">진행</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
