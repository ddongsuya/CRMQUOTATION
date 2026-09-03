'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { useDrawer } from '@/components/admin/DrawerProvider';
import { quoteStatus } from '@/lib/admin/status';
import { supplyTotal } from '@/lib/money';
import { QUOTE_STATUS, QUOTE_STATUS_ORDER, label, VAT_EXCL } from '@/lib/labels';
import { fmtDate } from '@/lib/dates';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/State';

// 변경견적 차수 — 번호가 YY-MM-XX-NNNN-<n> 이면 n
const revOf = (num: string): number | null => {
  const m = /^\d{2}-\d{2}-[A-Za-z0-9]+-\d{4}-(\d+)$/.exec(num);
  return m ? Number(m[1]) : null;
};

type QuoteRow = {
  id: number;
  quoteNumber: string;
  supersededAt?: string | null;
  revisedFromId?: number | null;
  projectName: string;
  customerCompany: string | null;
  studyType: string;
  modality: string;
  status: string;
  grandTotal: number | null;
  totalAfterDiscount: number | null;
  currency: string;
  exchangeRate: number | null;
  issuedAt: string | null;
  updatedAt: string;
  createdAt: string;
  _count: { items: number };
};

// 상태 필터 — 라벨은 lib/labels(QUOTE_STATUS) 단일 소스, 상태점 색은 lib/admin/status(quoteStatus).
const FILTER_KEYS = ['ALL', ...QUOTE_STATUS_ORDER] as const;
const fmtM = (n: number) => n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(1)}M` : (n > 0 ? `₩${n.toLocaleString()}` : '₩0');
/**
 * 목록 금액 표시 — 공급가(VAT 별도) 기준, 천단위 구분. 금액은 DB에 원화로 저장되므로,
 * USD 견적은 저장 당시 환율로 나눠 달러로 표시. 구 데이터는 총액/1.1 역산.
 */
const supplyOf = (q: QuoteRow): number | null => supplyTotal(q);   // lib/money 단일 소스
const fmtAmount = (q: QuoteRow): string => {
  const n = supplyOf(q);
  if (n == null) return '—';
  if (q.currency === 'USD' && q.exchangeRate && q.exchangeRate > 0) {
    return `$${Math.round(n / q.exchangeRate).toLocaleString()}`;
  }
  return `₩${n.toLocaleString()}`;
};

/** 표시 행 — 현재 견적(supersededAt null) 아래에 그 변경 전 버전들을 들여써서 묶는다. */
type DisplayRow = { q: QuoteRow; depth: number };

export default function QuotesListPage() {
  const router = useRouter();
  const { openCompany } = useDrawer();
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [includeOld, setIncludeOld] = useState(false);   // 기본은 현재 진행 중(최신) 견적만

  const refresh = () => {
    setLoadError(null);
    fetch('/api/quotes').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setQuotes(d.quotes))
      .catch(e => { setLoadError(e.message); setQuotes(q => q ?? []); });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const remove = async (id: number, name: string) => {
    if (!confirm(`"${name}" 견적을 삭제하시겠습니까?`)) return;
    const r = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('삭제 완료'); refresh(); } else toast.error('삭제 실패');
  };
  /** 발송 처리 — status→SENT + sentAt 자동 기록(팔로업 알림 기준일). */
  const markSent = async (id: number) => {
    const r = await fetch(`/api/admin/quotes/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'SENT' }) });
    if (r.ok) { toast.success('발송 처리 완료 — 팔로업 추적이 시작됩니다.'); refresh(); } else toast.error('발송 처리 실패');
  };
  /** 복제 — 새 DRAFT 가 만들어지면 바로 그 견적서로 이동(토스트에 링크를 못 넣는 대신). */
  const duplicate = async (id: number) => {
    const r = await fetch(`/api/quotes/${id}`, { method: 'POST' });
    if (!r.ok) { toast.error('복제 실패'); return; }
    const d = await r.json().catch(() => null);
    const newId: number | undefined = d?.quote?.id;
    toast.success('복제 완료 — 새 견적서로 이동합니다.');
    if (newId) router.push(`/quote/print?id=${newId}`); else refresh();
  };

  const stats = useMemo(() => {
    const list = (quotes ?? []).filter(x => !x.supersededAt);   // 통계는 현재 진행 중(최신) 견적만
    const won = list.filter(x => x.status === 'ACCEPTED');
    return {
      total: list.length,
      inProgress: list.filter(x => ['DRAFT', 'ISSUED', 'SENT'].includes(x.status)).length,
      won: won.length,
      wonRate: list.length ? Math.round(won.length / list.length * 100) : 0,
      wonAmt: won.reduce((s, x) => s + (supplyOf(x) ?? 0), 0),
    };
  }, [quotes]);

  const oldCount = useMemo(() => (quotes ?? []).filter(x => x.supersededAt).length, [quotes]);

  // 현재 견적 → 상태 필터 → (옵션) 변경 전 버전을 revisedFromId 체인으로 따라가 바로 아래에 붙임
  const rows = useMemo<DisplayRow[]>(() => {
    const all = quotes ?? [];
    const byId = new Map(all.map(q => [q.id, q]));
    const current = all.filter(q => !q.supersededAt && (filter === 'ALL' || q.status === filter));
    if (!includeOld) return current.map(q => ({ q, depth: 0 }));
    const out: DisplayRow[] = [];
    const placed = new Set<number>();
    for (const q of current) {
      out.push({ q, depth: 0 }); placed.add(q.id);
      let prevId = q.revisedFromId ?? null;
      let depth = 1;
      while (prevId != null && !placed.has(prevId)) {
        const prev = byId.get(prevId);
        if (!prev) break;
        out.push({ q: prev, depth }); placed.add(prev.id);
        prevId = prev.revisedFromId ?? null; depth += 1;
      }
    }
    // 체인에 안 잡힌 이전 버전(원본이 삭제됐거나 필터 밖) — 맨 뒤에 평면으로
    for (const q of all) {
      if (q.supersededAt && !placed.has(q.id) && (filter === 'ALL' || q.status === filter)) out.push({ q, depth: 1 });
    }
    return out;
  }, [quotes, filter, includeOld]);

  return (
    <div className="animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">견적 목록</h1>
          <p className="text-subhead text-ink-body mt-2">발행·발송·수주 상태를 한눈에 추적하세요.</p>
        </div>
        <Link href="/quote/start" className="btn-primary"><Icon name="plus" className="w-4 h-4" /> 새 견적 작성</Link>
      </div>

      {/* 통계 4카드 — 아이콘 없음, 수주 금액 블랙 반전(#000) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="전체 견적" value={`${stats.total}`} unit="건" note="누적" />
        <StatCard label="진행 중" value={`${stats.inProgress}`} unit="건" note="작성·발행·발송" />
        <StatCard label="수주" value={`${stats.won}`} unit="건" note={`수주율 ${stats.wonRate}%`} />
        <StatCard label="수주 금액" value={fmtM(stats.wonAmt)} note={`누적 수주 · ${VAT_EXCL}`} invert />
      </div>

      {/* 상태 필터칩 + 이전 버전 토글 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTER_KEYS.map(k => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={clsx('chip', filter === k ? 'chip-active' : 'chip-inactive')}>
            {k === 'ALL' ? '전체' : label(QUOTE_STATUS, k)}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted cursor-pointer select-none">
          <input type="checkbox" checked={includeOld} onChange={e => setIncludeOld(e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          이전 버전 포함{oldCount > 0 && <span className="text-ink-subtle tabular-nums">({oldCount})</span>}
        </label>
      </div>

      {/* 테이블 */}
      {quotes === null ? (
        <div className="card"><LoadingState label="견적 불러오는 중" /></div>
      ) : loadError && quotes.length === 0 ? (
        <div className="card"><ErrorState message={loadError} onRetry={refresh} /></div>
      ) : rows.length === 0 ? (
        <div className="card">
          {quotes.length === 0
            ? <EmptyState title="저장된 견적이 없습니다" description="첫 견적을 작성하면 발행·발송·수주 상태를 이곳에서 추적할 수 있습니다." action={{ label: '새 견적 작성', href: '/quote/start' }} />
            : <EmptyState title="조건에 맞는 견적이 없습니다" description="상태 필터를 바꾸거나 이전 버전을 포함해 보세요." action={{ label: '새 견적 작성', href: '/quote/start' }} secondary={{ label: '필터 초기화', onClick: () => { setFilter('ALL'); setIncludeOld(true); } }} />}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[780px]">
              {/* 헤더 */}
              <div className="flex items-center px-6 py-[14px] text-[12px] font-medium text-ink-subtle">
                <div className="w-[150px] flex-shrink-0">견적번호</div>
                <div className="flex-1 min-w-0">고객사 · 모달리티</div>
                <div className="w-[84px] flex-shrink-0">상태</div>
                <div className="w-[96px] flex-shrink-0 text-right">작성일</div>
                <div className="w-[150px] flex-shrink-0 text-right">금액 <span className="text-[10px] font-normal text-ink-subtle">{VAT_EXCL}</span></div>
              </div>
              {/* 행 */}
              {rows.map(({ q: qr, depth }) => (
                <div key={qr.id} className={clsx('group relative flex items-center px-6 py-[15px] border-t border-[var(--hairline-soft)] hover:bg-slate-100 transition-colors', qr.supersededAt && 'opacity-55 bg-slate-50/40')}>
                  <Link href={`/quote/print?id=${qr.id}`} className="flex items-center flex-1 min-w-0">
                    <div className="w-[150px] flex-shrink-0 whitespace-nowrap flex items-start gap-1.5" style={depth > 0 ? { paddingLeft: Math.min(depth, 3) * 14 } : undefined}>
                      {depth > 0 && <span aria-hidden="true" className="text-ink-subtle/60 text-[12px] leading-[18px]">└</span>}
                      <span>
                        <span className="text-[13px] font-medium text-brand-600 font-mono tabular-nums">{qr.quoteNumber}</span>
                        {qr.supersededAt
                          ? <span className="block w-fit mt-0.5 pill bg-slate-200 text-ink-subtle">변경 전</span>
                          : revOf(qr.quoteNumber) != null && <span className="block w-fit mt-0.5 pill bg-brand-100 text-brand-700">변경 {revOf(qr.quoteNumber)}차 · 진행</span>}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="text-[16px] text-ink truncate">{qr.customerCompany || qr.projectName}</div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="pill flex-shrink-0" style={qr.studyType === 'efficacy'
                          ? { background: 'var(--accent-tint)', color: 'var(--accent-press)' }
                          : { background: 'var(--card-cream)', color: 'var(--muted)' }}>
                          {qr.studyType === 'efficacy' ? '효력' : '독성'}
                        </span>
                        <span className="text-[12px] text-ink-subtle truncate">{qr.modality}</span>
                      </div>
                    </div>
                    <div className="w-[84px] flex-shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-body">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: quoteStatus(qr.status).color }} />
                      {label(QUOTE_STATUS, qr.status)}
                    </div>
                    <div className="w-[96px] flex-shrink-0 text-right text-[12.5px] text-ink-subtle tabular-nums">{fmtDate(qr.updatedAt)}</div>
                    <div className="w-[150px] flex-shrink-0 text-right text-[16px] font-bold text-ink tabular-nums whitespace-nowrap">{fmtAmount(qr)}</div>
                  </Link>
                  {/* 액션 — 폰(hover 없음)에선 항상 노출, 데스크톱은 hover·키보드 포커스 시 */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-slate-100 rounded-lg px-1 py-0.5 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                    {(qr.status === 'DRAFT' || qr.status === 'ISSUED') && <button onClick={() => markSent(qr.id)} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600 focus-visible:opacity-100" title="발송 처리" aria-label="발송 처리"><Icon name="mail" className="w-3.5 h-3.5" /></button>}
                    {qr.customerCompany && <button onClick={() => openCompany(qr.customerCompany!)} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600 focus-visible:opacity-100" title="고객 상세" aria-label="고객 상세"><Icon name="users" className="w-3.5 h-3.5" /></button>}
                    <Link href={qr.studyType === 'efficacy' ? `/quote-efficacy?id=${qr.id}` : `/quote-v2?id=${qr.id}`} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600 focus-visible:opacity-100" title="내용 수정"><Icon name="notebook" className="w-3.5 h-3.5" /></Link>
                    <Link href={`/quote/print?id=${qr.id}`} target="_blank" className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600 focus-visible:opacity-100" title="PDF 출력"><Icon name="arrow-right" className="w-3.5 h-3.5" /></Link>
                    <button onClick={() => duplicate(qr.id)} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600 focus-visible:opacity-100" title="복제" aria-label="복제"><Icon name="plus" className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(qr.id, qr.projectName)} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-red-600 focus-visible:opacity-100" title="삭제" aria-label="삭제"><Icon name="x" className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, note, invert }: { label: string; value: string; unit?: string; note?: string; invert?: boolean }) {
  const box = invert ? 'bg-slate-900 text-white' : 'card';
  const labelC = invert ? 'text-white/85' : 'text-ink-muted';
  const numC = invert ? 'text-white' : 'text-ink';
  const noteC = invert ? 'text-white/72' : 'text-ink-muted';
  return (
    <div className={`${box} rounded-[12px] px-[22px] py-5`}>
      <div className={`text-[13px] font-medium ${labelC}`}>{label}</div>
      <div className="flex items-baseline gap-1.5 mt-2.5">
        <span className={`text-stat tabular-nums ${numC}`}>{value}</span>
        {unit && <span className={`text-[14px] ${labelC}`}>{unit}</span>}
      </div>
      {note && <div className={`text-[13px] font-medium mt-1.5 ${noteC}`}>{note}</div>}
    </div>
  );
}
