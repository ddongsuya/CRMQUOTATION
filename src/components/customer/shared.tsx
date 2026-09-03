'use client';

/**
 * 고객 상세 탭들이 함께 쓰는 조각 — 금액·D-day 표기, 섹션 카드, 안건/대상 선택, 모달 껍데기, "다음 행동" 넛지.
 * 화면 로직은 tabs/* 에, API 타입은 types.ts 에 둔다.
 */
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Loader2, CheckSquare, X } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { DEAL_STAGE } from '@/lib/labels';
import { diffDays } from '@/lib/dates';
import type { Agg, ContactOpt, DealOpt } from './types';

export const fmtWon = (n: number | null | undefined) => `₩${(n ?? 0).toLocaleString()}`;
export const fmtWonM = (n: number) => (n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(1)}M` : `₩${n.toLocaleString()}`);

/** D-day 배지(라벨+색). 일수 계산은 lib/dates 의 diffDays, 색은 이 화면의 긴급도 톤. */
export function dday(s: string | null | undefined): { label: string; cls: string } | null {
  const days = diffDays(s);
  if (days == null) return null;
  if (days === 0) return { label: 'D-DAY', cls: 'bg-red-100 text-red-700' };
  if (days < 0) return { label: `D+${-days}`, cls: 'bg-slate-200 text-ink-subtle' };
  return { label: `D-${days}`, cls: days <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-ink-muted' };
}

/** 기록 유형별 pill 색 — 라벨은 lib/labels 의 NOTE_TYPE, 색은 이 화면 전용 */
const NOTE_TONE: Record<string, string> = { MEETING: 'bg-brand-100 text-brand-700', CALL: 'tone-blue', MEMO: 'bg-slate-200 text-ink-muted' };
export const noteTone = (type: string) => NOTE_TONE[type] ?? NOTE_TONE.MEMO;

export function SectionCard({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-[22px] min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-1.5">{title}{count != null && <span className="text-xs text-ink-subtle font-normal">{count}</span>}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DealSelect({ deals, value, onChange }: { deals: DealOpt; value: number | ''; onChange: (v: number) => void }) {
  return (
    <select className="input text-sm" aria-label="안건" value={value} onChange={e => onChange(Number(e.target.value))}>
      <option value="">안건 선택…</option>
      {deals.map(d => <option key={d.id} value={d.id}>{d.title}{d.contactName ? ` · ${d.contactName}` : ''}</option>)}
    </select>
  );
}
export function AddToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return <button onClick={onToggle} className="btn-ghost text-xs">{open ? <Icon name="x" className="w-3.5 h-3.5" /> : <Icon name="plus" className="w-3.5 h-3.5" />} {open ? '취소' : label}</button>;
}

// 노트·일정의 연결 대상 — 안건 또는 의뢰자(안건이 없어도 기록 가능). 값: "d:<id>" | "c:<id>"
export function TargetSelect({ deals, contacts, value, onChange }: { deals: DealOpt; contacts: ContactOpt[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="input text-sm" aria-label="대상 (안건·의뢰자)" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">대상 선택 (안건·의뢰자)…</option>
      {deals.length > 0 && <optgroup label="안건">{deals.map(d => <option key={`d${d.id}`} value={`d:${d.id}`}>{d.title}{d.contactName ? ` · ${d.contactName}` : ''}</option>)}</optgroup>}
      {contacts.length > 0 && <optgroup label="의뢰자">{contacts.map(c => <option key={`c${c.id}`} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>}
    </select>
  );
}
export const parseTarget = (t: string): { dealId?: number; contactId?: number } =>
  t.startsWith('d:') ? { dealId: Number(t.slice(2)) } : t.startsWith('c:') ? { contactId: Number(t.slice(2)) } : {};

/** 개요 카드 안의 짧은 빈 문구(카드 헤더에 이미 추가 버튼이 있어 EmptyState 대신 한 줄) */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-ink-subtle">{children}</div>;
}

export function DealLine({ d }: { d: Agg['deals'][number] }) {
  const st = DEAL_STAGE[d.stage] ?? DEAL_STAGE.INQUIRY;
  return (
    <Link href={`/deals/${d.id}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-slate-50/70 transition-colors">
      <span className="order-1 sm:order-none flex-1 min-w-0 text-sm text-ink truncate">
        {d.title}{d.modality && <span className="text-ink-subtle text-xs ml-1.5">{d.modality}</span>}
      </span>
      <div className="order-2 sm:order-none flex items-center gap-2 sm:contents">
        <span className="text-[11px] text-ink-subtle truncate sm:order-first">{d.contactName}</span>
        <span className={clsx('pill flex-shrink-0 ml-auto sm:ml-0', st.tone)}>{st.label}</span>
        {d.status === 'LOST' && <span className="pill bg-red-100 text-red-700 flex-shrink-0">중단</span>}
        {d.status === 'WON' && <span className="pill bg-emerald-100 text-emerald-700 flex-shrink-0">수주</span>}
        <span className="text-sm font-semibold text-ink tabular-nums whitespace-nowrap flex-shrink-0">{d.quoteAmount ? fmtWon(d.quoteAmount) : '—'}</span>
      </div>
    </Link>
  );
}

// ════════════════ 모달 껍데기 ════════════════
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded-[12px] border border-slate-200 w-full max-w-md max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div id={titleId} className="font-semibold text-ink">{title}</div>
          <button onClick={onClose} aria-label="닫기" className="text-ink-subtle hover:text-ink"><Icon name="x" className="w-5 h-5" /></button>
        </header>
        <div className="px-5 py-4 space-y-3 overflow-auto">{children}</div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</footer>
      </div>
    </div>
  );
}

// ════════════════ "다음 행동" 넛지 ════════════════
/**
 * 기록·일정을 저장한 직후 "다음 할 일을 정해 둘까요?" 를 띄운다. 할 일 탭과 같은 필드로 POST /api/crm/tasks.
 * 연결 대상(안건/의뢰자)은 방금 저장한 기록·일정의 것을 그대로 물려받는다.
 */
export type NudgeCtx = { companyId: number; dealId?: number; contactId?: number };
export function NextActionNudge({ ctx, onAdded, onDismiss }: { ctx: NudgeCtx; onAdded: () => void; onDismiss: () => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const add = async () => {
    if (!title.trim()) { toast.error('할 일 내용을 입력하세요.'); return; }
    setBusy(true);
    const body = { title: title.trim(), dueAt: null, companyId: ctx.companyId, ...(ctx.dealId ? { dealId: ctx.dealId } : ctx.contactId ? { contactId: ctx.contactId } : {}) };
    const res = await fetch('/api/crm/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { toast.success('할 일 추가됨'); setTitle(''); onAdded(); onDismiss(); } else toast.error('추가 실패');
  };
  return (
    <div role="status" className="mb-4 rounded-xl border border-brand-200 bg-brand-50/40 p-3 flex flex-wrap items-center gap-2">
      <CheckSquare className="w-4 h-4 text-brand-600 shrink-0" aria-hidden="true" />
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink shrink-0">다음 할 일을 정해 둘까요?</label>
      <input id={inputId} className="input text-sm flex-1 min-w-[180px]" placeholder="예: 견적서 회신 확인 전화" value={title}
        onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} autoFocus />
      <button onClick={add} disabled={busy} className="btn-primary text-sm shrink-0">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="plus" className="w-4 h-4" />} 할 일 추가</button>
      <button onClick={onDismiss} aria-label="닫기" className="p-1 rounded text-ink-subtle hover:text-ink shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}
