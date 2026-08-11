'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';

type Preview = { parsed: number; created: number; updated: number; skipped: number; errors: string[] };

/**
 * 엑셀 업로드 버튼 — endpoint로 견적/일일보고/잠재고객 재사용.
 * 파일 선택 → **미리보기(dryRun)로 신규·갱신·건너뜀·오류를 먼저 보여주고** → 확인 시 실제 반영.
 * (예전엔 선택 즉시 DB에 써서, 잘못된 시트도 되돌릴 수 없었다.)
 */
export default function QuoteUploadButton({ endpoint = '/api/admin/quotes/import', label = '엑셀 업로드' }: { endpoint?: string; label?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const post = async (f: File, dry: boolean) => {
    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch(`${endpoint}${dry ? '?dryRun=1' : ''}`, { method: 'POST', body: fd });
    const j = await res.json().catch(() => null);
    return { ok: res.ok && j?.ok, j };
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!f) return;
    setBusy(true); setMsg(''); setPreview(null); setFile(f);
    const { ok, j } = await post(f, true);
    setBusy(false);
    if (!ok) { setMsg(j?.error ?? '미리보기 실패'); setFile(null); return; }
    setPreview({ parsed: j.parsed ?? 0, created: j.created ?? 0, updated: j.updated ?? 0, skipped: j.skipped ?? 0, errors: j.errors ?? [] });
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    const { ok, j } = await post(file, false);
    setBusy(false);
    setPreview(null); setFile(null);
    if (!ok) { setMsg(j?.error ?? '업로드 실패'); return; }
    setMsg(`반영 완료 — 신규 ${j.created} · 갱신 ${j.updated}${j.skipped ? ` · 건너뜀 ${j.skipped}` : ''}`);
    router.refresh();
  };

  const cancel = () => { setPreview(null); setFile(null); setMsg(''); };

  return (
    <div className="relative flex items-center gap-2.5">
      {msg && <span className="text-[12px] text-ink-muted">{msg}</span>}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
      <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-ghost">
        <Icon name="plus" className="w-4 h-4" /> {busy ? '확인 중…' : label}
      </button>

      {preview && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[320px] card card-pad shadow-lg">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="text-[14px] font-bold text-ink m-0">업로드 미리보기</h3>
              <p className="text-[11.5px] text-ink-subtle mt-0.5 mb-0 truncate max-w-[220px]">{file?.name}</p>
            </div>
            <button onClick={cancel} className="icon-btn w-7 h-7"><Icon name="x" className="w-3.5 h-3.5" /></button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="신규" value={preview.created} tone="accent" />
            <Stat label="갱신" value={preview.updated} />
            <Stat label="건너뜀" value={preview.skipped} muted />
          </div>
          <p className="text-[11.5px] text-ink-subtle mb-3">읽은 행 {preview.parsed}건 · 아직 반영되지 않았습니다.</p>

          {preview.errors.length > 0 && (
            <div className="mb-3 rounded-md p-2" style={{ background: 'color-mix(in srgb, var(--error) 8%, transparent)' }}>
              <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--error)' }}>오류 {preview.errors.length}건</div>
              <ul className="max-h-[96px] overflow-auto space-y-0.5">
                {preview.errors.slice(0, 10).map((er, i) => (
                  <li key={i} className="text-[11px] text-ink-body break-words">· {er}</li>
                ))}
                {preview.errors.length > 10 && <li className="text-[11px] text-ink-subtle">… 외 {preview.errors.length - 10}건</li>}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={cancel} className="btn-ghost flex-1 justify-center">취소</button>
            <button onClick={apply} disabled={busy} className="btn-primary flex-1">{busy ? '반영 중…' : '반영'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, muted }: { label: string; value: number; tone?: 'accent'; muted?: boolean }) {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ background: 'var(--card-cream)' }}>
      <div className="text-[10.5px] text-ink-subtle">{label}</div>
      <div className="text-[17px] font-bold tabular-nums leading-tight"
        style={{ color: tone === 'accent' ? 'var(--accent)' : muted ? 'var(--muted-soft)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}
