'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2, X, Save, ArrowRight, GanttChartSquare, Pencil, Trash2, Check } from 'lucide-react';
import { toast } from '@/lib/toast';
import EventDetailFields from '@/components/crm/EventDetailFields';

type Item = { date: string; kind: 'event' | 'milestone' | 'task'; type: string; title: string; taskId?: number; dealId?: number; dealTitle?: string; company?: string; companyId?: number; contactId?: number; quoteId?: number; eventId?: number; done?: boolean; location?: string | null; attendeesClient?: string | null; attendeesInternal?: string | null; requests?: string | null };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TYPE_CLS: Record<string, string> = {
  MEETING: 'bg-brand-500', DEADLINE: 'bg-red-500', MILESTONE: 'bg-emerald-500', REMINDER: 'bg-[var(--status-sent)]', TASK: 'bg-teal-500',
};

type View = 'week' | 'biweek' | 'month';
const VIEWS: [View, string][] = [['week', '주'], ['biweek', '2주'], ['month', '월간']];
const startOfWeek = (d: Date) => { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()); s.setDate(s.getDate() - s.getDay()); return s; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function CalendarPage() {
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(() => new Date());   // 현재 기간 기준일
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);   // 수동 일정 수정
  const [selected, setSelected] = useState<string>(() => ymd(new Date()));

  // 뷰별 셀(날짜) 계산
  const cells = useMemo(() => {
    if (view === 'month') {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const start = startOfWeek(first);
      return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(anchor);
    const len = view === 'week' ? 7 : 14;
    return Array.from({ length: len }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  const first = cells[0], last = cells[cells.length - 1];

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/crm/agenda?from=${ymd(first)}&to=${ymd(last)}T23:59:59`).then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => setItems([])).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymd(first), ymd(last)]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const it of items) { const k = it.date.slice(0, 10); (m[k] ??= []).push(it); }
    return m;
  }, [items]);

  const todayKey = ymd(new Date());
  const shift = (dir: number) => setAnchor(a => view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * (view === 'week' ? 7 : 14)));
  const rangeLabel = view === 'month'
    ? `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`
    : `${first.getMonth() + 1}월 ${first.getDate()}일 – ${last.getMonth() + 1}월 ${last.getDate()}일`;
  // 뷰별 셀 높이·표시 이벤트 수
  const cellH = view === 'week' ? 'min-h-[360px]' : view === 'biweek' ? 'min-h-[150px]' : 'min-h-[92px]';
  const maxEv = view === 'week' ? 12 : view === 'biweek' ? 6 : 3;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">캘린더</h1>
          <p className="text-subhead text-ink-body mt-2">주·2주·월간으로 전환하고, 날짜를 선택하면 오른쪽에 그날 일정이 열립니다.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 뷰 전환 세그먼트 */}
          <div className="segmented inline-flex gap-[3px] p-[3px] rounded-lg bg-slate-100">
            {VIEWS.map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={clsx('px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors', view === v ? 'bg-[var(--card)] text-brand-600 shadow-[var(--shadow-float)]' : 'text-ink-muted hover:text-ink')}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} aria-label="이전 기간" className="icon-btn"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setAnchor(new Date())} className="btn-ghost text-[13px] whitespace-nowrap">오늘</button>
            <button onClick={() => shift(1)} aria-label="다음 기간" className="icon-btn"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setAdding(selected)} className="btn-primary text-sm shrink-0 whitespace-nowrap"><Plus className="w-4 h-4" /> 일정</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <div className="card p-4">
          {/* 기간 라벨 */}
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div className="text-[17px] font-bold text-ink tracking-tight tabular-nums">{rangeLabel}</div>
            <div className="text-[12px] text-ink-subtle">{VIEWS.find(([v]) => v === view)?.[1]} 뷰 · {items.length}건</div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={clsx('text-center text-[12px] font-semibold py-1', i === 0 ? 'text-red-500' : i === 6 ? 'text-[var(--sat)]' : 'text-ink-subtle')}>{d}</div>)}
          </div>
          {loading ? <div className="py-16 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div> : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                const key = ymd(d);
                const inMonth = view !== 'month' || d.getMonth() === anchor.getMonth();
                const dayItems = byDay[key] ?? [];
                const isSel = key === selected;
                const isToday = key === todayKey;
                return (
                  <button key={i} onClick={() => setSelected(key)} aria-pressed={isSel} className={clsx(cellH, 'rounded-lg border p-1.5 text-left align-top transition-colors flex flex-col',
                    isSel ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50' : isToday ? 'border-brand-300 bg-brand-50/50' : inMonth ? 'border-slate-200 hover:bg-slate-100' : 'border-transparent bg-slate-50/50')}>
                    <div className={clsx('text-[12px] font-semibold mb-1.5 tabular-nums flex items-center justify-between', isToday ? 'text-brand-600' : !inMonth ? 'text-ink-subtle/40' : d.getDay() === 0 ? 'text-red-500' : d.getDay() === 6 ? 'text-[var(--sat)]' : 'text-ink-muted')}>
                      <span className={clsx(isToday && 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white')}>{d.getDate()}</span>
                    </div>
                    <div className="space-y-1 flex-1 min-h-0">
                      {dayItems.slice(0, maxEv).map((it, j) => (
                        <div key={j} className={clsx('text-[11px] leading-tight rounded px-1.5 py-1 truncate flex items-center gap-1.5', it.done ? 'opacity-40 line-through' : 'bg-slate-100/70')} title={`${it.title}${it.company ? ` · ${it.company}` : ''}`}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', TYPE_CLS[it.type] ?? 'bg-slate-400')} /><span className="truncate text-ink">{it.title}</span>
                        </div>
                      ))}
                      {dayItems.length > maxEv && <div className="text-[10px] text-ink-subtle px-1">+{dayItems.length - maxEv}건 더</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-3 px-1 text-[11px] text-ink-muted">
            {Object.entries({ MEETING: '미팅/일정', TASK: '할 일(기한)', DEADLINE: '마감(잔금 등)', MILESTONE: '보고서안 예정', REMINDER: '견적 팔로업' }).map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1"><span className={clsx('w-2.5 h-2.5 rounded-sm', TYPE_CLS[k])} />{l}</span>
            ))}
          </div>
        </div>

        {/* 아젠다 패널 */}
        <AgendaPanel date={selected} items={byDay[selected] ?? []} onAdd={() => setAdding(selected)}
          onEdit={it => setEditing(it)} onReload={load} />
      </div>

      {adding && <EventModal date={adding} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} />}
      {editing && <EventModal date={editing.date.slice(0, 10)} event={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = { MEETING: '미팅', DEADLINE: '마감', MILESTONE: '보고서안', REMINDER: '팔로업', TASK: '할 일' };
function AgendaPanel({ date, items, onAdd, onEdit, onReload }: { date: string; items: Item[]; onAdd: () => void; onEdit: (it: Item) => void; onReload: () => void }) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  // 이벤트 → 연동 화면 (파생 알림은 딜/견적/고객으로)
  const linkOf = (it: Item): string | null => {
    if (it.kind === 'milestone' && it.dealId) return `/gantt?deal=${it.dealId}`;
    if (it.dealId) return `/deals/${it.dealId}`;
    if (it.kind === 'milestone' && it.quoteId) return `/quote/print?id=${it.quoteId}`;
    if (it.companyId) return `/customers/${it.companyId}`;
    return null;
  };
  const toggleDone = async (it: Item) => {
    const url = it.kind === 'task' ? `/api/crm/tasks/${it.taskId}` : `/api/crm/events/${it.eventId}`;
    const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !it.done }) });
    if (res.ok) onReload(); else toast.error('변경 실패');
  };
  const del = async (it: Item) => {
    if (!confirm(it.kind === 'task' ? '이 할 일을 삭제할까요?' : '이 일정을 삭제할까요?')) return;
    const url = it.kind === 'task' ? `/api/crm/tasks/${it.taskId}` : `/api/crm/events/${it.eventId}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제됨'); onReload(); } else toast.error('삭제 실패');
  };
  return (
    <div className="card p-4 self-start lg:sticky lg:top-4">
      <div className="flex items-center justify-between mb-3">
        <div><div className="text-sm font-bold text-ink">{label}</div><div className="text-[11px] text-ink-subtle">{items.length}건 일정</div></div>
        <button onClick={onAdd} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 추가</button>
      </div>
      {items.length === 0 ? <div className="py-8 text-center text-xs text-ink-subtle">이 날짜에 일정이 없습니다.</div> : (
        <ul className="space-y-1.5">
          {items.map((it, i) => {
            const href = linkOf(it);
            const editable = (it.kind === 'event' && it.eventId != null) || (it.kind === 'task' && it.taskId != null);
            const body = (
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className={clsx('w-2.5 h-2.5 rounded-full mt-1 shrink-0', TYPE_CLS[it.type] ?? 'bg-slate-400')} />
                <div className="min-w-0 flex-1">
                  <div className={clsx('text-sm text-ink', it.done && 'line-through')}>{it.title}</div>
                  <div className="text-[11px] text-ink-subtle flex items-center gap-1.5 mt-0.5">
                    <span>{TYPE_LABEL[it.type] ?? it.type}</span>
                    {it.company && <><span className="text-ink-subtle/40">·</span><span className="truncate">{it.company}</span></>}
                    {it.location && <><span className="text-ink-subtle/40">·</span><span className="truncate">{it.location}</span></>}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={`${it.kind}-${it.eventId ?? it.taskId ?? it.quoteId ?? i}-${it.date}`} className={clsx('group flex items-start gap-1 p-2.5 rounded-lg transition-colors hover:bg-slate-50', it.done && 'opacity-50')}>
                {href ? <Link href={href} className="flex min-w-0 flex-1">{body}</Link> : body}
                <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editable && <>
                    <button onClick={() => toggleDone(it)} className="p-1 rounded text-ink-subtle hover:text-emerald-600 hover:bg-emerald-50" title={it.done ? '완료 해제' : '완료 처리'} aria-label={it.done ? '완료 해제' : '완료 처리'}><Check className="w-3.5 h-3.5" /></button>
                    {it.kind === 'event' && <button onClick={() => onEdit(it)} className="p-1 rounded text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정" aria-label="수정"><Pencil className="w-3.5 h-3.5" /></button>}
                    <button onClick={() => del(it)} className="p-1 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제" aria-label="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>}
                  {href && !editable && (it.kind === 'milestone' ? <GanttChartSquare className="w-3.5 h-3.5 text-ink-subtle mt-0.5" /> : <ArrowRight className="w-3.5 h-3.5 text-ink-subtle mt-0.5" />)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EventModal({ date, event, onClose, onSaved }: { date: string; event?: Item; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: event?.title ?? '', type: event?.type ?? 'MEETING', startAt: date,
    location: event?.location ?? '', attendeesClient: event?.attendeesClient ?? '', attendeesInternal: event?.attendeesInternal ?? '', requests: event?.requests ?? '',
  });
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const save = async () => {
    if (!f.title.trim()) { toast.error('제목을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = event?.eventId
        ? await fetch(`/api/crm/events/${event.eventId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, allDay: true }) })
        : await fetch('/api/crm/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, allDay: true }) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'fail');
      toast.success(event ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.'); onSaved();
    } catch (e) { toast.error(`실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div id={titleId} className="font-semibold text-ink">{event ? '일정 수정' : '새 일정'}</div><button onClick={onClose} aria-label="닫기" className="text-ink-subtle hover:text-ink"><X className="w-5 h-5" /></button></header>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-auto">
          <input className="input w-full" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="일정 제목" aria-label="일정 제목" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label mb-1">날짜</span><input type="date" className="input w-full" value={f.startAt} onChange={e => setF(p => ({ ...p, startAt: e.target.value }))} /></label>
            <label className="block"><span className="label mb-1">유형</span><select className="input w-full" value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))}><option value="MEETING">미팅</option><option value="DEADLINE">마감</option><option value="MILESTONE">마일스톤</option><option value="REMINDER">리마인더</option></select></label>
          </div>
          <EventDetailFields f={f} set={(k, v) => setF(p => ({ ...p, [k]: v }))} />
        </div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2"><button onClick={onClose} className="btn-ghost text-sm">취소</button><button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {event ? '수정 저장' : '추가'}</button></footer>
      </div>
    </div>
  );
}
