'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';

/** 엑셀 업로드 버튼 — endpoint로 견적/일일보고 등 재사용. */
export default function QuoteUploadButton({ endpoint = '/api/admin/quotes/import', label = '엑셀 업로드' }: { endpoint?: string; label?: string }) {
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
    const res = await fetch(endpoint, { method: 'POST', body: fd });
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
        <Icon name="plus" className="w-4 h-4" /> {busy ? '업로드 중…' : label}
      </button>
    </div>
  );
}
