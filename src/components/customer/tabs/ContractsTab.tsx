'use client';

// ─── 계약 ───
import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Loader2, Save, FileSignature } from 'lucide-react';
import { toast } from '@/lib/toast';
import { CONTRACT_STATUS } from '@/lib/labels';
import { fmtDate } from '@/lib/dates';
import { EmptyState, LoadingState } from '@/components/ui/State';
import { SectionCard, AddToggle, DealSelect, fmtWon } from '../shared';
import type { Agg, DealOpt } from '../types';

export default function ContractsTab({ agg, deals, reload }: { agg: Agg | null; deals: DealOpt; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [dealId, setDealId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const noContractDeals = deals.filter(d => !(agg?.contracts ?? []).some(c => c.dealId === d.id));
  // 딜 없는 견적(임포트) → 계약 전환 대상
  const convertible = (agg?.quotes ?? []).filter((q) => !q.dealId && q.status !== 'REJECTED' && !q.supersededAt);   // 최신본만 전환 대상
  const convert = async (qid: number) => {
    setConvId(qid);
    const res = await fetch(`/api/crm/quotes/${qid}/to-contract`, { method: 'POST' });
    setConvId(null);
    if (res.ok) { toast.success('계약으로 전환 — 안건·계약 생성됨. 시험·노트 탭에서 이어서 관리하세요.'); reload(); }
    else toast.error('전환 실패');
  };
  const start = async () => {
    if (!dealId) { toast.error('안건을 선택하세요.'); return; }
    setBusy(true);
    const res = await fetch('/api/crm/contracts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId }) });
    setBusy(false);
    if (res.ok) { toast.success('계약 시작 — 기본 지급조건(선금50/잔금50) 생성'); setDealId(''); setOpen(false); reload(); } else toast.error('실패 — 견적이 있는 안건인지 확인하세요.');
  };
  if (!agg) return <LoadingState compact />;
  return (
    <SectionCard title="계약" count={agg.contracts.length}
      action={noContractDeals.length > 0 && <AddToggle open={open} onToggle={() => setOpen(v => !v)} label="계약 시작" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <p className="text-[11px] text-ink-subtle">견적 기반으로 계약을 시작합니다(선금 50% + 잔금 50%). 계약번호·회차는 딜 상세에서 편집.</p>
          <div className="flex gap-2">
            <DealSelect deals={noContractDeals} value={dealId} onChange={setDealId} />
            <button onClick={start} disabled={busy} className="btn-primary text-sm shrink-0">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 시작</button>
          </div>
        </div>
      )}
      {convertible.length > 0 && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <p className="text-[12px] font-medium text-ink mb-2">견적에서 계약 전환 <span className="text-ink-subtle font-normal">· 송부한 견적을 계약으로</span></p>
          <div className="space-y-1.5">
            {convertible.slice(0, 8).map((q) => (
              <div key={q.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[12px] text-brand-600 w-28 flex-shrink-0 truncate">{q.quoteNumber}</span>
                <span className="flex-1 min-w-0 text-ink-muted truncate">{q.contactName ? `${q.contactName} · ` : ''}{q.modality ?? ''}</span>
                <span className="text-[13px] font-semibold text-ink tabular-nums flex-shrink-0">{q.supplyTotal ? fmtWon(q.supplyTotal) : '—'}</span>
                <span className="text-[10px] text-ink-subtle flex-shrink-0">VAT 별도</span>
                <button onClick={() => convert(q.id)} disabled={convId === q.id} className="btn-ghost text-xs shrink-0">
                  {convId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />} 계약 전환
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {agg.contracts.length === 0 ? (
        <EmptyState compact title="등록된 계약이 없습니다"
          description={noContractDeals.length > 0 ? '견적이 있는 안건에서 계약을 시작하면 지급조건(선금·잔금)이 함께 만들어집니다.' : '견적을 계약으로 전환하거나, 안건을 만든 뒤 계약을 시작하세요.'}
          action={noContractDeals.length > 0 ? { label: '계약 시작', onClick: () => setOpen(true) } : undefined} />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
              <th scope="col" className="py-2 pr-2 font-medium">안건</th><th scope="col" className="py-2 px-2 font-medium w-32">계약번호</th>
              <th scope="col" className="py-2 px-2 font-medium w-20">상태</th><th scope="col" className="py-2 pl-2 font-medium w-24 text-right">체결일</th>
            </tr></thead>
            <tbody>
              {agg.contracts.map(c => {
                const st = CONTRACT_STATUS[c.status] ?? CONTRACT_STATUS.DRAFT;
                return (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-2"><Link href={`/deals/${c.dealId}`} className="text-ink hover:text-brand-600 truncate block max-w-[220px]">{c.dealTitle}</Link></td>
                    <td className="py-2.5 px-2 text-ink-muted tabular-nums">{c.contractNumber || '—'}</td>
                    <td className="py-2.5 px-2"><span className={clsx('pill', st.tone)}>{st.label}</span></td>
                    <td className="py-2.5 pl-2 text-right text-ink-muted tabular-nums">{fmtDate(c.signedAt)}</td>
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
