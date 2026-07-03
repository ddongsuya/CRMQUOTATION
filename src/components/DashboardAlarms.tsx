'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Bell, AlertTriangle, CalendarClock, Loader2 } from 'lucide-react';

type Item = { date: string; kind: string; type: string; title: string; dealId?: number; dealTitle?: string; company?: string; contact?: string; eventId?: number; done?: boolean };

const TYPE_DOT: Record<string, string> = { MEETING: 'bg-brand-500', DEADLINE: 'bg-red-500', MILESTONE: 'bg-emerald-500', REMINDER: 'bg-[var(--status-sent)]' };
const dayDiff = (d: string, now: Date) => Math.round((new Date(d.slice(0, 10)).getTime() - new Date(now.toISOString().slice(0, 10)).getTime()) / 86400_000);

export default function DashboardAlarms() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    fetch('/api/crm/agenda').then(r => r.json()).then(d => { setItems((d.items ?? []).filter((x: Item) => !x.done)); if (d.now) setNow(new Date(d.now)); }).catch(() => setItems([]));
  }, []);

  if (items === null) return <section className="card p-5"><div className="text-ink-subtle text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 알람 불러오는 중…</div></section>;

  const upcoming = items.filter(x => dayDiff(x.date, now) <= 14);
  const overdue = upcoming.filter(x => dayDiff(x.date, now) < 0);
  const soon = upcoming.filter(x => dayDiff(x.date, now) >= 0);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-ink flex items-center gap-1.5"><Bell className="w-4 h-4 text-brand-500" /> 알람 · 예정 일정</h2>
        <div className="flex items-center gap-2 text-[11px]">
          {overdue.length > 0 && <span className="pill bg-red-100 text-red-700">지연 {overdue.length}</span>}
          <Link href="/calendar" className="text-brand-600 hover:underline">캘린더</Link>
        </div>
      </div>
      {upcoming.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-subtle">14일 내 예정된 일정이 없습니다.</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {[...overdue, ...soon].slice(0, 8).map((it, i) => {
            const dd = dayDiff(it.date, now);
            return (
              <li key={i}>
                <Row it={it} dd={dd} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Row({ it, dd }: { it: Item; dd: number }) {
  const overdue = dd < 0;
  const inner = (
    <div className="flex items-center gap-3 py-2">
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', TYPE_DOT[it.type] ?? 'bg-slate-400')} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">{it.title}</div>
        {(it.company || it.dealTitle) && <div className="text-[11px] text-ink-subtle truncate">{[it.company, it.dealTitle].filter(Boolean).join(' · ')}</div>}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-ink-muted tabular-nums">{it.date.slice(5, 10).replace('-', '/')}</div>
        <div className={clsx('text-[11px] font-medium inline-flex items-center gap-0.5', overdue ? 'text-red-600' : dd === 0 ? 'text-amber-600' : 'text-ink-subtle')}>
          {overdue ? <><AlertTriangle className="w-2.5 h-2.5" />{-dd}일 지남</> : dd === 0 ? '오늘' : <><CalendarClock className="w-2.5 h-2.5" />{dd}일 후</>}
        </div>
      </div>
    </div>
  );
  return it.dealId ? <Link href={`/deals/${it.dealId}`} className="block -mx-1 px-1 rounded hover:bg-slate-50/70">{inner}</Link> : <div className="-mx-1 px-1">{inner}</div>;
}
