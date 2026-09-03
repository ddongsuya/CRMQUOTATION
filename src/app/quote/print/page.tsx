'use client';

import { useEffect, useRef, useState } from 'react';
import { Printer, Send, FileSignature, Loader2, GitBranch } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import Icon from '@/components/Icon';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWizard } from '@/lib/store';
import { toast } from '@/lib/toast';
import { QUOTE_STATUS, label, tone } from '@/lib/labels';
import { LoadingState } from '@/components/ui/State';
import PrintLayout, { type PrintData } from './_components/PrintLayout';
import { buildEfficacyPrintData, linesFromQuoteItems } from '@/lib/efficacy-engine/print-data';
import type { EffState } from '@/app/quote-efficacy/_lib/state';
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

/** DB 견적의 액션 바에 필요한 최소 정보 — 상태 전이·계약 전환 후 반영용 */
type QuoteMeta = { id: number; quoteNumber: string; status: string; dealId: number | null; studyType: string | null };

function PrintPage() {
  const s = useWizard();
  const router = useRouter();
  const params = useSearchParams();
  const quoteId = params.get('id');
  const [data, setData] = useState<PrintData | null>(null);
  const [quote, setQuote] = useState<QuoteMeta | null>(null);   // DB 견적일 때만
  const [editHref, setEditHref] = useState<string | null>(null);   // 시험 유형별 위저드로 되돌아가 수정(=변경견적)
  const [busy, setBusy] = useState<'send' | 'contract' | null>(null);
  // 모바일 화면 미리보기 — A4(210mm) 페이지를 화면폭에 맞춰 축소(인쇄 시엔 원본 유지)
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledH, setScaledH] = useState<number | undefined>(undefined);
  useEffect(() => {
    const A4_PX = (210 * 96) / 25.4; // ≈793.7px
    const compute = () => {
      // 실제 레이아웃 뷰포트폭 = clientWidth (window.innerWidth는 일부 환경서 부정확)
      const w = document.documentElement.clientWidth || window.innerWidth;
      const s = w < 820 ? Math.min(1, (w - 16) / A4_PX) : 1;
      setScale(s);
      setScaledH(s < 1 && innerRef.current ? innerRef.current.scrollHeight * s : undefined);
    };
    compute();
    const t = setTimeout(compute, 400); // 콘텐츠 로드 후 높이 재측정
    window.addEventListener('resize', compute);
    return () => { clearTimeout(t); window.removeEventListener('resize', compute); };
  }, [data]);
  const A4_PX = (210 * 96) / 25.4;

  useEffect(() => {
    if (quoteId) {
      // Hydrate from DB quote
      (async () => {
        try {
          const qRes = await fetch(`/api/quotes/${quoteId}`).then(r => r.json());
          const q = qRes.quote;
          if (!q) throw new Error(qRes.error ?? '견적을 찾을 수 없습니다.');
          setQuote({ id: q.id, quoteNumber: q.quoteNumber, status: q.status, dealId: q.dealId ?? null, studyType: q.studyType ?? null });
          let plan: Record<string, unknown> = {};
          try { plan = JSON.parse(q.planJson ?? '{}'); } catch { /* noop */ }

          // 효력시험 견적: 저장된 항목을 라인으로, planJson의 설계 상태를 표지·상세로 재조립.
          // 위저드 STEP4와 동일한 빌더를 사용해 문서가 어긋나지 않게 한다.
          if (q.studyType === 'efficacy' || plan.engine === 'efficacy') {
            setEditHref(`/quote-efficacy?id=${q.id}`);
            setData(buildEfficacyPrintData({
              state: plan as unknown as EffState,
              lines: linesFromQuoteItems(q.items),
              totals: {
                totalBeforeDiscount: q.totalBeforeDiscount ?? 0,
                discountAmount: (q.totalBeforeDiscount ?? 0) - (q.totalAfterDiscount ?? 0),
                totalAfterDiscount: q.totalAfterDiscount ?? 0,
                vatAmount: q.vatAmount ?? 0,
                grandTotal: q.grandTotal ?? 0,
              },
              quoteNo: q.quoteNumber,
              issuedAt: q.issuedAt ? new Date(q.issuedAt) : new Date(q.createdAt),
            }));
            return;
          }

          // 견적 엔진 v2 견적: 저장된 항목(권위 스냅샷)을 직접 렌더 (구 엔진 재평가 불가 — 새 마스터 키)
          const isV2 = plan.engine === 'v2';
          if (isV2) {
            setEditHref(`/quote-v2?id=${q.id}`);
            // 금액은 DB에 원화로 저장 → USD 견적은 저장 당시 환율로 환산해 표시(원화면 rate=1로 그대로).
            const rate = (q.currency === 'USD' && q.exchangeRate && q.exchangeRate > 0) ? q.exchangeRate : 1;
            const cv = (n: number) => rate === 1 ? n : Math.round(n / rate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lines = (q.items as any[]).map((it) => ({
              kind: (it.testItemKey?.startsWith('_prep') ? 'prep_analysis' : it.testItemKey?.startsWith('_hamryang') ? 'analysis' : 'test') as 'test' | 'analysis' | 'prep_analysis',
              testName: it.testNameSnapshot, adminRoute: it.adminRouteSnap ?? null,
              unitPrice: cv(it.unitPrice), quantity: it.quantity, subtotal: cv(it.subtotal), testItemKey: it.testItemKey,
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
              totals: { totalBeforeDiscount: cv(q.totalBeforeDiscount ?? 0), discountAmount: cv((q.totalBeforeDiscount ?? 0) - (q.totalAfterDiscount ?? 0)), totalAfterDiscount: cv(q.totalAfterDiscount ?? 0), vatAmount: cv(q.vatAmount ?? 0), grandTotal: cv(q.grandTotal ?? 0) },
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

  /** 발송 완료 — status→SENT (+ sentAt 자동, 팔로업 기준일). 성공 시 바의 상태칩만 갱신. */
  const markSent = async () => {
    if (!quote) return;
    setBusy('send');
    try {
      const r = await fetch(`/api/admin/quotes/${quote.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'SENT' }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
      setQuote(q => q ? { ...q, status: 'SENT' } : q);
      toast.success('발송 완료로 기록했습니다 — 팔로업 추적이 시작됩니다.');
    } catch (e) { toast.error(`발송 처리 실패: ${e instanceof Error ? e.message : '오류'}`); }
    finally { setBusy(null); }
  };
  /** 수주 · 계약 전환 — 안건·계약·시험 생성(멱등) 후 안건 상세로. */
  const toContract = async () => {
    if (!quote) return;
    if (!confirm('이 견적을 수주 처리하고 계약으로 전환할까요?\n안건·계약·시험 일정이 만들어집니다.')) return;
    setBusy('contract');
    try {
      const r = await fetch(`/api/crm/quotes/${quote.id}/to-contract`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      toast.success(d.already ? '이미 전환된 안건으로 이동합니다.' : '수주 · 계약 전환 완료 — 안건으로 이동합니다.');
      if (d.dealId) router.push(`/deals/${d.dealId}`);
      else setQuote(q => q ? { ...q, status: 'ACCEPTED' } : q);
    } catch (e) { toast.error(`계약 전환 실패: ${e instanceof Error ? e.message : '오류'}`); }
    finally { setBusy(null); }
  };

  if (!data) {
    return <LoadingState label="견적서 준비 중" />;
  }

  const canSend = !!quote && (quote.status === 'DRAFT' || quote.status === 'ISSUED');
  const canContract = !!quote && quote.status !== 'ACCEPTED' && quote.status !== 'REJECTED';

  return (
    <>
      {/* 액션 바 — 화면 전용(no-print). DB 견적이면 상태칩 + 발송/전환/변경견적, 위저드 미리보기면 인쇄만. */}
      <div className="sticky top-0 z-50 no-print border-b border-[var(--hairline-soft)] bg-[var(--card)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1100px] px-3 sm:px-4 py-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Link href="/" className="btn-ghost"><Icon name="chevron-left" className="w-4 h-4" /> <span className="hidden sm:inline">대시보드</span></Link>
            <Link href="/quotes" className="btn-ghost"><Icon name="list" className="w-4 h-4" /> <span className="hidden sm:inline">견적 목록</span></Link>
          </div>
          {quote && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[12.5px] text-ink-muted truncate">{quote.quoteNumber}</span>
              <span className={clsx('pill', tone(QUOTE_STATUS, quote.status))}>{label(QUOTE_STATUS, quote.status)}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
            {quote && canSend && (
              <button onClick={markSent} disabled={busy != null} className="btn-outline text-sm">
                {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} <span className="hidden sm:inline">발송 완료</span><span className="sm:hidden">발송</span>
              </button>
            )}
            {quote && canContract && (
              <button onClick={toContract} disabled={busy != null} className="btn-outline text-sm">
                {busy === 'contract' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />} <span className="hidden sm:inline">수주 · 계약 전환</span><span className="sm:hidden">계약</span>
              </button>
            )}
            {quote && quote.status === 'ACCEPTED' && quote.dealId && (
              <Link href={`/deals/${quote.dealId}`} className="btn-outline text-sm"><Icon name="arrow-right" className="w-4 h-4" /> <span className="hidden sm:inline">안건 보기</span><span className="sm:hidden">안건</span></Link>
            )}
            {quote && editHref && (
              <Link href={editHref} className="btn-ghost text-sm"><GitBranch className="w-4 h-4" /> <span className="hidden sm:inline">변경견적 만들기</span><span className="sm:hidden">변경</span></Link>
            )}
            <button onClick={() => window.print()} className="btn-primary text-sm">
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">인쇄 / PDF</span><span className="sm:hidden">인쇄</span>
            </button>
          </div>
        </div>
      </div>
      <div className="print-scale-outer" style={scaledH ? { height: scaledH } : undefined}>
        <div ref={innerRef} className="print-scale-inner" style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left', width: `${A4_PX}px` } : undefined}>
          <PrintLayout data={data} />
        </div>
      </div>
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
