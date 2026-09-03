'use client';

// ─── 할 일 (기업별 to-do — 일정(약속)과 구분되는 액션 아이템) ───
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Trash2 } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { toYmd } from '@/lib/dates';
import { EmptyState } from '@/components/ui/State';
import { SectionCard, parseTarget, dday } from '../shared';
import type { ContactOpt, DealOpt, JumpOpts, TaskT } from '../types';

export default function TasksTab({ companyId, tasks, deals, contacts, reload, initial }: { companyId: number; tasks: TaskT[]; deals: DealOpt; contacts: ContactOpt[]; reload: () => void; initial?: JumpOpts }) {
  const [f, setF] = useState({ title: '', dueAt: '', target: '' });
  const [busy, setBusy] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  // 개요·타임라인에서 넘어온 지시(특정 할 일로 포커스 / 입력창 열기) — 1회 적용
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !initial) return;
    applied.current = true;
    if (initial.editId) {
      const el = document.querySelector<HTMLInputElement>(`[data-task-title="${initial.editId}"]`);
      el?.scrollIntoView({ block: 'center' }); el?.focus();
    } else if (initial.open) addRef.current?.focus();
  }, [initial]);
  const add = async () => {
    if (!f.title.trim()) { toast.error('할 일 내용을 입력하세요.'); return; }
    setBusy(true);
    const tgt = parseTarget(f.target);
    const res = await fetch('/api/crm/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: f.title, dueAt: f.dueAt || null, companyId, ...tgt }) });
    setBusy(false);
    if (res.ok) { toast.success('할 일 추가됨'); setF({ title: '', dueAt: '', target: '' }); reload(); } else toast.error('추가 실패');
  };
  const patch = async (id: number, data: Record<string, unknown>) => {
    const res = await fetch(`/api/crm/tasks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) reload(); else toast.error('수정 실패');
  };
  const del = async (id: number) => { const res = await fetch(`/api/crm/tasks/${id}`, { method: 'DELETE' }); if (res.ok) reload(); else toast.error('삭제 실패'); };
  const open = tasks.filter(t => !t.done);
  const doneList = tasks.filter(t => t.done);
  const row = (t: TaskT) => {
    const dd = t.dueAt ? dday(t.dueAt) : null;
    const due = t.dueAt ? toYmd(t.dueAt) : '';
    return (
      <li key={t.id} className={clsx('flex items-center gap-2.5 py-2 group', t.done && 'opacity-50')}>
        <button onClick={() => patch(t.id, { done: !t.done })} role="checkbox" aria-checked={t.done} aria-label={`${t.title} 완료`}
          className={clsx('w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors', t.done ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 hover:border-brand-400')}>
          {t.done && <Icon name="check" className="w-3 h-3" />}
        </button>
        <input key={`tt-${t.id}-${t.title}`} data-task-title={t.id} aria-label="할 일 제목" className={clsx('flex-1 min-w-0 bg-transparent outline-none text-sm text-ink rounded px-1 -mx-1 focus:bg-slate-50', t.done && 'line-through text-ink-subtle')}
          defaultValue={t.title} onBlur={e => e.target.value.trim() && e.target.value !== t.title && patch(t.id, { title: e.target.value })} />
        {(t.deal || t.contact) && <span className="text-[11px] text-ink-subtle truncate max-w-[140px] shrink-0">{t.deal?.title ?? t.contact?.name}</span>}
        <input key={`td-${t.id}-${t.dueAt ?? ''}`} type="date" className="input text-xs w-auto shrink-0 py-1" title="기한" aria-label="기한" defaultValue={due}
          onBlur={e => e.target.value !== due && patch(t.id, { dueAt: e.target.value || null })} />
        {!t.done && dd && <span className={clsx('pill shrink-0', dd.cls)}>{dd.label}</span>}
        <button onClick={() => del(t.id)} aria-label="할 일 삭제" className="p-1 rounded text-ink-subtle hover:text-red-600 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
      </li>
    );
  };
  return (
    <SectionCard title="할 일" count={open.length}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <input ref={addRef} className="input text-sm flex-1 min-w-[180px]" placeholder="할 일 추가 (예: 번역의뢰서 영문본 재요청)" aria-label="할 일 추가" value={f.title}
          onChange={e => setF(s => ({ ...s, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <input type="date" className="input text-sm w-auto" title="기한(선택)" aria-label="기한(선택)" value={f.dueAt} onChange={e => setF(s => ({ ...s, dueAt: e.target.value }))} />
        <select className="input text-sm w-auto max-w-[160px]" aria-label="대상(선택)" value={f.target} onChange={e => setF(s => ({ ...s, target: e.target.value }))}>
          <option value="">대상(선택)…</option>
          {deals.length > 0 && <optgroup label="안건">{deals.map(d => <option key={`d${d.id}`} value={`d:${d.id}`}>{d.title}</option>)}</optgroup>}
          {contacts.length > 0 && <optgroup label="의뢰자">{contacts.map(c => <option key={`c${c.id}`} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>}
        </select>
        <button onClick={add} disabled={busy} className="btn-primary text-sm shrink-0">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="plus" className="w-4 h-4" />} 추가</button>
      </div>
      {open.length === 0 && doneList.length === 0 ? (
        <EmptyState compact title="등록된 할 일이 없습니다" description="위 입력창에서 바로 추가하세요. 안건·의뢰자에 연결해 두면 팔로업 큐에도 잡힙니다." action={{ label: '할 일 추가', onClick: () => addRef.current?.focus() }} />
      ) : (
        <>
          <ul className="divide-y divide-slate-100">{open.map(row)}</ul>
          {doneList.length > 0 && (
            <details className="mt-3">
              <summary className="text-[12px] text-ink-subtle cursor-pointer select-none">완료 {doneList.length}건 보기</summary>
              <ul className="divide-y divide-slate-100 mt-1">{doneList.map(row)}</ul>
            </details>
          )}
        </>
      )}
    </SectionCard>
  );
}
