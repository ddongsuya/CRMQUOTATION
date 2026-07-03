'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useWizard } from '@/lib/store';
import { toast } from '@/lib/toast';
import PrintLayout, { type PrintData } from './_components/PrintLayout';
import './print.css';

/**
 * Print-only route. Renders the wizard state (in-memory zustand store) as
 * a 3-section quote document and triggers the print dialog on mount.
 *
 * Once Prisma is wired in, a sibling route `/quote/[id]/print` will hydrate
 * from the persisted quote instead of the store.
 */
import { Suspense } from 'react';

export default function PrintPageWrapper() {
  return <Suspense fallback={null}><PrintPage /></Suspense>;
}

function PrintPage() {
  const s = useWizard();
  const params = useSearchParams();
  const quoteId = params.get('id');
  const [data, setData] = useState<PrintData | null>(null);

  useEffect(() => {
    if (quoteId) {
      // Hydrate from DB quote
      (async () => {
        try {
          const qRes = await fetch(`/api/quotes/${quoteId}`).then(r => r.json());
          const q = qRes.quote;
          // 견적 엔진 v2 견적: 저장된 항목(권위 스냅샷)을 직접 렌더 (구 엔진 재평가 불가 — 새 마스터 키)
          let isV2 = false;
          try { isV2 = JSON.parse(q.planJson ?? '{}').engine === 'v2'; } catch { /* noop */ }
          if (isV2) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lines = (q.items as any[]).map((it) => ({
              kind: (it.testItemKey?.startsWith('_prep') ? 'prep_analysis' : it.testItemKey?.startsWith('_hamryang') ? 'analysis' : 'test') as 'test' | 'analysis' | 'prep_analysis',
              testName: it.testNameSnapshot, adminRoute: it.adminRouteSnap ?? null,
              unitPrice: it.unitPrice, quantity: it.quantity, subtotal: it.subtotal, testItemKey: it.testItemKey,
            }));
            // 시험 항목 상세(인쇄 부록) — 새 마스터에서 조회
            const det = await fetch('/api/quote-v2/details', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              body: JSON.stringify({ ids: (q.items as any[]).map(it => it.testItemKey) }),
            }).then(r => r.json()).catch(() => ({ details: [] }));
            setData({
              meta: { quoteNo: q.quoteNumber, issuedAt: q.issuedAt ? new Date(q.issuedAt) : new Date(q.createdAt), validUntilDays: 60 },
              project: { projectName: q.projectName, substanceName: q.substanceName ?? '', modality: q.modality, customerCompany: q.customerCompany ?? '', customerName: q.customerName ?? '', customerEmail: q.customerEmail ?? '' },
              settings: { priceStandard: q.priceStandard, currency: q.currency, discountRate: q.discountRate, excipientCount: q.excipientCount },
              lines,
              totals: { totalBeforeDiscount: q.totalBeforeDiscount ?? 0, discountAmount: (q.totalBeforeDiscount ?? 0) - (q.totalAfterDiscount ?? 0), totalAfterDiscount: q.totalAfterDiscount ?? 0, vatAmount: q.vatAmount ?? 0, grandTotal: q.grandTotal ?? 0 },
              warnings: [], details: det.details ?? [],
            });
            return;
          }
          const calc = await fetch('/api/quote/calculate', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              selections: q.items.map((it: { testItemKey: string; quantity: number }) => ({ key: it.testItemKey, quantity: it.quantity })),
              excipientCount: q.excipientCount,
              priceStandard: q.priceStandard,
              discountRate: q.discountRate,
              currency: q.currency,
              exchangeRate: q.exchangeRate ?? 1400,
            }),
          }).then(r => r.json());
          const detail = await fetch('/api/items/by-keys', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ keys: q.items.map((it: { testItemKey: string }) => it.testItemKey) }),
          }).then(r => r.json());
          setData({
            meta: {
              quoteNo: q.quoteNumber,
              issuedAt: q.issuedAt ? new Date(q.issuedAt) : new Date(q.createdAt),
              validUntilDays: 60,
            },
            project: {
              projectName: q.projectName,
              substanceName: q.substanceName ?? '',
              modality: q.modality,
              customerCompany: q.customerCompany ?? '',
              customerName: q.customerName ?? '',
              customerEmail: q.customerEmail ?? '',
            },
            settings: {
              priceStandard: q.priceStandard,
              currency: q.currency,
              discountRate: q.discountRate,
              excipientCount: q.excipientCount,
            },
            lines: calc.lines,
            totals: calc.totals,
            warnings: calc.warnings,
            details: detail.items,
          });
        } catch (e) {
          toast.error(`견적 로딩 실패: ${e instanceof Error ? e.message : '알 수 없음'}`);
        }
      })();
      return;
    }
    // Else use current wizard store
    if (s.selections.length === 0) {
      toast.error('인쇄할 항목이 없습니다.');
      return;
    }
    fetch('/api/quote/calculate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selections: s.selections.map(x => ({ key: x.key, quantity: x.quantity })),
        excipientCount: s.excipientCount,
        priceStandard: s.priceStandard,
        discountRate: s.discountRate,
        currency: s.currency,
        exchangeRate: s.exchangeRate,
      }),
    })
      .then(r => r.json())
      .then(async (calc) => {
        const detailRes = await fetch('/api/items/by-keys', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keys: s.selections.map(x => x.key) }),
        });
        const detail = await detailRes.json() as { items: Array<{ key: string; detail?: string; notice?: string; quoteText?: string; guideline?: string }> };
        setData({
          meta: { quoteNo: previewQuoteNo(), issuedAt: new Date(), validUntilDays: 60 },
          project: {
            projectName: s.projectName, substanceName: s.substanceName, modality: s.modality,
            customerCompany: s.customerCompany, customerName: s.customerName, customerEmail: s.customerEmail,
          },
          settings: {
            priceStandard: s.priceStandard, currency: s.currency,
            discountRate: s.discountRate, excipientCount: s.excipientCount,
          },
          lines: calc.lines, totals: calc.totals, warnings: calc.warnings, details: detail.items,
        });
      })
      .catch(e => toast.error(`견적 로딩 실패: ${e.message}`));
  }, [quoteId, s.selections, s.excipientCount, s.priceStandard, s.discountRate, s.currency, s.exchangeRate,
      s.projectName, s.substanceName, s.modality, s.customerCompany, s.customerName, s.customerEmail]);

  if (!data) {
    return (
      <div className="text-center py-20 text-ink-muted text-sm">
        견적서 준비 중…
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50 no-print">
        <button
          onClick={() => window.print()}
          className="btn-primary"
        >
          <Printer className="w-4 h-4" /> 인쇄 / PDF 저장
        </button>
      </div>
      <PrintLayout data={data} />
    </>
  );
}

function previewQuoteNo(): string {
  // Format: CK-YYYYMMDD-XXX  (XXX is hash of localStorage entry id)
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `CK-${yyyy}${mm}${dd}-${rand}`;
}
