'use client';

// ─── 연락처 ───
import Link from 'next/link';
import clsx from 'clsx';
import { Pencil, Trash2, Briefcase, Receipt } from 'lucide-react';
import Icon from '@/components/Icon';
import { DEAL_STAGE } from '@/lib/labels';
import { EmptyState } from '@/components/ui/State';
import { fmtWon, fmtWonM } from '../shared';
import type { Company, Contact, QuoteRow } from '../types';

export default function ContactsTab({ company, quotes, onAdd, onEdit, onDel, onAddDeal }: {
  company: Company; quotes: QuoteRow[]; onAdd: () => void; onEdit: (c: Contact) => void; onDel: (id: number) => void; onAddDeal: (id: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-1.5">의뢰자 {company.contacts.length}명</h2>
        <button onClick={onAdd} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 의뢰자 추가</button>
      </div>
      {company.contacts.length === 0 ? (
        <div className="card"><EmptyState compact title="등록된 의뢰자가 없습니다" description="의뢰자를 등록하면 안건·견적·기록을 담당자별로 모아 볼 수 있습니다." action={{ label: '의뢰자 추가', onClick: onAdd }} /></div>
      ) : company.contacts.map(ct => {
        // 담당자 기반 집계 — 이 의뢰자 명의로 저장된 견적(Quote.contactId). 금액은 공급가(VAT 별도)
        const ctQuotes = quotes.filter(q => q.contactId === ct.id);
        const ctQuoteSum = ctQuotes.reduce((s, q) => s + (q.supplyTotal ?? 0), 0);
        return (
        <div key={ct.id} className="card p-[22px] min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-ink flex items-center gap-2 flex-wrap">
                {ct.name}{ct.position && <span className="text-xs font-normal text-ink-subtle">{ct.position}</span>}
                {ctQuotes.length > 0 && <span className="pill bg-brand-100 text-brand-700">견적 {ctQuotes.length}건 · {fmtWonM(ctQuoteSum)} <span className="font-normal opacity-70">VAT 별도</span></span>}
              </div>
              <div className="text-xs text-ink-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {ct.email && <span className="inline-flex items-center gap-1 min-w-0"><Icon name="mail" className="w-3 h-3 flex-shrink-0" /><span className="truncate">{ct.email}</span></span>}
                {ct.phone && <span className="inline-flex items-center gap-1"><Icon name="phone" className="w-3 h-3" />{ct.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onEdit(ct)} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정" aria-label="수정"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDel(ct.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제" aria-label="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="mt-3 pl-1 space-y-1.5">
            {ct.deals.map(d => {
              const st = DEAL_STAGE[d.stage] ?? DEAL_STAGE.INQUIRY;
              return (
                <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center gap-2 py-1.5 px-2 -mx-1 rounded-lg hover:bg-slate-50/70">
                  <Briefcase className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{d.title}{d.modality && <span className="text-ink-subtle text-xs ml-1.5">{d.modality}</span>}</span>
                  <span className={clsx('pill flex-shrink-0', st.tone)}>{st.label}</span>
                  {d.status === 'LOST' && <span className="pill bg-red-100 text-red-700 flex-shrink-0">중단</span>}
                </Link>
              );
            })}
            {ctQuotes.map(q => (
              <Link key={`q-${q.id}`} href={`/quote/print?id=${q.id}`} className="flex items-center gap-2 py-1.5 px-2 -mx-1 rounded-lg hover:bg-slate-50/70">
                <Receipt className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
                <span className="font-mono text-[12px] text-brand-600 flex-shrink-0">{q.quoteNumber}</span>
                {q.supersededAt && <span className="pill bg-slate-200 text-ink-subtle flex-shrink-0">변경 전</span>}
                <span className="flex-1 min-w-0 text-xs text-ink-subtle truncate">{q.modality ?? ''}</span>
                <span className="text-sm font-semibold text-ink tabular-nums flex-shrink-0">{q.supplyTotal ? fmtWon(q.supplyTotal) : '—'}</span>
                <span className="text-[10px] text-ink-subtle flex-shrink-0">VAT 별도</span>
              </Link>
            ))}
            <button onClick={() => onAddDeal(ct.id)} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 py-1"><Icon name="plus" className="w-3.5 h-3.5" /> 안건 추가</button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
