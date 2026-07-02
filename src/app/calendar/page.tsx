'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2, X, Save, ArrowRight, GanttChartSquare } from 'lucide-react';
import { toast } from '@/lib/toast';

type Item = { date: string; kind: 'event' | 'milestone'; type: string; title: string; dealId?: number; dealTitle?: string; company?: string; eventId?: number; done?: boolean };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TYPE_CLS: Record<string, string> = {
  MEETING: 'bg-brand-500', DEADLINE: 'bg-red-500', MILESTONE: 'bg-emerald-500', REMINDER: 'bg-[#2a9d99]',
};

export default function CalendarPage() {
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null); // 추가 모달 날짜
  const [selected, setSelected] = useState<string>(() => ymd(new Date())); // 선택된 날짜(아젠다)

  const load = useCallback(() => {
    setLoading(true);
    const from = ymd(new Date(cur.y, cur.m, 1));
    const to = ymd(new Date(cur.y, cur.m + 1, 0));
    fetch(`/api/crm/agenda?from=${from}&to=${to}T23:59:59`).then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, [cur]);
  useEffect(() => { load(); }, [load]);

  // 42칸 그리드 (일요일 시작)
  const cells = useMemo(() => {
    const first = new Date(cur.y, cur.m, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cur]);

  const byDay = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const it of items) { const k = it.date.slice(0, 10); (m[k] ??= []).push(it); }
    return m;
  }, [items]);

  const todayKey = ymd(new Date());

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-[34px] font-bold tracking-[-0.022em] leading-[1.1] flex items-center gap-2"><CalendarDays className="w-6 h-6 text-brand-500" /> 캘린더</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCur(c => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))} className="btn-outline p-2 shrink-0"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-semibold text-ink w-28 text-center tabular-nums shrink-0">{cur.y}년 {cur.m + 1}월</span>
          <button onClick={() => setCur(c => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))} className="btn-outline p-2 shrink-0"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => { const d = new Date(); setCur({ y: d.getFullYear(), m: d.getMonth() }); }} className="btn-ghost text-xs shrink-0 whitespace-nowrap">오늘</button>
          <button onClick={() => setAdding(todayKey)} className="btn-primary text-sm shrink-0 whitespace-nowrap"><Plus className="w-4 h-4" /> 일정</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="card p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={clsx('text-center text-xs font-semibold py-1', i === 0 ? 'text-red-500' : i === 6 ? 'text-[#5b86c4]' : 'text-ink-subtle')}>{d}</div>)}
          </div>
          {loading ? <div className="py-16 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div> : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                const key = ymd(d);
                const inMonth = d.getMonth() === cur.m;
                const dayItems = byDay[key] ?? [];
                const isSel = key === selected;
                return (
                  <button key={i} onClick={() => setSelected(key)} className={clsx('min-h-[84px] rounded-lg border p-1.5 text-left align-top transition-colors',
                    isSel ? 'border-brand-400 ring-1 ring-brand-400 bg-brand-50' : key === todayKey ? 'border-brand-200 bg-brand-50/60' : inMonth ? 'border-slate-100 hover:bg-slate-50/70' : 'border-transparent bg-slate-50/40')}>
                    <div className={clsx('text-[11px] font-medium mb-1 tabular-nums flex items-center gap-1', key === todayKey ? 'text-brand-600 font-bold' : !inMonth ? 'text-ink-subtle/50' : d.getDay() === 0 ? 'text-red-500' : d.getDay() === 6 ? 'text-[#5b86c4]' : 'text-ink-muted')}>
                      {d.getDate()}{key === todayKey && <span className="pill bg-brand-600 text-white !text-[9px] !px-1">오늘</span>}
                    </div>
                    <div className="space-y-0.5">
                      {dayItems.slice(0, 3).map((it, j) => (
                        <div key={j} className={clsx('text-[10px] leading-tight rounded px-1 py-0.5 truncate flex items-center gap-1', it.done && 'opacity-40 line-through')} title={`${it.title}${it.company ? ` · ${it.company}` : ''}`}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', TYPE_CLS[it.type] ?? 'bg-slate-400')} /><span className="truncate text-ink-muted">{it.title}</span>
                        </div>
                      ))}
                      {dayItems.length > 3 && <div className="text-[10px] text-ink-subtle px-1">+{dayItems.length - 3}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-3 px-1 text-[11px] text-ink-muted">
            {Object.entries({ MEETING: '미팅/일정', DEADLINE: '마감(잔금 등)', MILESTONE: '보고서안 예정', REMINDER: '견적 팔로업' }).map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1"><span className={clsx('w-2.5 h-2.5 rounded-sm', TYPE_CLS[k])} />{l}</span>
            ))}
          </div>
        </div>

        {/* 아젠다 패널 */}
        <AgendaPanel date={selected} items={byDay[selected] ?? []} onAdd={() => setAdding(selected)} />
      </div>

      {adding && <EventModal date={adding} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} />}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = { MEETING: '미팅', DEADLINE: '마감', MILESTONE: '보고서안', REMINDER: '팔로업' };
