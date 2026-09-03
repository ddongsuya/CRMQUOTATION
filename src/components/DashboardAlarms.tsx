'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Bell, AlertTriangle, CalendarClock } from 'lucide-react';
import { EVENT_TYPE, tone } from '@/lib/labels';
import { diffDays, fmtDateShort } from '@/lib/dates';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/State';

type Item = { date: string; kind: string; type: string; title: string; dealId?: number; dealTitle?: string; company?: string; companyId?: number; quoteId?: number; taskId?: number; contact?: string; eventId?: number; done?: boolean };

export default function DashboardAlarms() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false); setItems(null);
    fetch('/api/crm/agenda').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setItems((d.items ?? []).filter((x: Item) => !x.done)); if (d.now) setNow(new Date(d.now)); })
      .catch(e => { console.error('[alarms] load failed', e); setError(true); setItems([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const heading = <h2 className="text-sm font-bold text-ink flex items-center gap-1.5"><Bell className="w-4 h-4 text-brand-500" /> 알람 · 예정 일정</h2>;

  if (items === null) return <section className="card p-5">{heading}<LoadingState compact label="알람 불러오는 중" /></section>;
  // 실패를 "예정 없음"으로 위장하지 않는다 — 마감을 놓치게 만드는 가장 위험한 침묵
  if (error) return <section className="card p-5">{heading}<ErrorState compact message="알람을 불러오지 못했습니다." onRetry={load} /></section>;

  // D-day — 로컬 자정 기준(lib/dates.diffDays). 서버가 준 now 를 기준일로.
  const dd = (it: Item) => diffDays(it.date, now) ?? 0;
  const upcoming = items.filter(x => dd(x) <= 14);
  const overdue = upcoming.filter(x => dd(x) < 0);
  const soon = upcoming.filter(x => dd(x) >= 0);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        {heading}
        <div className="flex items-center gap-2 text-[11px]">
          {overdue.length > 0 && <span className="pill bg-red-100 text-red-700">지연 {overdue.length}</span>}
          <Link href="/calendar" className="text-brand-600 hover:underline">캘린더</Link>
        </div>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState compact title="14일 내 예정된 일정이 없습니다" action={{ label: '일정 추가', href: '/calendar' }} />
      ) : (
        <ul className="divide-y divide-slate-50">
          {[...overdue, ...soon].slice(0, 8).map((it, i) => (
            <li key={`${it.kind}-${it.eventId ?? it.taskId ?? it.quoteId ?? i}-${it.date}`}>
              <Row it={it} dd={dd(it)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ it, dd }: { it: Item; dd: number }) {
  const overdue = dd < 0;
  const inner = (
    <div className="flex items-center gap-3 py-2">
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', tone(EVENT_TYPE, it.type, 'bg-slate-400'))} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">{it.title}</div>
        {(it.company || it.dealTitle) && <div className="text-[11px] text-ink-subtle truncate">{[it.company, it.dealTitle].filter(Boolean).join(' · ')}</div>}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-ink-muted tabular-nums">{fmtDateShort(it.date)}</div>
        <div className={clsx('text-[11px] font-medium inline-flex items-center gap-0.5', overdue ? 'text-red-600' : dd === 0 ? 'text-amber-600' : 'text-ink-subtle')}>
          {overdue ? <><AlertTriangle className="w-2.5 h-2.5" />{-dd}일 지남</> : dd === 0 ? '오늘' : <><CalendarClock className="w-2.5 h-2.5" />{dd}일 후</>}
        </div>
      </div>
    </div>
  );
  // 클릭 → 해당 내용 확인: 딜 상세 > 견적서 > 고객 상세 순으로 연결
  const href = it.dealId ? `/deals/${it.dealId}` : it.quoteId ? `/quote/print?id=${it.quoteId}` : it.companyId ? `/customers/${it.companyId}` : null;
  return href ? <Link href={href} className="block -mx-1 px-1 rounded hover:bg-slate-50/70">{inner}</Link> : <div className="-mx-1 px-1">{inner}</div>;
}
