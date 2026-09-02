'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Plus, Loader2, Trash2, Briefcase, Check } from 'lucide-react';
import Icon, { type IconName } from '@/components/Icon';
import { toast } from '@/lib/toast';

type Note = { id: number; type: string; title: string | null; body: string; occurredAt: string; contact: { company: { id: number; name: string }; name: string } | null; deal: { id: number; title: string } | null };
type Task = { id: number; title: string; memo: string | null; dueAt: string | null; done: boolean; companyId: number | null; companyName: string | null; dealId: number | null; dealTitle: string | null };
type TodayEv = { id: number; title: string; type: string; location: string | null; dealId: number | null; dealTitle: string | null; companyId: number | null; companyName: string | null };

const TYPE: Record<string, { label: string; cls: string; dot: string }> = {
  MEETING: { label: '미팅', cls: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500' },
  CALL: { label: '통화', cls: 'tone-sent', dot: 'bg-[var(--status-sent)]' },
  MEMO: { label: '메모', cls: 'bg-slate-100 text-ink-muted', dot: 'bg-slate-400' },
};
// 로컬(KST) 기준 날짜 키 — toISOString(UTC)을 쓰면 오전 9시 전까지 "오늘"이 어제로 판정되는 버그가 있었음
const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localYmd(new Date());
const dayKey = (d: Date) => localYmd(d);

// 긴급도: 지연/오늘/내일/이번주
function urgency(startAt: string): { key: string; label: string; cls: string; order: number } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const s = new Date(startAt); s.setHours(0, 0, 0, 0);
  const diff = Math.round((s.getTime() - t.getTime()) / 86400_000);
  if (diff < 0) return { key: 'overdue', label: '지연', cls: 'bg-red-100 text-red-700', order: 0 };
  if (diff === 0) return { key: 'today', label: '오늘', cls: 'bg-brand-100 text-brand-700', order: 1 };
  if (diff === 1) return { key: 'tomorrow', label: '내일', cls: 'tone-accent', order: 2 };
  if (diff <= 7) return { key: 'week', label: '이번주', cls: 'bg-slate-100 text-ink-muted', order: 3 };
  return { key: 'later', label: `${diff}일`, cls: 'bg-slate-100 text-ink-subtle', order: 4 };
}

