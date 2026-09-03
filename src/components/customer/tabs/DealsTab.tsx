'use client';

// ─── 딜 ───
import { useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { EmptyState, LoadingState } from '@/components/ui/State';
import { SectionCard, AddToggle, DealLine } from '../shared';
import type { Agg, ContactOpt } from '../types';

export default function DealsTab({ agg, contacts, onAddDeal, onAddContact }: { agg: Agg | null; contacts: ContactOpt[]; onAddDeal: (contactId: number) => void; onAddContact: () => void }) {
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState<number | ''>('');
  if (!agg) return <LoadingState compact />;
  const start = () => {
    if (contacts.length === 1) { onAddDeal(contacts[0].id); return; }
    setOpen(v => !v);
  };
  return (
    <SectionCard title="전체 딜" count={agg.deals.length}
      action={contacts.length > 0 && <AddToggle open={open} onToggle={start} label="안건 추가" />}>
      {open && contacts.length > 1 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 flex gap-2">
          <select className="input text-sm" aria-label="의뢰자" value={cid} onChange={e => setCid(Number(e.target.value))}>
            <option value="">의뢰자 선택…</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => { if (!cid) { toast.error('의뢰자를 선택하세요.'); return; } setOpen(false); onAddDeal(cid); }} className="btn-primary text-sm shrink-0"><Icon name="plus" className="w-4 h-4" /> 만들기</button>
        </div>
      )}
      {agg.deals.length === 0 ? (
        contacts.length === 0
          ? <EmptyState compact title="등록된 딜이 없습니다" description="먼저 의뢰자를 등록해야 안건을 만들 수 있습니다." action={{ label: '의뢰자 추가', onClick: onAddContact }} />
          : <EmptyState compact title="등록된 딜이 없습니다" description="문의가 들어오면 안건으로 만들어 견적·계약·시험을 한 줄기로 관리하세요." action={{ label: '안건 추가', onClick: start }} />
      ) : <div className="divide-y divide-slate-100">{agg.deals.map(d => <DealLine key={d.id} d={d} />)}</div>}
    </SectionCard>
  );
}
