'use client';

/**
 * 할 일 공용 조각 — 분류 선택/칩 + 액션 기록. 할 일이 보이는 모든 화면(고객 상세·안건 상세·개인 기록·개요)이 같은 것을 쓴다.
 *   <CategorySelect value onChange />           생성 폼용
 *   <CategoryChip c onChange? />                 행 표시(onChange 주면 클릭해 바꾸는 셀렉트)
 *   <TaskActions taskId actions onChange />      "액션 n" 토글 → 기록 목록 + 추가 입력 (POST /api/crm/tasks/{id}/actions)
 */
import { useId, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { TASK_CATEGORY, TASK_CATEGORY_ORDER, label, tone } from '@/lib/labels';
import { fmtDateShort, todayYmd } from '@/lib/dates';

export type TaskActionT = { id: number; body: string; at: string };

export function CategorySelect({ value, onChange, className, ariaLabel = '분류' }: { value: string; onChange: (v: string) => void; className?: string; ariaLabel?: string }) {
  return (
    <select className={clsx('input text-sm w-auto', className)} aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)}>
      {TASK_CATEGORY_ORDER.map(k => <option key={k} value={k}>{label(TASK_CATEGORY, k)}</option>)}
    </select>
  );
}

/** 분류 칩. onChange 를 주면 셀렉트로 동작(칩 모양 유지). */
export function CategoryChip({ c, onChange, className }: { c: string; onChange?: (v: string) => void; className?: string }) {
  const cls = clsx('pill shrink-0', tone(TASK_CATEGORY, c), className);
  if (!onChange) return <span className={cls}>{label(TASK_CATEGORY, c)}</span>;
  return (
    <select aria-label="분류 변경" title="분류 변경" value={c} onChange={e => onChange(e.target.value)}
      className={clsx(cls, 'appearance-none cursor-pointer border-0')} style={{ backgroundImage: 'none' }}>
      {TASK_CATEGORY_ORDER.map(k => <option key={k} value={k}>{label(TASK_CATEGORY, k)}</option>)}
    </select>
  );
}

/** 액션 기록 — 접힌 상태에선 "액션 n · 최근 한 줄", 펼치면 목록 + 추가. */
export function TaskActions({ taskId, actions, onChange, defaultOpen, compact }: { taskId: number; actions: TaskActionT[]; onChange: () => void; defaultOpen?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [body, setBody] = useState('');
  const [at, setAt] = useState(todayYmd());
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const latest = actions[0];

  const add = async () => {
    if (!body.trim()) { toast.error('액션 내용을 입력하세요.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/crm/tasks/${taskId}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: body.trim(), at: at || null }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
      setBody(''); setAt(todayYmd()); onChange();
    } catch (e) { toast.error(`기록 실패: ${e instanceof Error ? e.message : '오류'}`); }
    finally { setBusy(false); }
  };
  const del = async (a: TaskActionT) => {
    const r = await fetch(`/api/crm/tasks/${taskId}/actions/${a.id}`, { method: 'DELETE' });
    if (r.ok) onChange(); else toast.error('삭제 실패');
  };

  return (
    <div className={clsx('min-w-0', compact ? 'mt-0.5' : 'mt-1')}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11.5px] text-ink-subtle hover:text-ink rounded px-1 -ml-1 max-w-full">
        {open ? <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" /> : <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />}
        <span className="shrink-0">액션 {actions.length}</span>
        {!open && latest && <span className="truncate text-ink-muted">· {fmtDateShort(latest.at)} {latest.body}</span>}
        {!open && !latest && <span className="text-ink-subtle/70">· 취한 액션 기록하기</span>}
      </button>
      {open && (
        <div className="mt-1 ml-1 pl-3 border-l border-slate-200 space-y-1.5">
          {actions.length > 0 && (
            <ul className="space-y-1">
              {actions.map(a => (
                <li key={a.id} className="flex items-start gap-2 text-[12.5px] group/act">
                  <span className="text-ink-subtle tabular-nums shrink-0 w-[52px]">{fmtDateShort(a.at)}</span>
                  <span className="flex-1 min-w-0 text-ink-body break-words">{a.body}</span>
                  <button type="button" onClick={() => del(a)} aria-label="액션 삭제" className="p-0.5 rounded text-ink-subtle hover:text-red-600 opacity-0 group-hover/act:opacity-100 focus-visible:opacity-100 shrink-0"><Trash2 className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <label htmlFor={inputId} className="sr-only">액션 내용</label>
            <input id={inputId} className="input text-[12.5px] h-8 flex-1 min-w-[160px]" placeholder="취한 액션 (예: 전화함 · 부재중 / 견적서 송부 / 회신 받음)" value={body}
              onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
            <input type="date" className="input text-[12.5px] h-8 w-auto" aria-label="액션 일자" value={at} onChange={e => setAt(e.target.value)} />
            <button type="button" onClick={add} disabled={busy} className="btn-ghost h-8 text-[12px] shrink-0">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} 기록</button>
          </div>
        </div>
      )}
    </div>
  );
}
