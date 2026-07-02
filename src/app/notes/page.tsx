'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { NotebookPen, Plus, Loader2, Trash2, Users, Briefcase, Phone, MessageSquare, Target, ListChecks, ArrowRight, Receipt, GanttChartSquare, CalendarDays, Check } from 'lucide-react';
import { toast } from '@/lib/toast';

type Note = { id: number; type: string; title: string | null; body: string; occurredAt: string; contact: { company: { id: number; name: string }; name: string } | null; deal: { id: number; title: string } | null };
type Ev = { id: number; title: string; type: string; startAt: string; done: boolean; dealId: number | null; dealTitle: string | null };

const TYPE: Record<string, { label: string; cls: string; dot: string; icon: React.ReactNode }> = {
  MEETING: { label: '미팅', cls: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500', icon: <Users className="w-3 h-3" /> },
  CALL: { label: '통화', cls: 'bg-[#e5f3f2] text-[#207a76]', dot: 'bg-[#2a9d99]', icon: <Phone className="w-3 h-3" /> },
  MEMO: { label: '메모', cls: 'bg-slate-100 text-ink-muted', dot: 'bg-slate-400', icon: <MessageSquare className="w-3 h-3" /> },
};
const today = () => new Date().toISOString().slice(0, 10);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// 긴급도: 지연/오늘/내일/이번주
function urgency(startAt: string): { key: string; label: string; cls: string; order: number } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const s = new Date(startAt); s.setHours(0, 0, 0, 0);
  const diff = Math.round((s.getTime() - t.getTime()) / 86400_000);
  if (diff < 0) return { key: 'overdue', label: '지연', cls: 'bg-red-100 text-red-700', order: 0 };
  if (diff === 0) return { key: 'today', label: '오늘', cls: 'bg-brand-100 text-brand-700', order: 1 };
  if (diff === 1) return { key: 'tomorrow', label: '내일', cls: 'bg-[#fce8d3] text-brand-800', order: 2 };
  if (diff <= 7) return { key: 'week', label: '이번주', cls: 'bg-slate-100 text-ink-muted', order: 3 };
  return { key: 'later', label: `${diff}일`, cls: 'bg-slate-100 text-ink-subtle', order: 4 };
}