export default function NotebookPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayEvents, setTodayEvents] = useState<TodayEv[]>([]);
  const [weekDone, setWeekDone] = useState(0);
  const [f, setF] = useState({ type: 'MEMO', title: '', body: '', occurredAt: today() });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickTask, setQuickTask] = useState('');
  const [quickDue, setQuickDue] = useState(today());

  const loadNotes = () => fetch('/api/crm/notes').then(r => r.json()).then(d => setNotes(d.notes ?? [])).catch(() => setNotes([]));
  const loadTasks = () => fetch('/api/crm/notebook').then(r => r.json()).then(d => { setTasks(d.tasks ?? []); setTodayEvents(d.todayEvents ?? []); setWeekDone(d.weekDone ?? 0); }).catch(() => {});
  useEffect(() => { loadNotes(); loadTasks(); }, []);

  // 오늘의 포커스 = 기한이 오늘인 할 일 (완료 포함 — 진행률 표시)
  const todayFocus = useMemo(() => tasks.filter(t => t.dueAt && dayKey(new Date(t.dueAt)) === today()), [tasks]);
  const focusDone = todayFocus.filter(t => t.done).length;
  // 팔로업 큐 = 오늘이 아닌 미완료 할 일 (지연 포함, 기한 없는 것은 뒤에)
  const followups = useMemo(() => tasks
    .filter(t => !t.done && !(t.dueAt && dayKey(new Date(t.dueAt)) === today()))
    .sort((a, b) => (a.dueAt ? +new Date(a.dueAt) : Infinity) - (b.dueAt ? +new Date(b.dueAt) : Infinity))
    .slice(0, 10), [tasks]);

  const toggle = async (t: Task) => {
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x));   // 낙관적 반영
    try {
      const res = await fetch(`/api/crm/tasks/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !t.done }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: t.done } : x));   // 실패 시 되돌리고 알림
      toast.error('완료 상태 변경에 실패했습니다.'); console.error('[notes] toggle failed', e);
    }
    loadTasks();
  };
  const delTask = async (id: number) => {
    const res = await fetch(`/api/crm/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) loadTasks(); else toast.error('삭제 실패');
  };
  const addTask = async () => {
    if (!quickTask.trim()) return;
    const res = await fetch('/api/crm/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: quickTask, dueAt: quickDue || null }) });
    if (res.ok) { setQuickTask(''); loadTasks(); } else toast.error('추가 실패');
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
          <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">개인 기록</h1>
          <p className="text-subhead text-ink-body mt-2">오늘의 할 일·팔로업·메모를 모아보는 나만의 작업 공간.</p>
        </div>
        <button onClick={() => setAdding(v => !v)} className="btn-primary"><Plus className="w-4 h-4" /> 새 메모</button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        {/* 좌 */}
        <div className="space-y-4 min-w-0">
          {/* 오늘의 포커스 — 기한이 오늘인 할 일 */}
          <section className="card pt-5 px-[22px] pb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[22px] font-bold text-ink tracking-tight">오늘의 포커스 <span className="text-[13px] font-normal text-ink-subtle">할 일</span></h2>
              <span className="text-[13px] text-ink-subtle tabular-nums">{focusDone}/{todayFocus.length} 완료</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-3">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${todayFocus.length ? (focusDone / todayFocus.length) * 100 : 0}%` }} />
            </div>
            {/* 빠른 할 일 추가 */}
            <div className="flex gap-1.5 mb-3">
              <input className="input text-sm flex-1" placeholder="할 일 추가 (예: 아이큐어 번역의뢰서 영문본 재요청)" aria-label="할 일 추가" value={quickTask}
                onChange={e => setQuickTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask(); }} />
              <input type="date" className="input text-sm w-auto" title="기한" value={quickDue} onChange={e => setQuickDue(e.target.value)} />
              <button onClick={addTask} className="btn-primary text-sm shrink-0"><Plus className="w-4 h-4" /></button>
            </div>
            {todayFocus.length === 0 ? <div className="py-3 text-center text-xs text-ink-subtle">오늘 기한인 할 일이 없습니다.</div> : (
              <ul className="space-y-1.5">
                {todayFocus.map(t => (
                  <li key={t.id} className="flex items-center gap-2.5 group">
                    <button onClick={() => toggle(t)} role="checkbox" aria-checked={t.done} aria-label={`${t.title} 완료`} className={clsx('w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors', t.done ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 hover:border-brand-400')}>{t.done && <Check className="w-3 h-3" />}</button>
                    <span className={clsx('flex-1 text-sm min-w-0 truncate', t.done ? 'line-through text-ink-subtle' : 'text-ink')}>{t.title}</span>
                    {(t.dealId || t.companyId) && (
                      <Link href={t.dealId ? `/deals/${t.dealId}` : `/customers/${t.companyId}`} className="text-[11px] text-ink-subtle hover:text-brand-600 truncate max-w-[130px]">{t.dealTitle ?? t.companyName}</Link>
                    )}
                    <button onClick={() => delTask(t.id)} className="p-1 rounded text-ink-subtle hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                  </li>
                ))}
              </ul>
            )}
            {/* 오늘 일정(약속) — 참고 표시 */}
            {todayEvents.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-ink-subtle mb-1.5">오늘 일정 (약속)</div>
                <ul className="space-y-1">
                  {todayEvents.map(e => (
                    <li key={e.id}>
                      <Link href={e.dealId ? `/deals/${e.dealId}` : e.companyId ? `/customers/${e.companyId}` : '/calendar'} className="flex items-center gap-2 text-[13px] text-ink-muted hover:text-brand-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                        <span className="truncate">{e.title}</span>
                        {(e.companyName || e.location) && <span className="text-[11px] text-ink-subtle truncate">{[e.companyName, e.location].filter(Boolean).join(' · ')}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 팔로업 큐 — 오늘이 아닌 미완료 할 일 (지연 포함) */}
          <section className="card pt-5 px-[22px] pb-5">
            <h2 className="text-[22px] font-bold text-ink tracking-tight mb-3">팔로업 큐 <span className="text-[13px] font-normal text-ink-subtle">할 일</span></h2>
            {followups.length === 0 ? <div className="py-4 text-center text-xs text-ink-subtle">예정된 팔로업이 없습니다. 위 입력창에서 할 일을 추가해 보세요.</div> : (
              <ul className="divide-y divide-slate-100">
                {followups.map(t => { const u = t.dueAt ? urgency(t.dueAt) : { label: '기한 없음', cls: 'bg-slate-100 text-ink-subtle' }; return (
                  <li key={t.id} className="flex items-center gap-2.5 py-2.5 group">
                    <button onClick={() => toggle(t)} role="checkbox" aria-checked={false} aria-label={`${t.title} 완료 처리`} className="w-[18px] h-[18px] rounded-md border border-slate-300 hover:border-brand-400 flex items-center justify-center shrink-0" title="완료 처리" />
                    <span className={clsx('pill shrink-0', u.cls)}>{u.label}</span>
                    <span className="flex-1 min-w-0"><span className="block text-sm text-ink truncate">{t.title}</span><span className="block text-[11px] text-ink-subtle">{t.dueAt ? new Date(t.dueAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : ''}{(t.dealTitle || t.companyName) ? `${t.dueAt ? ' · ' : ''}${t.dealTitle ?? t.companyName}` : ''}</span></span>
                    <button onClick={() => delTask(t.id)} className="p-1 rounded text-ink-subtle hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                    {(t.dealId || t.companyId) && <Link href={t.dealId ? `/deals/${t.dealId}` : `/customers/${t.companyId}`} className="text-ink-subtle hover:text-brand-600"><Icon name="arrow-right" className="w-4 h-4" /></Link>}
                  </li>
                ); })}
              </ul>
            )}
          </section>

          {/* 업무 메모 */}
          <section className="card pt-5 px-[22px] pb-5">
            <h2 className="text-[22px] font-bold text-ink tracking-tight mb-3">업무 메모 {notes && <span className="text-[14px] font-normal text-ink-subtle">{notes.length}</span>}</h2>
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
          {/* 이번주 요약 — 피처 다크 카드(#191919) */}
          <div className="rounded-[12px] bg-slate-900 pt-5 px-[22px] pb-5 text-white">
            <div className="text-[13px] text-white/60 mb-2">이번 주 처리</div>
            <div className="text-[34px] font-bold tabular-nums tracking-tight leading-none">{weekDone}<span className="text-base font-normal text-white/60 ml-1.5">건 완료</span></div>
            <div className="mt-3 flex gap-4 text-[12px] text-white/60">
              <span>미완료 할 일 {tasks.filter(t => !t.done).length}</span>
              <span>메모 {notes?.length ?? 0}</span>
            </div>
          </div>
          {/* 빠른 이동 */}
          <section className="card pt-4 px-4 pb-4">
            <div className="text-[15px] font-semibold text-ink mb-2.5">빠른 이동</div>
            <div className="space-y-0.5">
              {([['/quotes', '견적 목록', 'list'], ['/customers', '고객 관리', 'users'], ['/gantt', '시험 일정', 'gantt'], ['/calendar', '캘린더', 'calendar']] as [string, string, IconName][]).map(([href, label, icon]) => (
                <Link key={href} href={href} className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-ink-muted hover:bg-slate-100 hover:text-ink"><Icon name={icon} className="w-4 h-4 text-ink-subtle" />{label}<Icon name="arrow-right" className="w-3.5 h-3.5 ml-auto text-ink-subtle" /></Link>
              ))}
            </div>
          </section>
          {/* 최근 활동 */}
          <section className="card pt-4 px-4 pb-4">
            <div className="text-[15px] font-semibold text-ink mb-2.5">최근 활동</div>
            {notes && notes.filter(n => n.deal).slice(0, 5).length > 0 ? (
              <div className="space-y-0.5">
                {[...new Map(notes.filter(n => n.deal).map(n => [n.deal!.id, n.deal!])).values()].slice(0, 5).map(dl => (
                  <Link key={dl.id} href={`/deals/${dl.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-ink-muted hover:bg-slate-100 hover:text-ink"><Briefcase className="w-3.5 h-3.5 text-ink-subtle" /><span className="truncate">{dl.title}</span></Link>
                ))}
              </div>
            ) : <div className="py-3 text-center text-xs text-ink-subtle">최근 활동이 없습니다.</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
