'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = { centerId: number | null; name: string; amount: number | null };

/** 목표 입력 — 센터별/전사 수주 목표(억 단위 입력 → 원 저장). */
export default function TargetForm({ period, rows }: { period: string; rows: Row[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<string[]>(rows.map((r) => (r.amount != null ? String(Math.round(r.amount / 1e8 * 10) / 10) : '')));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true); setSaved(false);
    const payload = {
      period,
      rows: rows.map((r, i) => ({ centerId: r.centerId, amount: vals[i] === '' ? null : Number(vals[i]) * 1e8 })),
    };
    const res = await fetch('/api/admin/targets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) { setSaved(true); router.refresh(); }
  };

  return (
    <div className="card card-pad max-w-lg">
      <h2 className="text-[15px] font-semibold text-ink mb-1">수주 목표 · {period === '2026H1' ? '2026 상반기' : period}</h2>
      <p className="text-[13px] text-ink-subtle mb-4">억원 단위로 입력하세요. 비우면 목표가 삭제됩니다.</p>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.centerId ?? 'all'} className="flex items-center gap-3">
            <span className={`w-24 text-[14px] ${r.centerId == null ? 'font-bold text-ink' : 'text-ink-body'}`}>{r.name}</span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="number" inputMode="decimal" min={0} step={0.1}
                className="input flex-1 tabular-nums" value={vals[i]}
                onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="0"
              />
              <span className="text-[14px] text-ink-muted">억원</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-5">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? '저장 중…' : '목표 저장'}</button>
        {saved && <span className="text-[13px]" style={{ color: 'var(--success)' }}>저장되었습니다.</span>}
      </div>
    </div>
  );
}