export default function NotebookPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [weekDone, setWeekDone] = useState(0);
  const [f, setF] = useState({ type: 'MEMO', title: '', body: '', occurredAt: today() });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadNotes = () => fetch('/api/crm/notes').then(r => r.json()).then(d => setNotes(d.notes ?? [])).catch(() => setNotes([]));
  const loadEvents = () => fetch('/api/crm/notebook').then(r => r.json()).then(d => { setEvents(d.events ?? []); setWeekDone(d.weekDone ?? 0); }).catch(() => {});
  useEffect(() => { loadNotes(); loadEvents(); }, []);

  const todayFocus = useMemo(() => events.filter(e => dayKey(new Date(e.startAt)) === today()), [events]);
  const focusDone = todayFocus.filter(e => e.done).length;
  const followups = useMemo(() => events.filter(e => !e.done && dayKey(new Date(e.startAt)) !== today()).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)).slice(0, 8), [events]);

  const toggle = async (e: Ev) => {
    setEvents(evs => evs.map(x => x.id === e.id ? { ...x, done: !x.done } : x));
    await fetch(`/api/crm/events/${e.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !e.done }) }).catch(() => {});
    loadEvents();
  };
  const add = async () => {
    if (!f.body.trim()) { toast.error('내용을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'fail');
      toast.success('메모가 저장되었습니다.'); setF({ type: 'MEMO', title: '', body: '', occurredAt: today() }); setAdding(false); loadNotes();
    } catch (e) { toast.error(`저장 실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setSaving(false); }
  };
  const del = async (id: number) => { if (!confirm('이 메모를 삭제할까요?')) return; const res = await fetch(`/api/crm/notes/${id}`, { method: 'DELETE' }); if (res.ok) loadNotes(); };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><NotebookPen className="w-6 h-6 text-brand-500" /> 개인 기록</h1>
          <p className="text-sm text-ink-muted mt-0.5">오늘의 포커스·팔로업·업무 메모를 한 곳에서.</p>
        </div>
        <button onClick={() => setAdding(v => !v)} className="btn-primary"><Plus className="w-4 h-4" /> 새 메모</button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        {/* 좌 */}
        <div className="space-y-4 min-w-0">
          {/* 오늘의 포커스 */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-ink flex items-center gap-1.5"><Target className="w-4 h-4 text-brand-500" /> 오늘의 포커스</h2>
              <span className="text-xs text-ink-subtle tabular-nums">{focusDone}/{todayFocus.length} 완료</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-3">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${todayFocus.length ? (focusDone / todayFocus.length) * 100 : 0}%` }} />
            </div>
            {todayFocus.length === 0 ? <div className="py-4 text-center text-xs text-ink-subtle">오늘 예정된 일정이 없습니다.</div> : (
              <ul className="space-y-1.5">
                {todayFocus.map(e => (
                  <li key={e.id} className="flex items-center gap-2.5">
                    <button onClick={() => toggle(e)} className={clsx('w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors', e.done ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 hover:border-brand-400')}>{e.done && <Check className="w-3 h-3" />}</button>
                    <span className={clsx('flex-1 text-sm min-w-0 truncate', e.done ? 'line-through text-ink-subtle' : 'text-ink')}>{e.title}</span>
                    {e.dealId && <Link href={`/deals/${e.dealId}`} className="text-[11px] text-ink-subtle hover:text-brand-600 truncate max-w-[120px]">{e.dealTitle}</Link>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 팔로업 큐 */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink flex items-center gap-1.5 mb-3"><ListChecks className="w-4 h-4 text-brand-500" /> 팔로업 큐</h2>
            {followups.length === 0 ? <div className="py-4 text-center text-xs text-ink-subtle">예정된 팔로업이 없습니다.</div> : (
              <ul className="divide-y divide-slate-100">
                {followups.map(e => { const u = urgency(e.startAt); return (
                  <li key={e.id} className="flex items-center gap-2.5 py-2.5">
                    <span className={clsx('pill shrink-0', u.cls)}>{u.label}</span>
                    <span className="flex-1 min-w-0"><span className="block text-sm text-ink truncate">{e.title}</span><span className="block text-[11px] text-ink-subtle">{new Date(e.startAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}{e.dealTitle ? ` · ${e.dealTitle}` : ''}</span></span>
                    {e.dealId && <Link href={`/deals/${e.dealId}`} className="text-ink-subtle hover:text-brand-600"><ArrowRight className="w-4 h-4" /></Link>}
                  </li>
                ); })}
              </ul>
            )}
          </section>

          {/* 업무 메모 */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink flex items-center gap-1.5 mb-3"><MessageSquare className="w-4 h-4 text-brand-500" /> 업무 메모 {notes && <span className="text-xs font-normal text-ink-subtle">{notes.length}</span>}</h2>
            {adding && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 mb-3">
                <div className="flex gap-2 flex-wrap items-center">
                  {Object.entries(TYPE).map(([k, v]) => <button key={k} onClick={() => setF(p => ({ ...p, type: k }))} className={clsx('chip', f.type === k ? 'chip-active' : 'chip-inactive')}>{v.label}</button>)}
                  <input type="date" className="input text-sm ml-auto w-auto" value={f.occurredAt} onChange={e => setF(p => ({ ...p, occurredAt: e.target.value }))} />
                </div>
                <input className="input w-full text-sm" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="제목(선택)" />
                <textarea className="input w-full text-sm min-h-[70px]" value={f.body} onChange={e => setF(p => ({ ...p, body: e.target.value }))} placeholder="내용…" autoFocus />
                <div className="flex justify-end gap-2"><button onClick={() => setAdding(false)} className="btn-ghost text-sm">취소</button><button onClick={add} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 저장</button></div>
              </div>
            )}
            {notes === null ? <div className="py-6 text-center text-xs text-ink-subtle"><Loader2 className="w-4 h-4 mx-auto animate-spin" /></div>
              : notes.length === 0 ? <div className="py-6 text-center text-xs text-ink-subtle">메모가 없습니다.</div> : (
              <div className="grid sm:grid-cols-2 gap-2.5">
                {notes.map(n => { const t = TYPE[n.type] ?? TYPE.MEMO; return (
                  <div key={n.id} className="rounded-xl border border-slate-200 p-3 group">
                    <div className="flex items-center gap-2">
                      <span className={clsx('w-1.5 h-3.5 rounded-sm shrink-0', t.dot)} />
                      {n.title ? <span className="text-sm font-semibold text-ink truncate flex-1">{n.title}</span> : <span className={clsx('pill', t.cls)}>{t.label}</span>}
                      <span className="text-[10px] font-mono text-ink-subtle shrink-0">{n.occurredAt.slice(5, 10).replace('-', '.')}</span>
                      <button onClick={() => del(n.id)} className="p-1 rounded text-ink-subtle hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <div className="text-[13px] text-ink-muted mt-1.5 whitespace-pre-wrap line-clamp-4">{n.body}</div>
                    {n.deal && <Link href={`/deals/${n.deal.id}`} className="inline-flex items-center gap-1 mt-2 text-[10px] text-ink-subtle hover:text-brand-600"><Briefcase className="w-2.5 h-2.5" />{n.deal.title}</Link>}
                  </div>
                ); })}
              </div>
            )}
          </section>
        </div>

        {/* 우측 레일 */}
        <div className="space-y-4">
          {/* 이번주 요약 — 다크 카드 */}
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <div className="text-xs text-white/60 mb-2">이번 주 처리</div>
            <div className="text-3xl font-bold tabular-nums tracking-tight">{weekDone}<span className="text-base font-normal text-white/60 ml-1">건 완료</span></div>
            <div className="mt-2 flex gap-4 text-[11px] text-white/60">
              <span>팔로업 {events.filter(e => !e.done).length}</span>
              <span>메모 {notes?.length ?? 0}</span>
            </div>
          </div>
          {/* 빠른 이동 */}
          <section className="card p-4">
            <div className="label !mb-2">빠른 이동</div>
            <div className="space-y-0.5">
              {[['/quotes', '견적 목록', Receipt], ['/customers', '고객 관리', Users], ['/gantt', '시험 일정', GanttChartSquare], ['/calendar', '캘린더', CalendarDays]].map(([href, label, Icon]) => {
                const I = Icon as React.ElementType;
                return <Link key={href as string} href={href as string} className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-ink-muted hover:bg-slate-50 hover:text-ink"><I className="w-4 h-4 text-brand-500" />{label as string}<ArrowRight className="w-3.5 h-3.5 ml-auto text-ink-subtle" /></Link>;
              })}
            </div>
          </section>
          {/* 최근 본 (최근 메모의 딜) */}
          <section className="card p-4">
            <div className="label !mb-2">최근 활동</div>
            {notes && notes.filter(n => n.deal).slice(0, 5).length > 0 ? (
              <div className="space-y-0.5">
                {[...new Map(notes.filter(n => n.deal).map(n => [n.deal!.id, n.deal!])).values()].slice(0, 5).map(dl => (
                  <Link key={dl.id} href={`/deals/${dl.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-ink-muted hover:bg-slate-50 hover:text-ink"><Briefcase className="w-3.5 h-3.5 text-ink-subtle" /><span className="truncate">{dl.title}</span></Link>
                ))}
              </div>
            ) : <div className="py-3 text-center text-xs text-ink-subtle">최근 활동이 없습니다.</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
