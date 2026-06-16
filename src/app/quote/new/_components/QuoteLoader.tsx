'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWizard, type Selection } from '@/lib/store';
import { toast } from '@/lib/toast';

/**
 * If the URL contains `?id=N`, hydrate the wizard store from the saved quote.
 * Runs once on mount. Silent if no id; toasts on failure.
 */
export default function QuoteLoader() {
  const params = useSearchParams();
  const id = params.get('id');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/quotes/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ quote }) => {
        const plan = quote.planJson ? JSON.parse(quote.planJson) : {};
        const selections: Selection[] = quote.items.map((it: { testItemKey: string; testNameSnapshot: string; adminRouteSnap: string | null; unitPrice: number; quantity: number; priority: string | null; tag: string | null; source: string }) => ({
          key: it.testItemKey,
          testName: it.testNameSnapshot,
          adminRoute: it.adminRouteSnap,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          priority: (it.priority ?? undefined) as Selection['priority'],
          tag: it.tag ?? undefined,
          source: (it.source as Selection['source']) ?? 'preset',
        }));
        useWizard.setState({
          projectName: quote.projectName,
          substanceName: quote.substanceName ?? '',
          customerName: quote.customerName ?? '',
          customerCompany: quote.customerCompany ?? '',
          customerEmail: quote.customerEmail ?? '',
          modality: quote.modality,
          priceStandard: quote.priceStandard,
          plan: { ...useWizard.getState().plan, ...plan },
          selections,
          excipientCount: quote.excipientCount,
          currency: quote.currency,
          exchangeRate: quote.exchangeRate ?? 1400,
          discountRate: quote.discountRate,
          step: 4,
        });
        toast.info(`견적 ${quote.quoteNumber} 불러옴`);
      })
      .catch(e => toast.error(`불러오기 실패: ${e.message}`));
  }, [id]);

  return null;
}
