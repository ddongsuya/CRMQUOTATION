'use client';

import { useEffect, useState } from 'react';
import { Printer, AlertTriangle, Receipt, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { useWizard } from '@/lib/store';
import { toast } from '@/lib/toast';

type Totals = {
  currency: string;
  totalBeforeDiscount: number;
  discountAmount: number;
  totalAfterDiscount: number;
  vatAmount: number;
  grandTotal: number;
};

type Line = {
  kind: 'test' | 'analysis' | 'prep_analysis';  // R8: 조제물분석 (2026-05)
  testName: string;
  adminRoute: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  note?: string;
  guidelineCodes?: string[];   // 근거 가이드라인 (지식베이스 연결)
};

export default function LivePreview() {
  const s = useWizard();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (s.selections.length === 0) { setTotals(null); setLines([]); setWarnings([]); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetch('/api/quote/calculate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // Phase C-3: override 필드 그대로 전달 → assemble.js R7 적용
        selections: s.selections.map(x => ({
          key: x.key,
          quantity: x.quantity,
          unitPriceOverride:     x.unitPriceOverride     ?? null,
          studyWeeksOverride:    x.studyWeeksOverride    ?? null,
          hamryangCountOverride: x.hamryangCountOverride ?? null,
          customNote:            x.customNote            ?? null,
        })),
        excipientCount: s.excipientCount,
        priceStandard: s.priceStandard,
        discountRate: s.discountRate,
        currency: s.currency,
        exchangeRate: s.exchangeRate,
      }),
      signal: ctrl.signal,
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setTotals(d.totals); setWarnings(d.warnings); setLines(d.lines); })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        console.error(e);
        toast.error(`견적 계산 실패: ${e.message ?? '알 수 없는 오류'}`);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [s.selections, s.excipientCount, s.priceStandard, s.discountRate, s.currency, s.exchangeRate]);

  const symbol = s.currency === 'USD' ? '$' : '₩';
  const fmt = (n: number) => `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="print-root rounded-2xl bg-white border border-slate-200/70 shadow-card overflow-hidden">
      <header className="px-6 py-5 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold opacity-70 flex items-center gap-1.5">
              <Receipt className="w-3 h-3" /> 실시간 견적
            </div>
            <h3 className="font-bold text-lg mt-1 leading-tight">
              {s.projectName || <span className="opacity-60 font-normal italic">프로젝트명 미입력</span>}
            </h3>
            {s.substanceName && (
              <div className="text-xs opacity-75 mt-0.5">{s.substanceName}</div>
            )}
          </div>
          <div className="text-right text-xs space-y-0.5">
            <div className="inline-block px-2 py-0.5 rounded-full bg-white/15 backdrop-blur font-medium">
              {s.modality || '모달리티 미선택'}
            </div>
            <div className="opacity-75 tabular-nums">{s.priceStandard} · {s.currency}</div>
          </div>
        </div>
      </header>

      {s.selections.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 text-brand-400 mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <div className="text-sm text-ink-muted font-medium">
            왼쪽에서 시험 항목을 선택하면
          </div>
          <div className="text-xs text-ink-subtle mt-0.5">
            여기에 견적이 실시간으로 계산됩니다.
          </div>
        </div>
      ) : (
        <>
          {warnings.length > 0 && (
            <div className="border-b border-amber-200/70 bg-amber-50/60 px-6 py-3 text-xs text-amber-900">
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> 확인 필요
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {lines.some(l => l.unitPrice === 0 && l.kind === 'test') && (
            <div className="border-b border-red-200/70 bg-red-50/60 px-6 py-3 text-xs text-red-900 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">가격 미입력 항목 {lines.filter(l => l.unitPrice === 0 && l.kind === 'test').length}건</span>
                {' '}— 견적 발행 전에 영업담당과 협의가 필요합니다. (아래 표에서 빨간색으로 표시)
              </div>
            </div>
          )}

          <div className="max-h-[55vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-ink-muted">항목</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-ink-muted w-14">경로</th>
                  <th className="px-2 py-2.5 text-right font-semibold text-ink-muted w-24">단가</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-ink-muted w-10">수량</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-ink-muted w-28">소계</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  // Phase C-3: assemble.js 가 line.note 에 "[수동 가격]" 표시한 경우 시각적 강조
                  const isOverridden = !!l.note && /\[수동 가격\]/.test(l.note);
                  return (
                  <tr
                    key={i}
                    className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/40 transition-colors ${
                      l.kind === 'analysis' ? 'bg-brand-50/30' : ''
                    } ${l.kind === 'prep_analysis' ? 'bg-emerald-50/40' : ''} ${
                      l.unitPrice === 0 && l.kind === 'test' && !isOverridden ? 'bg-red-50/40' : ''
                    } ${isOverridden ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {l.kind === 'analysis' && (
                          <span className="pill bg-brand-100 text-brand-700">함량분석</span>
                        )}
                        {l.kind === 'prep_analysis' && (
                          <span className="pill bg-emerald-100 text-emerald-700">조제물분석</span>
                        )}
                        <span className="text-ink">{l.testName}</span>
                      </div>
                      {l.guidelineCodes && l.guidelineCodes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 pl-0.5">
                          {l.guidelineCodes.map(c => (
                            <span key={c} className="text-[9px] text-brand-600 bg-brand-50 border border-brand-100 rounded px-1 py-px">{c}</span>
                          ))}
                        </div>
                      )}
                      {l.note && <div className="text-[10px] text-ink-subtle pl-0.5 mt-0.5 whitespace-pre-line">{l.note}</div>}
                    </td>
                    <td className="px-2 py-2 text-ink-subtle">{l.adminRoute || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {isOverridden ? (
                        <span className="text-orange-700 font-medium inline-flex items-center gap-0.5">
                          <Pencil className="w-2.5 h-2.5" />{l.unitPrice.toLocaleString()}
                        </span>
                      ) : l.unitPrice === 0 && l.kind === 'test' ? (
                        <span className="text-red-500 font-medium">협의</span>
                      ) : (
                        <span className="text-ink-muted">{l.unitPrice.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-ink-muted tabular-nums">{l.quantity}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-ink">{l.subtotal.toLocaleString()}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totals && (
            <div className="border-t border-slate-100 px-6 py-5 bg-gradient-to-b from-slate-50/40 to-slate-50/80">
              <dl className="space-y-1.5 text-sm">
                <Row label="소계" value={fmt(totals.totalBeforeDiscount)} />
                {s.discountRate > 0 && (
                  <Row label={`할인 (${(s.discountRate * 100).toFixed(1)}%)`} value={`- ${fmt(totals.discountAmount)}`} muted />
                )}
                <Row label="할인 후" value={fmt(totals.totalAfterDiscount)} />
                <Row label="VAT (10% 별도)" value={fmt(totals.vatAmount)} muted />
                <div className="border-t border-slate-200/80 pt-3 mt-2">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">총 합계</dt>
                    <dd className="text-2xl font-bold text-ink tabular-nums tracking-tight">{fmt(totals.grandTotal)}</dd>
                  </div>
                </div>
              </dl>
            </div>
          )}

          <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between bg-white no-print">
            <div className="text-[11px] text-ink-subtle font-medium flex items-center gap-1.5">
              {loading ? (
                <><Loader2 className="w-3 h-3 animate-spin" />계산 중…</>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {lines.length}줄 · {s.selections.length}시험
                </span>
              )}
            </div>
            <button onClick={() => window.open('/quote/print', '_blank')} className="btn-primary text-xs px-3 py-1.5">
              <Printer className="w-3.5 h-3.5" />
              인쇄 / PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-ink-subtle' : 'text-ink-muted'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}
