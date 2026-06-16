'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Download, Upload, X, Loader2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { KnowledgeDataset } from '@/lib/knowledge';
import { FIELDS, DATASET_LABEL, formToRecord, recordToForm } from '@/lib/knowledge-fields';
import { toast } from '@/lib/toast';

type Rec = Record<string, unknown>;

// ─────────────── 편집/생성 모달 ───────────────
export function EditorModal({
  dataset, record, onClose, onSaved,
}: {
  dataset: KnowledgeDataset;
  record: Rec | null;            // null = 새 항목
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = record == null;
  const idField = dataset === 'guidelines' ? 'code' : dataset === 'modalities' ? '모달리티' : '시험';
  const originalId = isCreate ? '' : String(record?.[idField] ?? '');
  const [form, setForm] = useState<Record<string, string>>(() => recordToForm(dataset, record));
  const [saving, setSaving] = useState(false);

  const set = (field: string, v: string) => setForm(f => ({ ...f, [field]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const rec = formToRecord(dataset, form);
      const op = isCreate ? 'create' : 'update';
      const res = await fetch('/api/knowledge/mutate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataset, op, id: originalId, record: rec }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.details) ? data.details.join('\n') : (data.error ?? `HTTP ${res.status}`);
        throw new Error(detail);
      }
      toast.success(isCreate ? '새 항목이 추가되었습니다.' : '저장되었습니다.');
      onSaved();
    } catch (e) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : '알 수 없음'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-ink">
            {DATASET_LABEL[dataset]} {isCreate ? '새 항목' : '수정'}
            {!isCreate && <span className="text-ink-subtle font-mono text-xs ml-2">{originalId}</span>}
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink"><X className="w-5 h-5" /></button>
        </header>

        <div className="px-5 py-4 overflow-auto space-y-3">
          {FIELDS[dataset].map(f => (
            <div key={f.field}>
              <label className="label flex items-center gap-1.5">
                {f.label}
                {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.type === 'text' ? (
                <input className="input w-full" value={form[f.field] ?? ''} onChange={e => set(f.field, e.target.value)} />
              ) : (
                <textarea
                  className="input w-full font-mono text-xs leading-relaxed"
                  rows={f.type === 'json' ? 6 : f.type === 'array' ? 3 : 2}
                  value={form[f.field] ?? ''}
                  onChange={e => set(f.field, e.target.value)}
                  placeholder={f.type === 'array' ? '한 줄에 하나씩' : f.type === 'json' ? '{ "키": "값" }' : ''}
                />
              )}
            </div>
          ))}
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">취소</button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─────────────── 엑셀 내보내기/가져오기 ───────────────
type ImportSummary = { dataset: string; sheet: string; added: number; changed: number; removed: number; total: number; errors: string[] };

export function AdminBar({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportSummary[] | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  const upload = async (file: File, apply: boolean) => {
    const fd = new FormData();
    fd.append('file', file);
    if (apply) fd.append('apply', '1');
    const res = await fetch('/api/knowledge/import', { method: 'POST', body: fd });
    return { res, data: await res.json() };
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    pendingFile.current = file;
    setBusy(true); setPreview(null);
    try {
      const { data } = await upload(file, false);
      setPreview(data.summary ?? []);
      setPreviewOk(!!data.ok);
    } catch (err) {
      toast.error(`가져오기 미리보기 실패: ${err instanceof Error ? err.message : '알 수 없음'}`);
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!pendingFile.current) return;
    setBusy(true);
    try {
      const { res, data } = await upload(pendingFile.current, true);
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success('엑셀 내용이 반영되었습니다.');
      setPreview(null); pendingFile.current = null;
      onImported();
    } catch (err) {
      toast.error(`적용 실패: ${err instanceof Error ? err.message : '알 수 없음'}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-ink-muted mr-1">관리자 · 데이터 편집</span>
        <a href="/api/knowledge/export" className="btn-ghost text-xs">
          <Download className="w-3.5 h-3.5" /> 엑셀 내보내기
        </a>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost text-xs">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} 엑셀 가져오기
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPick} />
        <span className="text-[11px] text-ink-subtle">내보낸 엑셀을 수정한 뒤 다시 가져오면 반영됩니다 (무손실).</span>
      </div>

      {preview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
          <div className="font-semibold text-ink flex items-center gap-1.5">
            {previewOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
            가져오기 미리보기 {previewOk ? '— 적용 가능' : '— 검증 오류 (적용 불가)'}
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {preview.map(s => (
              <div key={s.dataset} className="rounded-md bg-white border border-slate-200 p-2">
                <div className="font-semibold text-ink mb-1">{DATASET_LABEL[s.dataset as KnowledgeDataset] ?? s.dataset}</div>
                <div className="text-ink-muted tabular-nums">
                  총 {s.total} · <span className="text-emerald-600">+{s.added}</span> · <span className="text-amber-600">~{s.changed}</span> · <span className="text-red-600">-{s.removed}</span>
                </div>
                {s.errors.length > 0 && (
                  <ul className="mt-1 text-red-600 list-disc pl-4 space-y-0.5 max-h-24 overflow-auto">
                    {s.errors.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}
                    {s.errors.length > 8 && <li>… 외 {s.errors.length - 8}건</li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setPreview(null); pendingFile.current = null; }} className="btn-ghost text-xs">취소</button>
            <button onClick={apply} disabled={!previewOk || busy} className={clsx('btn-primary text-xs', (!previewOk || busy) && 'opacity-50')}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} 적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
