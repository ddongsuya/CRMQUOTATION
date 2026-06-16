'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Save, Send, Loader2 } from 'lucide-react';
import { useWizard } from '@/lib/store';
import { toast } from '@/lib/toast';

export default function SectionPricing() {
  const s = useWizard();
  const [savingDraft, setSavingDraft] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const saveQuote = async (issueNow: boolean) => {
    const flag = issueNow ? setIssuing : setSavingDraft;
    flag(true);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectName: s.projectName,
          substanceName: s.substanceName,
          customerName: s.customerName,
          customerCompany: s.customerCompany,
          customerEmail: s.customerEmail,
          modality: s.modality,
          priceStandard: s.priceStandard,
          plan: s.plan,
          selections: s.selections.map(x => ({ key: x.key, quantity: x.quantity, tag: x.tag, priority: x.priority, source: x.source })),
          excipientCount: s.excipientCount,
          currency: s.currency,
          exchangeRate: s.exchangeRate,
          discountRate: s.discountRate,
          issueNow,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { quote: { id: number; quoteNumber: string } };
      toast.success(`${issueNow ? '견적 발행' : '임시저장'} 완료 · ${data.quote.quoteNumber}`);
    } catch (e) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      flag(false);
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <div className="label">통화</div>
        <div className="inline-flex p-1 bg-slate-100 rounded-lg">
          {(['KRW', 'USD'] as const).map(c => (
            <button
              key={c}
              onClick={() => s.patch({ currency: c })}
              className={clsx(
                'px-4 py-1.5 rounded-md text-xs font-semibold transition-all',
                s.currency === c ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {s.currency === 'USD' && (
        <div>
          <div className="label">환율 <span className="text-[10px] font-normal text-ink-subtle">(KRW/USD)</span></div>
          <input
            type="number"
            min={1}
            step={0.01}
            value={s.exchangeRate}
            onChange={(e) => s.patch({ exchangeRate: Number(e.target.value) || 1 })}
            className="input w-40"
          />
        </div>
      )}

      <div>
        <div className="label">할인율 <span className="text-[10px] font-normal text-ink-subtle">(%)</span></div>
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={(s.discountRate * 100).toFixed(1)}
          onChange={(e) => s.patch({ discountRate: Math.min(1, Math.max(0, (Number(e.target.value) || 0) / 100)) })}
          className="input w-40"
        />
      </div>

      <ul className="text-xs text-ink-muted space-y-1 pt-3 border-t border-slate-100">
        <li className="flex items-center gap-1.5"><Dot /> VAT 10% 별도</li>
        <li className="flex items-center gap-1.5"><Dot /> 유효기간 발행일 + 60일</li>
      </ul>

      <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => saveQuote(false)}
          disabled={savingDraft || s.selections.length === 0 || !s.projectName.trim()}
          className="btn-outline justify-center"
        >
          {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          임시저장
        </button>
        <button
          onClick={() => saveQuote(true)}
          disabled={issuing || s.selections.length === 0 || !s.projectName.trim()}
          className="btn-primary justify-center"
        >
          {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          견적 발행
        </button>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="inline-block w-1 h-1 rounded-full bg-brand-400" />;
}
