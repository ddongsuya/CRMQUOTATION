'use client';

/**
 * 안건 파이프라인 — 단계별 칸반. "이번 달 어떤 안건이 어디에 멈춰 있나"를 한 화면에서.
 *  · 카드: 고객사·안건명·대표 견적 금액(공급가, VAT 별도)·마지막 활동·다음 할 일·계약 상태
 *  · 드래그로 단계 이동(PATCH /api/crm/deals/[id] { stage }) — 낙관적 갱신 + 실패 시 롤백
 *  · 상태 필터: 진행중(기본) / 수주 / 실주 / 전체. 실주 처리·사유 입력은 안건 상세에서.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GripVertical, AlertTriangle, CheckSquare, FileText, Plus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { DEAL_STAGE, DEAL_STAGE_ORDER, DEAL_STATUS, QUOTE_STATUS, CONTRACT_STATUS, label, tone, VAT_EXCL } from '@/lib/labels';
import { fmtRelative, fmtDate, diffDays } from '@/lib/dates';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/State';

type Card = {
  id: number; title: string; stage: string; status: string; lostReason: string | null; modality: string | null;
  company: { id: number; name: string }; contact: { id: number; name: string };
  quote: { id: number; quoteNumber: string; status: string; sentAt: string | null; validUntil: string | null } | null;
  amount: number | null; quoteCount: number; contractStatus: string | null;
  lastActivityAt: string | null; nextTask: { id: number; title: string; dueAt: string | null } | null;
  counts: { notes: number; tasks: number; studies: number }; updatedAt: string; createdAt: string;
};
type StatusFilter = 'ACTIVE' | 'WON' | 'LOST' | 'ALL';
const STALE_DAYS = 14;
const won = (n: number | null) => (n == null ? '—' : `₩${n.toLocaleString()}`);
const short = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(1)}억` : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString()}만` : n.toLocaleString());

export default function DealsPipelinePage() {
  const [deals, setDeals] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('ACTIVE');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/crm/deals?status=${status}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setDeals(d.deals ?? []);
    } catch (e) {
      console.error('[deals] load failed', e);
      setError(e instanceof Error ? e.message : '불러오기 실패');
      setDeals((prev) => prev ?? []);
    }
  }, [status]);
  useEffect(() => { setDeals(null); load(); }, [load]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!deals) return [];
    return t ? deals.filter((d) => [d.title, d.company.name, d.contact.name, d.modality ?? '', d.quote?.quoteNumber ?? ''].some((s) => s.toLowerCase().includes(t))) : deals;
  }, [deals, q]);
  const byStage = useMemo(() => {
    const m = new Map<string, Card[]>(DEAL_STAGE_ORDER.map((s) => [s, []]));
    for (const d of visible) (m.get(d.stage) ?? m.get('INQUIRY')!).push(d);
    return m;
  }, [visible]);
  const totals = useMemo(() => ({ count: visible.length, amount: visible.reduce((s, d) => s + (d.amount ?? 0), 0), stale: visible.filter((d) => isStale(d)).length }), [visible]);

  const moveStage = async (id: number, stage: string) => {
    const prev = deals; if (!prev) return;
    const cur = prev.find((d) => d.id === id); if (!cur || cur.stage === stage) return;
    setDeals(prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    try {
      const r = await fetch(`/api/crm/deals/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${r.status}`); }
      toast.success(`${cur.title} → ${label(DEAL_STAGE, stage)}`);
    } catch (e) {
      setDeals(prev);
      toast.error(`단계 변경 실패: ${e instanceof Error ? e.message : '오류'}`);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">안건 파이프라인</h1>
          <p className="text-[13px] text-ink-muted mt-0.5">
            {totals.count}건 · 합계 ₩{short(totals.amount)} <span className="text-ink-subtle">({VAT_EXCL})</span>
            {totals.stale > 0 && <span className="ml-2 pill bg-amber-100 text-amber-800">{STALE_DAYS}일 이상 정지 {totals.stale}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="sr-only" htmlFor="deal-q">안건 검색</label>
          <input id="deal-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="고객사·안건·견적번호" className="input h-9 w-[200px] text-[13px]" />
          <div className="segmented" role="group" aria-label="상태 필터">
            {([['ACTIVE', '진행중'], ['WON', '수주'], ['LOST', '실주'], ['ALL', '전체']] as [StatusFilter, string][]).map(([k, l]) => (
              <button key={k} type="button" className={status === k ? 'active' : ''} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>
            ))}
          </div>
          <Link href="/customers" className="btn-primary h-9 px-3.5 text-[13px]"><Plus className="w-4 h-4" aria-hidden="true" /> 새 안건</Link>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={load} compact />}
      {deals === null && !error && <LoadingState label="안건 불러오는 중" />}
      {deals !== null && deals.length === 0 && !error && (
        <div className="card">
          <EmptyState title={status === 'ACTIVE' ? '진행 중인 안건이 없습니다' : '해당 상태의 안건이 없습니다'}
            description="고객사 상세에서 의뢰자를 선택하고 안건을 만들면 이 보드에 나타납니다. 견적을 작성하면 자동으로 견적 단계로 이동합니다."
            action={{ label: '고객 관리로 이동', href: '/customers' }} secondary={{ label: '새 견적 작성', href: '/quote/start' }} />
        </div>
      )}

      {deals !== null && deals.length > 0 && (
        <div className="overflow-x-auto pb-3 -mx-1 px-1">
          <div className="flex gap-3 min-w-[1280px]">
            {DEAL_STAGE_ORDER.map((stage) => {
              const cards = byStage.get(stage) ?? [];
              const sum = cards.reduce((s, d) => s + (d.amount ?? 0), 0);
              const over = overStage === stage && dragId != null;
              return (
                <section key={stage} aria-label={`${label(DEAL_STAGE, stage)} 단계`}
                  className={`flex-1 min-w-[176px] rounded-xl border transition-colors ${over ? 'border-[var(--accent)] bg-[var(--accent-tint)]' : 'border-slate-200 bg-slate-50/60'}`}
                  onDragOver={(e) => { e.preventDefault(); if (overStage !== stage) setOverStage(stage); }}
                  onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                  onDrop={(e) => { e.preventDefault(); const id = Number(e.dataTransfer.getData('text/deal-id') || dragId); setOverStage(null); setDragId(null); if (id) moveStage(id, stage); }}>
                  <header className="px-3 pt-3 pb-2 flex items-center justify-between">
                    <span className={`pill text-[11px] ${tone(DEAL_STAGE, stage)}`}>{label(DEAL_STAGE, stage)}</span>
                    <span className="text-[11px] text-ink-subtle tabular-nums">{cards.length}건{sum > 0 ? ` · ₩${short(sum)}` : ''}</span>
                  </header>
                  <ul className="px-2 pb-2 space-y-2 min-h-[120px]">
                    {cards.map((d) => <DealCard key={d.id} d={d} dragging={dragId === d.id} onDragStart={(e) => { setDragId(d.id); e.dataTransfer.setData('text/deal-id', String(d.id)); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDragId(null); setOverStage(null); }} onMove={(s) => moveStage(d.id, s)} showStatus={status === 'ALL'} />)}
                    {cards.length === 0 && <li className="text-[11px] text-ink-subtle text-center py-6 select-none">여기로 끌어다 놓기</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function isStale(d: Card) {
  if (d.status !== 'ACTIVE' || d.stage === 'DONE') return false;
  const n = diffDays(new Date(), d.lastActivityAt);
  return n != null && n >= STALE_DAYS;
}

function DealCard({ d, dragging, onDragStart, onDragEnd, onMove, showStatus }: {
  d: Card; dragging: boolean; onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; onMove: (stage: string) => void; showStatus: boolean;
}) {
  const stale = isStale(d);
  const idx = DEAL_STAGE_ORDER.indexOf(d.stage as (typeof DEAL_STAGE_ORDER)[number]);
  const prev = idx > 0 ? DEAL_STAGE_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < DEAL_STAGE_ORDER.length - 1 ? DEAL_STAGE_ORDER[idx + 1] : null;
  const due = d.nextTask?.dueAt ? diffDays(d.nextTask.dueAt) : null;
  return (
    <li draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className={`card p-3 cursor-grab active:cursor-grabbing group ${dragging ? 'opacity-40' : ''} ${stale ? 'border-amber-300' : ''}`}>
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-ink-subtle mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Link href={`/deals/${d.id}`} className="block text-[13px] font-semibold text-ink leading-snug hover:underline truncate" title={d.title}>{d.title}</Link>
          <Link href={`/customers/${d.company.id}`} className="block text-[12px] text-ink-muted truncate hover:underline">{d.company.name} · {d.contact.name}</Link>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink tabular-nums">{won(d.amount)}</span>
        <span className="flex items-center gap-1">
          {d.quote && <span className="text-[10.5px] text-ink-subtle inline-flex items-center gap-0.5" title={`${d.quote.quoteNumber} · ${label(QUOTE_STATUS, d.quote.status)}`}><FileText className="w-3 h-3" aria-hidden="true" />{label(QUOTE_STATUS, d.quote.status)}</span>}
          {d.contractStatus && <span className={`pill text-[10px] ${tone(CONTRACT_STATUS, d.contractStatus)}`}>{label(CONTRACT_STATUS, d.contractStatus)}</span>}
          {showStatus && d.status !== 'ACTIVE' && <span className={`pill text-[10px] ${tone(DEAL_STATUS, d.status)}`}>{label(DEAL_STATUS, d.status)}</span>}
        </span>
      </div>
      <div className="mt-2 text-[11px] text-ink-subtle flex items-center justify-between gap-2">
        <span className={stale ? 'text-amber-700 inline-flex items-center gap-1' : ''} title={d.lastActivityAt ? fmtDate(d.lastActivityAt) : ''}>
          {stale && <AlertTriangle className="w-3 h-3" aria-hidden="true" />}마지막 활동 {fmtRelative(d.lastActivityAt)}
        </span>
        {d.lostReason && d.status === 'LOST' && <span className="truncate max-w-[45%]" title={d.lostReason}>사유 {d.lostReason}</span>}
      </div>
      {d.nextTask ? (
        <div className={`mt-1.5 text-[11.5px] inline-flex items-center gap-1 ${due != null && due < 0 ? 'text-red-700' : 'text-ink-muted'}`} title={d.nextTask.dueAt ? fmtDate(d.nextTask.dueAt) : '기한 없음'}>
          <CheckSquare className="w-3 h-3 flex-shrink-0" aria-hidden="true" /><span className="truncate">{d.nextTask.title}</span>{d.nextTask.dueAt && <span className="tabular-nums flex-shrink-0">{due === 0 ? '오늘' : due != null && due < 0 ? `${-due}일 지남` : `D-${due}`}</span>}
        </div>
      ) : d.status === 'ACTIVE' && d.stage !== 'DONE' ? (
        <Link href={`/deals/${d.id}`} className="mt-1.5 text-[11.5px] text-brand-600 hover:underline inline-block">다음 할 일 정하기 →</Link>
      ) : null}
      <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button type="button" disabled={!prev} onClick={() => prev && onMove(prev)} className="text-[11px] text-ink-subtle hover:text-ink disabled:opacity-30" aria-label={prev ? `${label(DEAL_STAGE, prev)} 단계로 이동` : '이전 단계 없음'}>← 이전</button>
        <button type="button" disabled={!next} onClick={() => next && onMove(next)} className="text-[11px] text-ink-subtle hover:text-ink disabled:opacity-30" aria-label={next ? `${label(DEAL_STAGE, next)} 단계로 이동` : '다음 단계 없음'}>다음 →</button>
      </div>
    </li>
  );
}
