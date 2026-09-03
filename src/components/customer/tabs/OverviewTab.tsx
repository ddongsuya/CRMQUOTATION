'use client';

// ─── 개요 ───
import Link from 'next/link';
import clsx from 'clsx';
import { Pencil } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { EVENT_TYPE, NOTE_TYPE, label, tone } from '@/lib/labels';
import { fmtDate } from '@/lib/dates';
import { SectionCard, Empty, DealLine, dday, noteTone } from '../shared';
import ActivityTimeline from '../ActivityTimeline';
import type { Agg, Company, Contact, GoTo, Tab, TaskT } from '../types';

export default function OverviewTab({ agg, company, tasks, reload, onGo, onAddContact, onEditContact }: {
  agg: Agg | null; company: Company; tasks: TaskT[]; reload: () => void;
  onGo: GoTo;
  onAddContact: () => void; onEditContact: (c: Contact) => void;
}) {
  if (!agg) return <Empty>불러오는 중…</Empty>;
  const activeDeals = agg.deals.filter(d => d.status === 'ACTIVE').slice(0, 5);
  const runningStudies = agg.studies.filter(s => !s.reportDraftIssuedAt).slice(0, 5);
  const recentNotes = agg.notes.slice(0, 4);
  const upcoming = agg.events.filter(e => !e.done && new Date(e.startAt) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 5);
  const openTasks = tasks.filter(t => !t.done).slice(0, 5);
  // 개요에서도 전용 탭과 같은 조작 — 완료 토글은 바로 반영, 수정은 해당 탭의 편집 폼으로
  const toggleEvent = async (e: Agg['events'][number]) => {
    const res = await fetch(`/api/crm/events/${e.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !e.done }) });
    if (res.ok) reload(); else toast.error('변경 실패');
  };
  const toggleTask = async (t: TaskT) => {
    const res = await fetch(`/api/crm/tasks/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !t.done }) });
    if (res.ok) reload(); else toast.error('변경 실패');
  };
  const More = ({ t }: { t: Tab }) => <button onClick={() => onGo(t)} className="text-[12px] text-brand-600 hover:underline">전체 보기</button>;
  return (
    <div className="space-y-4">
    <div className="grid lg:grid-cols-2 gap-4">
      <SectionCard title="진행 중 딜" count={activeDeals.length} action={<More t="딜" />}>
        {activeDeals.length === 0 ? <Empty>진행 중인 딜이 없습니다.</Empty> : <div className="divide-y divide-slate-100">{activeDeals.map(d => <DealLine key={d.id} d={d} />)}</div>}
      </SectionCard>

      <SectionCard title="시험 진행" count={runningStudies.length} action={<More t="시험" />}>
        {runningStudies.length === 0 ? <Empty>진행 중인 시험이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {runningStudies.map(s => {
              const dd = dday(s.reportDraftDueAt);
              return (
                <li key={s.id}>
                  <Link href={`/deals/${s.dealId}`} className="flex items-center gap-2 py-2.5 -mx-2 px-2 rounded-lg hover:bg-slate-50/70" title="딜 상세에서 시험 정보 수정">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink truncate">{s.itemName || s.dealTitle}</span>
                      <span className="block text-[11px] text-ink-subtle truncate">{s.studyNumber ? `${s.studyNumber} · ` : ''}{s.director || '책임자 미정'}</span>
                    </span>
                    {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                    <Pencil className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="할 일" count={openTasks.length}
        action={<div className="flex items-center gap-2"><button onClick={() => onGo('할 일')} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 할 일 추가</button><More t="할 일" /></div>}>
        {openTasks.length === 0 ? <Empty>미완료 할 일이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {openTasks.map(t => {
              const dd = t.dueAt ? dday(t.dueAt) : null;
              return (
                <li key={t.id} className="flex items-center gap-2.5 py-2">
                  <button onClick={() => toggleTask(t)} role="checkbox" aria-checked={false} aria-label={`${t.title} 완료 처리`} className="w-[18px] h-[18px] rounded-md border border-slate-300 hover:border-brand-400 flex items-center justify-center shrink-0" title="완료 처리" />
                  <button onClick={() => onGo('할 일', { editId: t.id })} className="flex-1 min-w-0 text-left text-sm text-ink truncate hover:text-brand-600">{t.title}</button>
                  {(t.deal || t.contact) && <span className="text-[11px] text-ink-subtle truncate max-w-[120px]">{t.deal?.title ?? t.contact?.name}</span>}
                  {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="담당자" count={company.contacts.length}
        action={<div className="flex items-center gap-2"><button onClick={onAddContact} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 의뢰자 추가</button><More t="연락처" /></div>}>
        {company.contacts.length === 0 ? <Empty>등록된 의뢰자가 없습니다.</Empty> : (
          <ul className="space-y-1">
            {company.contacts.map(c => {
              const cq = agg.quotes.filter(q => q.contactId === c.id);
              return (
              <li key={c.id} className="flex items-center gap-2.5 py-1.5 -mx-2 px-2 rounded-lg hover:bg-slate-50/70 group">
                <button onClick={() => onEditContact(c)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left" title="의뢰자 정보 수정">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-600 font-bold text-xs flex-shrink-0">{c.name.charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink truncate">{c.name}{c.position && <span className="text-ink-subtle text-xs ml-1.5">{c.position}</span>}</span>
                    <span className="block text-[11px] text-ink-subtle truncate">{[c.email, c.phone].filter(Boolean).join(' · ') || '연락처 없음'}</span>
                  </span>
                </button>
                {cq.length > 0 && <button onClick={() => onGo('연락처')} className="pill bg-brand-100 text-brand-700 flex-shrink-0 hover:bg-brand-200" title="담당자별 견적 보기">견적 {cq.length}건</button>}
                <Pencil className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />
              </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="예정 일정" count={upcoming.length}
        action={<div className="flex items-center gap-2"><button onClick={() => onGo('일정', { open: true })} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 일정 추가</button><More t="일정" /></div>}>
        {upcoming.length === 0 ? <Empty>예정된 일정이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map(e => {
              const dd = dday(e.startAt);
              return (
                <li key={e.id} className="flex items-center gap-2 py-2 group">
                  <button onClick={() => toggleEvent(e)} role="checkbox" aria-checked={false} aria-label={`${e.title} 완료 처리`} className="w-[18px] h-[18px] rounded-md border border-slate-300 hover:border-emerald-500 flex items-center justify-center shrink-0" title="완료 처리" />
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', tone(EVENT_TYPE, e.type, 'bg-slate-300'))} />
                  <button onClick={() => onGo('일정', { editId: e.id })} className="flex-1 min-w-0 text-left hover:text-brand-600" title="일정 수정">
                    <span className="block text-sm text-ink truncate">{e.title}</span>
                    <span className="block text-[11px] text-ink-subtle truncate">{fmtDate(e.startAt)}{e.location ? ` · ${e.location}` : ''}</span>
                  </button>
                  {dd && <span className={clsx('pill flex-shrink-0', dd.cls)}>{dd.label}</span>}
                  <Pencil className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="최근 노트" count={recentNotes.length}
        action={<div className="flex items-center gap-2"><button onClick={() => onGo('노트', { open: true })} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 기록 추가</button><More t="노트" /></div>}>
        {recentNotes.length === 0 ? <Empty>기록된 노트가 없습니다.</Empty> : (
          <ul className="space-y-1">
            {recentNotes.map(n => (
              <li key={n.id}>
                <button onClick={() => onGo('노트', { editId: n.id })} className="w-full text-left text-sm py-2 -mx-2 px-2 rounded-lg hover:bg-slate-50/70 group" title="노트 수정">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={clsx('pill', noteTone(n.type))}>{label(NOTE_TYPE, n.type, '메모')}</span>
                    <span className="text-[11px] text-ink-subtle">{fmtDate(n.occurredAt)}{(n.dealTitle || n.contactName) ? ` · ${n.dealTitle ?? n.contactName}` : ''}</span>
                    <Pencil className="w-3 h-3 text-ink-subtle ml-auto opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </div>
                  <p className="text-ink-muted line-clamp-2">{n.title ? <span className="font-medium text-ink">{n.title} — </span> : null}{n.body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>

    <ActivityTimeline companyId={company.id} refreshKey={agg} onGo={onGo} />
    </div>
  );
}
