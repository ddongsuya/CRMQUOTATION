'use client';

// ─── 일정 ───
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Save, Pencil, Trash2 } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { EVENT_TYPE, label, tone } from '@/lib/labels';
import { fmtDate, toYmd } from '@/lib/dates';
import { EmptyState, LoadingState } from '@/components/ui/State';
import EventDetailFields from '@/components/crm/EventDetailFields';
import { SectionCard, AddToggle, TargetSelect, parseTarget, dday, NextActionNudge, type NudgeCtx } from '../shared';
import type { Agg, ContactOpt, DealOpt, JumpOpts } from '../types';

const EMPTY_EVENT_FORM = { target: '', title: '', startAt: '', type: 'MEETING', location: '', attendeesClient: '', attendeesInternal: '', requests: '' };
const EVENT_TYPES = ['MEETING', 'DEADLINE', 'MILESTONE', 'REMINDER'];

export default function ScheduleTab({ agg, companyId, deals, contacts, reload, initial }: { agg: Agg | null; companyId: number; deals: DealOpt; contacts: ContactOpt[]; reload: () => void; initial?: JumpOpts }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);   // 수정 중인 일정 id (null = 신규)
  const [f, setF] = useState<typeof EMPTY_EVENT_FORM>(EMPTY_EVENT_FORM);
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState<NudgeCtx | null>(null);   // 저장 직후 "다음 할 일" 넛지
  const startEdit = (e: Agg['events'][number]) => {
    setEditId(e.id);
    setF({
      target: e.dealId ? `d:${e.dealId}` : e.contactId ? `c:${e.contactId}` : '',
      title: e.title, startAt: toYmd(e.startAt), type: e.type,
      location: e.location ?? '', attendeesClient: e.attendeesClient ?? '', attendeesInternal: e.attendeesInternal ?? '', requests: e.requests ?? '',
    });
    setOpen(true);
  };
  const closeForm = () => { setOpen(false); setEditId(null); setF(EMPTY_EVENT_FORM); };
  // 개요 카드에서 넘어온 지시(특정 일정 수정 / 추가 폼) — 1회 적용
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !initial || !agg) return;
    applied.current = true;
    if (initial.editId) { const e = agg.events.find(x => x.id === initial.editId); if (e) startEdit(e); }
    else if (initial.open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, agg]);
  const save = async () => {
    const tgt = parseTarget(f.target);
    if ((!editId && !tgt.dealId && !tgt.contactId) || !f.title.trim() || !f.startAt) { toast.error('대상·제목·날짜를 입력하세요.'); return; }
    setBusy(true);
    const payload = {
      // 수정 시 대상 전환(안건↔의뢰자)이 반영되도록 두 키를 모두 명시 (한쪽은 null 로 해제)
      ...(editId && (tgt.dealId || tgt.contactId) ? { dealId: tgt.dealId ?? null, contactId: tgt.contactId ?? null } : tgt),
      title: f.title, startAt: new Date(f.startAt).toISOString(), type: f.type, allDay: true,
      location: f.location, attendeesClient: f.attendeesClient, attendeesInternal: f.attendeesInternal, requests: f.requests,
    };
    const res = editId
      ? await fetch(`/api/crm/events/${editId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/crm/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (res.ok) { toast.success(editId ? '일정 수정됨' : '일정 추가됨'); closeForm(); setNudge({ companyId, ...tgt }); reload(); } else toast.error('저장 실패');
  };
  const toggleDone = async (e: Agg['events'][number]) => {
    const res = await fetch(`/api/crm/events/${e.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !e.done }) });
    if (res.ok) reload(); else toast.error('변경 실패');
  };
  const del = async (id: number) => {
    if (!confirm('이 일정을 삭제할까요?')) return;
    const res = await fetch(`/api/crm/events/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제됨'); if (editId === id) closeForm(); reload(); } else toast.error('삭제 실패');
  };
  if (!agg) return <LoadingState compact />;
  const sorted = [...agg.events].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const canAdd = deals.length > 0 || contacts.length > 0;
  return (
    <SectionCard title="일정" count={sorted.length}
      action={canAdd && <AddToggle open={open} onToggle={() => open ? closeForm() : setOpen(true)} label="일정 추가" />}>
      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          {editId && <div className="pill bg-brand-100 text-brand-700 w-fit">일정 수정 중</div>}
          <div className="grid grid-cols-2 gap-2">
            <TargetSelect deals={deals} contacts={contacts} value={f.target} onChange={v => setF(s => ({ ...s, target: v }))} />
            <select className="input text-sm" aria-label="일정 유형" value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>{EVENT_TYPES.map(k => <option key={k} value={k}>{label(EVENT_TYPE, k)}</option>)}</select>
          </div>
          <input className="input text-sm w-full" placeholder="일정 제목" aria-label="일정 제목" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} />
          <label className="block">
            <span className="text-[11px] text-ink-subtle">날짜</span>
            <input type="date" className="input text-sm w-full" value={f.startAt} onChange={e => setF(s => ({ ...s, startAt: e.target.value }))} />
          </label>
          <EventDetailFields dense f={f} set={(k, v) => setF(s => ({ ...s, [k]: v }))} />
          <div className="flex justify-end gap-2">
            {editId && <button onClick={closeForm} className="btn-ghost text-sm">취소</button>}
            <button onClick={save} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editId ? '수정 저장' : '저장'}</button>
          </div>
        </div>
      )}
      {nudge && !open && <NextActionNudge ctx={nudge} onAdded={reload} onDismiss={() => setNudge(null)} />}
      {sorted.length === 0 ? (
        <EmptyState compact title="등록된 일정이 없습니다"
          description={canAdd ? '미팅·마감·보고서안 일정을 등록하면 캘린더와 홈 알림에도 함께 표시됩니다.' : '먼저 의뢰자를 등록해야 일정을 만들 수 있습니다.'}
          action={canAdd ? { label: '일정 추가', onClick: () => setOpen(true) } : undefined} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map(e => {
            const dd = dday(e.startAt);
            return (
              <li key={e.id} className={clsx('group flex items-center gap-2.5 py-2.5', e.done && 'opacity-50')}>
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', tone(EVENT_TYPE, e.type, 'bg-slate-300'))} />
                <span className="flex-1 min-w-0">
                  <span className={clsx('block text-sm text-ink truncate', e.done && 'line-through')}>{e.title}</span>
                  <span className="block text-[11px] text-ink-subtle">{fmtDate(e.startAt)}{(e.dealTitle || e.contactName) ? ` · ${e.dealTitle ?? e.contactName}` : ''}{e.location ? ` · ${e.location}` : ''}</span>
                  {(e.attendeesClient || e.attendeesInternal) && (
                    <span className="block text-[11px] text-ink-subtle truncate">
                      {[e.attendeesClient && `고객사: ${e.attendeesClient}`, e.attendeesInternal && `자사: ${e.attendeesInternal}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {e.requests && <span className="block text-[11px] text-ink-muted whitespace-pre-wrap mt-0.5">요청사항: {e.requests}</span>}
                </span>
                <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => toggleDone(e)} className="p-1.5 rounded-lg text-ink-subtle hover:text-emerald-600 hover:bg-emerald-50 focus-visible:opacity-100" title={e.done ? '완료 해제' : '완료 처리'} aria-label={e.done ? '완료 해제' : '완료 처리'}><Icon name="check" className="w-3.5 h-3.5" /></button>
                  <button onClick={() => startEdit(e)} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50 focus-visible:opacity-100" title="수정" aria-label="수정"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(e.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50 focus-visible:opacity-100" title="삭제" aria-label="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                </span>
                {e.done ? <span className="pill bg-slate-200 text-ink-subtle flex-shrink-0">완료</span> : dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