function AgendaPanel({ date, items, onAdd }: { date: string; items: Item[]; onAdd: () => void }) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  // 이벤트 → 연동 화면
  const linkOf = (it: Item): string | null => {
    if (it.kind === 'milestone' && it.dealId) return `/gantt?deal=${it.dealId}`;
    if (it.dealId) return `/deals/${it.dealId}`;
    return null;
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
            const inner = (
              <div className={clsx('flex items-start gap-2.5 p-2.5 rounded-lg transition-colors', href ? 'hover:bg-slate-50 cursor-pointer' : '', it.done && 'opacity-50')}>
                <span className={clsx('w-2.5 h-2.5 rounded-full mt-1 shrink-0', TYPE_CLS[it.type] ?? 'bg-slate-400')} />
                <div className="min-w-0 flex-1">
                  <div className={clsx('text-sm text-ink', it.done && 'line-through')}>{it.title}</div>
                  <div className="text-[11px] text-ink-subtle flex items-center gap-1.5 mt-0.5">
                    <span>{TYPE_LABEL[it.type] ?? it.type}</span>
                    {it.company && <><span className="text-ink-subtle/40">·</span><span className="truncate">{it.company}</span></>}
                  </div>
                </div>
                {href && (it.kind === 'milestone' ? <GanttChartSquare className="w-3.5 h-3.5 text-ink-subtle shrink-0 mt-0.5" /> : <ArrowRight className="w-3.5 h-3.5 text-ink-subtle shrink-0 mt-0.5" />)}
              </div>
            );
            return href ? <li key={i}><Link href={href}>{inner}</Link></li> : <li key={i}>{inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

function EventModal({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', type: 'MEETING', startAt: date });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.title.trim()) { toast.error('제목을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, allDay: true }) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'fail'); toast.success('일정이 추가되었습니다.'); onSaved();
    } catch (e) { toast.error(`실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div className="font-semibold text-ink">새 일정</div><button onClick={onClose} className="text-ink-subtle hover:text-ink"><X className="w-5 h-5" /></button></header>
        <div className="px-5 py-4 space-y-3">
          <input className="input w-full" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="일정 제목" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <div><div className="label mb-1">날짜</div><input type="date" className="input w-full" value={f.startAt} onChange={e => setF(p => ({ ...p, startAt: e.target.value }))} /></div>
            <div><div className="label mb-1">유형</div><select className="input w-full" value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))}><option value="MEETING">미팅</option><option value="DEADLINE">마감</option><option value="REMINDER">리마인더</option></select></div>
          </div>
        </div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2"><button onClick={onClose} className="btn-ghost text-sm">취소</button><button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 추가</button></footer>
      </div>
    </div>
  );
}
