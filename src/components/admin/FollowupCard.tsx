'use client';

import { fmtWon } from '@/lib/admin/format';
import { useDrawer } from './DrawerProvider';
import Icon from '../Icon';

export type Followup = { id: number; quoteNumber: string; customerCompany: string | null; projectName: string; grandTotal: number | null; sentAt: string | null; trackingNote: string | null; days: number };

export default function FollowupCard({ rows }: { rows: Followup[] }) {
  const { openQuote } = useDrawer();
  if (!rows.length) return null;
  return (
    <div className="card card-pad mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2">
          <Icon name="phone" className="w-4 h-4 text-brand-600" /> 팔로업 필요 <span className="text-ink-subtle font-normal">{rows.length}</span>
        </h2>
        <span className="text-[12px] text-ink-subtle">송부 후 14일+ 미결</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.slice(0, 8).map((r) => {
          const tone = r.days >= 30 ? 'var(--error)' : 'var(--accent-press)';
          return (
            <button key={r.id} onClick={() => openQuote(r.id)} className="text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink truncate">{r.customerCompany ?? '—'}</span>
                <span className="text-[11px] font-semibold tabular-nums flex-shrink-0" style={{ color: tone }}>{r.days}일 경과</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-[11px] text-ink-subtle">{r.trackingNote ?? '미정'} · {r.sentAt}</span>
                <span className="text-[12px] font-semibold text-ink tabular-nums flex-shrink-0">{fmtWon(r.grandTotal ?? 0)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
