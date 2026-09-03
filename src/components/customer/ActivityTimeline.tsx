'use client';

/**
 * 활동 타임라인 — GET /api/crm/companies/{id}/activity?limit=60.
 * 기록·일정·할 일·견적·계약·시험·안건 이벤트를 최신순으로, 날짜별로 묶어 보여준다.
 * href 가 있으면 링크, 없는 기록·일정·할 일은 해당 탭의 수정 폼으로 점프(goTo).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { StickyNote, CalendarDays, CheckSquare, FileText, FileSignature, FlaskConical, Briefcase, ChevronRight } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/State';
import { fmtDateShort, fmtRelative, fmtTime, toYmd } from '@/lib/dates';
import { SectionCard } from './shared';
import type { ActivityItem, GoTo, Tab } from './types';

const KIND_ICON: Record<ActivityItem['kind'], React.ComponentType<{ className?: string }>> = {
  note: StickyNote, event: CalendarDays, task: CheckSquare, quote: FileText, contract: FileSignature, study: FlaskConical, deal: Briefcase,
};
const KIND_TAB: Partial<Record<ActivityItem['kind'], Tab>> = { note: '노트', event: '일정', task: '할 일' };

export default function ActivityTimeline({ companyId, refreshKey, onGo }: { companyId: number; refreshKey: unknown; onGo: GoTo }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const reqSeq = useRef(0);   // 빠른 화면 전환·연속 reload 시 이전 응답이 최신 목록을 덮어쓰지 않게
  const load = useCallback(() => {
    const my = ++reqSeq.current;
    setError(false);
    fetch(`/api/crm/companies/${companyId}/activity?limit=60`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: { items?: ActivityItem[] }) => { if (my === reqSeq.current) setItems(d.items ?? []); })
      .catch(e => { if (my === reqSeq.current) { setError(true); console.error('[company] activity load failed', e); } });
  }, [companyId]);
  // refreshKey(agg)가 바뀔 때마다 — 즉 탭 어디서든 저장/삭제 후 reload 되면 — 타임라인도 다시 받는다
  useEffect(() => { load(); }, [load, refreshKey]);

  let body: React.ReactNode;
  if (error) body = <ErrorState compact message="활동 내역을 불러오지 못했습니다." onRetry={load} />;
  else if (!items) body = <LoadingState compact label="활동 내역 불러오는 중" />;
  else if (items.length === 0) body = <EmptyState compact title="아직 활동이 없습니다" description="기록·일정·견적이 쌓이면 이곳에 시간순으로 모입니다." action={{ label: '기록 남기기', onClick: () => onGo('노트', { open: true }) }} />;
  else {
    // 날짜(로컬)별 그룹 — 응답이 최신순이므로 순서를 그대로 유지
    const groups: { day: string; items: ActivityItem[] }[] = [];
    for (const it of items) {
      const day = toYmd(it.at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(it); else groups.push({ day, items: [it] });
    }
    body = (
      <ol className="space-y-4">
        {groups.map(g => {
          const rel = fmtRelative(g.day);
          const short = fmtDateShort(g.day);
          return (
            <li key={g.day}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[12px] font-semibold text-ink">{rel}</span>
                {rel !== short && <span className="text-[11px] text-ink-subtle">{short}</span>}
                <span className="flex-1 border-t border-slate-100" aria-hidden="true" />
              </div>
              <ul className="divide-y divide-slate-50">
                {g.items.map(it => <Row key={`${it.kind}-${it.type ?? ''}-${it.refId}-${it.at}`} it={it} onGo={onGo} />)}
              </ul>
            </li>
          );
        })}
      </ol>
    );
  }
  return <SectionCard title="활동 타임라인" count={items?.length}>{body}</SectionCard>;
}

function Row({ it, onGo }: { it: ActivityItem; onGo: GoTo }) {
  const IconC = KIND_ICON[it.kind] ?? FileText;
  const inner = (
    <>
      <span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0', it.done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-ink-muted')} aria-hidden="true">
        <IconC className="w-3.5 h-3.5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className={clsx('block text-sm text-ink truncate', it.done && 'line-through text-ink-subtle')}>{it.title}</span>
        {it.detail && <span className="block text-[11px] text-ink-subtle truncate">{it.detail}</span>}
      </span>
      <span className="text-[11px] text-ink-subtle tabular-nums shrink-0">{fmtTime(it.at)}</span>
      <ChevronRight className="w-3.5 h-3.5 text-ink-subtle shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
    </>
  );
  const cls = 'group flex items-center gap-2.5 py-2 -mx-2 px-2 rounded-lg hover:bg-slate-50/70 w-full text-left';
  if (it.href) return <li><Link href={it.href} className={cls}>{inner}</Link></li>;
  const tab = KIND_TAB[it.kind];
  if (tab) return <li><button type="button" onClick={() => onGo(tab, { editId: it.refId })} className={cls} title={`${tab} 탭에서 열기`}>{inner}</button></li>;
  return <li><div className={cls}>{inner}</div></li>;
}
