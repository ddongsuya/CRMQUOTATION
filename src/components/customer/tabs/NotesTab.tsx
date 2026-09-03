'use client';

// ─── 노트 ───
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Loader2, Save, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { NOTE_TYPE, label } from '@/lib/labels';
import { fmtDate, todayYmd, toYmd } from '@/lib/dates';
import { EmptyState, LoadingState } from '@/components/ui/State';
import { SectionCard, AddToggle, TargetSelect, parseTarget, noteTone, NextActionNudge, type NudgeCtx } from '../shared';
import type { Agg, ContactOpt, DealOpt, JumpOpts } from '../types';

export default function NotesTab({ agg, companyId, deals, contacts, reload, initial }: { agg: Agg | null; companyId: number; deals: DealOpt; contacts: ContactOpt[]; reload: () => void; initial?: JumpOpts }) {
  const EMPTY = { target: '', type: 'MEMO', title: '', body: '', occurredAt: todayYmd() };   // 로컬 기준 (UTC면 오전 9시 전 어제로 나옴)
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [f, setF] = useState<{ target: string; type: string; title: string; body: string; occurredAt: string }>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState<NudgeCtx | null>(null);   // 저장 직후 "다음 할 일" 넛지
  const startEdit = (n: Agg['notes'][number]) => {
    setEditId(n.id);
    setF({ target: n.dealId ? `d:${n.dealId}` : n.contactId ? `c:${n.contactId}` : '', type: n.type, title: n.title ?? '', body: n.body, occurredAt: toYmd(n.occurredAt) });
    setOpen(true);
  };
  const closeForm = () => { setOpen(false); setEditId(null); setF(EMPTY); };
  // 개요 카드에서 넘어온 지시(특정 노트 수정 / 추가 폼) — 1회 적용
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !initial || !agg) return;
    applied.current = true;
    if (initial.editId) { const n = agg.notes.find(x => x.id === initial.editId); if (n) startEdit(n); }
    else if (initial.open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, agg]);
  const save = async () => {
    const tgt = parseTarget(f.target);
    if ((!editId && !tgt.dealId && !tgt.contactId) || !f.body.trim()) { toast.error('대상·내용을 입력하세요.'); return; }
    setBusy(true);
    const payload = { ...tgt, type: f.type, title: f.title || null, body: f.body, occurredAt: f.occurredAt || undefined };
    const res = editId
      ? await fetch(`/api/crm/notes/${editId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/crm/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (res.ok) { toast.success(editId ? '기록 수정됨' : '기록 추가됨'); closeForm(); setNudge({ companyId, ...tgt }); reload(); } else toast.error('저장 실패');
  };
  const del = async (id: number) => {
    if (!confirm('이 기록을 삭제할까요?')) return;
    const res = await fetch(`/api/crm/notes/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제됨'); if (editId === id) closeForm(); reload(); } else toast.error('삭제 실패');
  };
  if (!agg) return <LoadingState compact />;
  const canAdd = deals.length > 0 || contacts.length > 0;
  return (
    <SectionCard title="노트" count={agg.notes.length}
      action={canAdd && <AddToggle open={open} onToggle={() => open ? closeForm() : setOpen(true)} label="기록 추가" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          {editId && <div className="pill bg-brand-100 text-brand-700 w-fit">기록 수정 중</div>}
          <div className="grid grid-cols-2 gap-2">
            <TargetSelect deals={deals} contacts={contacts} value={f.target} onChange={v => setF(s => ({ ...s, target: v }))} />
            <select className="input text-sm" aria-label="기록 유형" value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>{Object.entries(NOTE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-ink-subtle">대화·미팅 날짜</span>
              <input type="date" className="input text-sm w-full" value={f.occurredAt} onChange={e => setF(s => ({ ...s, occurredAt: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-subtle">제목(선택)</span>
              <input className="input text-sm w-full" placeholder="제목(선택)" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} />
            </label>
          </div>
          <textarea className="input text-sm w-full min-h-[64px]" placeholder="내용" aria-label="내용" value={f.body} onChange={e => setF(s => ({ ...s, body: e.target.value }))} />
          <div className="flex justify-end gap-2">
            {editId && <button onClick={closeForm} className="btn-ghost text-sm">취소</button>}
            <button onClick={save} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editId ? '수정 저장' : '저장'}</button>
          </div>
        </div>
      )}
      {nudge && !open && <NextActionNudge ctx={nudge} onAdded={reload} onDismiss={() => setNudge(null)} />}
      {agg.notes.length === 0 ? (
        <EmptyState compact title="기록된 노트가 없습니다"
          description={canAdd ? '미팅·통화 내용을 남겨 두면 다음 담당자도 맥락을 바로 잇습니다.' : '먼저 의뢰자를 등록해야 기록을 남길 수 있습니다.'}
          action={canAdd ? { label: '기록 추가', onClick: () => setOpen(true) } : undefined} />
      ) : (
        <ul className="space-y-4">
          {agg.notes.map(n => (
            <li key={n.id} className="relative pl-4 border-l-2 border-slate-100 group">
              <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-300" />
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className={clsx('pill', noteTone(n.type))}>{label(NOTE_TYPE, n.type, '메모')}</span>
                <span className="text-[11px] text-ink-subtle">{fmtDate(n.occurredAt)}</span>
                {n.dealId
                  ? <Link href={`/deals/${n.dealId}`} className="text-[11px] text-brand-600 hover:underline truncate">{n.dealTitle}</Link>
                  : n.contactName && <span className="text-[11px] text-ink-subtle truncate">{n.contactName}</span>}
                <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(n)} className="p-1 rounded text-ink-subtle hover:text-brand-600 hover:bg-brand-50 focus-visible:opacity-100" title="수정" aria-label="수정"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(n.id)} className="p-1 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50 focus-visible:opacity-100" title="삭제" aria-label="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                </span>
              </div>
              {n.title && <div className="text-sm font-semibold text-ink">{n.title}</div>}
              <p className="text-sm text-ink-muted whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
