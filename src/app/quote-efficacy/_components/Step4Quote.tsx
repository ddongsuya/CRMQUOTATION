'use client';

import PrintLayout from '@/app/quote/print/_components/PrintLayout';
import '@/app/quote/print/print.css';
import type { CostItem } from '@/lib/efficacy-engine/engine';
import { buildEfficacyPrintData } from '@/lib/efficacy-engine/print-data';
import type { EffState, QuoteTotals } from '../_lib/state';

/**
 * STEP 4 · 견적서 — 독성 모듈과 동일한 양식(PrintLayout + print.css).
 * 문서 조립은 buildEfficacyPrintData 한 곳에서만 하며, 저장된 견적 재출력(/quote/print)도 같은 빌더를 쓴다.
 */
export default function Step4Quote({ s, items, q, quoteNo, issueDate }: {
  s: EffState; items: CostItem[]; q: QuoteTotals; quoteNo: string; issueDate: Date;
}) {
  const data = buildEfficacyPrintData({
    state: s,
    lines: items.map((it) => ({
      category: it.category, name: it.name, unitPrice: it.unitPrice,
      quantity: it.quantity, multiplier: it.multiplier, subtotal: it.subtotal,
    })),
    totals: {
      totalBeforeDiscount: q.wp,
      discountAmount: q.discAmt,
      totalAfterDiscount: q.disc,
      vatAmount: q.vatAmt,
      grandTotal: q.vat,
    },
    quoteNo,
    issuedAt: issueDate,
  });

  return <PrintLayout data={data} />;
}
