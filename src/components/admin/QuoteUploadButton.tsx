'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';

/** 견적 현황 엑셀 업로드 — '견적서' 시트 형식 파일 선택 → 파싱→upsert. */
export default function QuoteUploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/quotes/import', { method: 'POST', body: fd });
    const j = await res.json().catch(() => null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    if (!res.ok || !j?.ok) { setMsg(j?.error ?? '업로드 실패'); return; }
    setMsg(`신규 ${j.created} · 갱신 ${j.updated}${j.skipped ? ` · 건너뜀 ${j.skipped}` : ''}`);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2.5">
      {msg && <span className="text-[12px] text-ink-muted">{msg}</span>}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
      <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-ghost">
        <Icon name="plus" className="w-4 h-4" /> {busy ? '업로드 중…' : '엑셀 업로드'}
      </button>
    </div>
  );
}
