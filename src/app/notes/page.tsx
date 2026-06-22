'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { NotebookPen, Plus, Loader2, Trash2, Users, Briefcase, Phone, MessageSquare } from 'lucide-react';
import { toast } from '@/lib/toast';

type Note = {
  id: number; type: string; title: string | null; body: string; occurredAt: string;
  contact: { id: number; name: string; company: { id: number; name: string } } | null;
  deal: { id: number; title: string } | null;
};

const TYPE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  MEETING: { label: '미팅', cls: 'bg-brand-100 text-brand-700', icon: <Users className="w-3 h-3" /> },
  CALL: { label: '통화', cls: 'bg-sky-100 text-sky-700', icon: <Phone className="w-3 h-3" /> },
  MEMO: { label: '메모', cls: 'bg-slate-100 text-ink-muted', icon: <MessageSquare className="w-3 h-3" /> },
};
const today = () => new Date().toISOString().slice(0, 10);

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [f, setF] = useState({ type: 'MEETING', title: '', body: '', occurredAt: today() });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/crm/notes').then(r => r.json()).then(d => setNotes(d.notes ?? [])).catch(() => setNotes([]));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!f.body.trim()) { toast.error('내용을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'fail');
      toast.success('기록이 저장되었습니다.'); setF({ type: 'MEETING', title: '', body: '', occurredAt: today() }); setAdding(false); load();
    } catch (e) { toast.error(`저장 실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setSaving(false); }
  };
  const del = async (id: number) => { if (!confirm('이 기록을 삭제할까요?')) return; const res = await fetch(`/api/crm/notes/${id}`, { method: 'DELETE' }); if (res.ok) load(); };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><NotebookPen className="w-6 h-6 text-brand-500" /> 개인 기록</h1>
          <p className="text-sm text-ink-muted mt-0.5">미팅·상담·중요 내용을 기록하고 추적합니다.</p>
        </div>
        <button onClick={() => setAdding(v => !v)} className="btn-primary"><Plus className="w-4 h-4" /> 새 기록</button>
      </div>

      {adding && (
        <div className="card p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TYPE).map(([k, v]) => (
              <button key={k} onClick={() => setF(p => ({ ...p, type: k }))} className={clsx('chip', f.type === k ? 'chip-active' : 'chip-inactive')}>{v.label}</button>
            ))}
            <input type="date" className="input text-sm ml-auto" value={f.occurredAt} onChange={e => setF(p => ({ ...p, occurredAt: e.target.value }))} />
          </div>
          <input className="input w-full" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="제목 (선택)" />
          <textarea className="input w-full min-h-[90px]" value={f.body} onChange={e => setF(p => ({ ...p, body: e.target.value }))} placeholder="내용…" autoFocus />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="btn-ghost text-sm">취소</button>
            <button onClick={add} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 기록</button>
          </div>
        </div>
      )}

      {notes === null ? (
        <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>
      ) : notes.length === 0 ? (
        <div className="card p-12 text-center text-sm text-ink-subtle">아직 기록이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {notes.map(n => {
            const t = TYPE[n.type] ?? TYPE.MEMO;
            return (
              <div key={n.id} className="card p-4 group">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx('pill inline-flex items-center gap-1', t.cls)}>{t.icon}{t.label}</span>
                      {n.title && <span className="font-semibold text-ink">{n.title}</span>}
                      <span className="text-[11px] text-ink-subtle">{n.occurredAt.slice(0, 10)}</span>
                    </div>
                    <div className="text-sm text-ink-muted mt-1.5 whitespace-pre-wrap">{n.body}</div>
                    {(n.contact || n.deal) && (
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-subtle">
                        {n.contact && <Link href={`/customers/${n.contact.company.id}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Users className="w-3 h-3" />{n.contact.company.name} · {n.contact.name}</Link>}
                        {n.deal && <Link href={`/deals/${n.deal.id}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Briefcase className="w-3 h-3" />{n.deal.title}</Link>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => del(n.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
