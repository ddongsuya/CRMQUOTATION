'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';

const ROLES = [
  { value: 'MEMBER', label: '구성원 (일반)' },
  { value: 'TEAM_LEAD', label: '팀장 (관리자)' },
  { value: 'CENTER_LEAD', label: '센터장 (관리자)' },
  { value: 'ADMIN', label: '본부장 (관리자)' },
];

export default function AddMemberButton({ centers }: { centers: { id: number; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [centerId, setCenterId] = useState<string>(centers[0]?.id ? String(centers[0].id) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) { setErr('이름을 입력하세요.'); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), role, centerId: centerId ? Number(centerId) : null }),
    });
    setBusy(false);
    if (!res.ok) { setErr('저장 실패'); return; }
    setOpen(false); setName(''); setRole('MEMBER');
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Icon name="plus" className="w-4 h-4" /> 구성원 추가
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div className="card card-pad w-full max-w-sm bg-[var(--card)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-ink">구성원 추가</h3>
              <button onClick={() => setOpen(false)} className="icon-btn"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">이름</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김코아" autoFocus />
              </div>
              <div>
                <label className="label">직책 · 권한</label>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">센터</label>
                <select className="input" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
                  <option value="">미배정</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {err && <p className="text-[13px]" style={{ color: 'var(--error)' }}>{err}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center">취소</button>
              <button onClick={submit} disabled={busy} className="btn-primary flex-1">{busy ? '저장 중…' : '추가'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
