'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';

/** 일일 업무 기록 신규 작성 — 엑셀 업로드 외 수기 작성 진입점. */
export default function AddReportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ date: '', workContent: '', contractPlan: '', activityNote: '' });

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = async () => {
    if (!f.date) { setErr('날짜를 입력하세요.'); return; }
    if (!f.workContent.trim() && !f.contractPlan.trim() && !f.activityNote.trim()) { setErr('내용을 하나 이상 입력하세요.'); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { setErr('저장 실패'); return; }
    setOpen(false); setF({ date: '', workContent: '', contractPlan: '', activityNote: '' });
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Icon name="plus" className="w-4 h-4" /> 새 기록</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`} className="card card-pad w-full max-w-md bg-[var(--card)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 id={`${ids}-title`} className="text-[16px] font-bold text-ink">새 업무 기록</h3>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="icon-btn"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label" htmlFor={`${ids}-date`}>날짜</label><input id={`${ids}-date`} type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} autoFocus /></div>
              <div><label className="label" htmlFor={`${ids}-work`}>업무내용</label><textarea id={`${ids}-work`} className="input min-h-[80px] py-2" value={f.workContent} onChange={(e) => set('workContent', e.target.value)} placeholder="오늘 진행한 업무 (고객 문의·견적 송부·미팅 등)" /></div>
              <div><label className="label" htmlFor={`${ids}-plan`}>계약 예정(접수)</label><textarea id={`${ids}-plan`} className="input min-h-[48px] py-2" value={f.contractPlan} onChange={(e) => set('contractPlan', e.target.value)} placeholder="선택" /></div>
              <div><label className="label" htmlFor={`${ids}-note`}>고객관리·방문·기타</label><textarea id={`${ids}-note`} className="input min-h-[48px] py-2" value={f.activityNote} onChange={(e) => set('activityNote', e.target.value)} placeholder="선택" /></div>
              {err && <p className="text-[13px]" style={{ color: 'var(--error)' }}>{err}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center">취소</button>
              <button onClick={submit} disabled={busy} className="btn-primary flex-1">{busy ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
