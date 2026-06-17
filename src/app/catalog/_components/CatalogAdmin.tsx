'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Download, Upload, X, Loader2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FIELDS, GROUPS, formToPartial, recordToForm } from '@/lib/test-items-fields';
import { toast } from '@/lib/toast';

type Rec = Record<string, unknown>;

// ─────────────── 편집/생성 모달 ───────────────
export function ItemEditorModal({
  record, createDefaults, onClose, onSaved,
}: { record: Rec | null; createDefaults?: Rec; onClose: () => void; onSaved: () => void }) {
  const isCreate = record == null;
  const [form, setForm] = useState<Record<string, string>>(() => recordToForm(record ?? createDefaults ?? null));
  const [saving, setSaving] = useState(false);
  const set = (field: string, v: string) => setForm(f => ({ ...f, [field]: v }));

  const save = async () => {
    setSaving(true);
    try {
      // 업데이트는 원본에 폼 값만 덮어써 provenance(sourceFile 등) 보존
      const partial = formToPartial(form);
      const rec = isCreate ? partial : { ...record, ...partial };
      const op = isCreate ? 'create' : 'update';
      const res = await fetch('/api/test-items/mutate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, key: isCreate ? undefined : String(record?.key ?? ''), record: rec }),
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
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-ink">
            시험항목 {isCreate ? '새 항목' : '수정'}
            {!isCreate && <span className="text-ink-subtle text-xs ml-2">{String(record?.testName ?? '')}</span>}
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink"><X className="w-5 h-5" /></button>
        </header>

        <div className="px-5 py-4 overflow-auto space-y-4">
          {GROUPS.map(group => (
            <div key={group}>
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">{group}</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {FIELDS.filter(f => f.group === group).map(f => {
                  const full = f.type === 'textarea' || f.type === 'json' || f.type === 'array';
                  return (
                    <div key={f.field} className={clsx(full && 'sm:col-span-2')}>
                      <label className="label flex items-center gap-1.5">
                        {f.label}{f.required && <span className="text-red-500">*</span>}
                      </label>
                      {f.type === 'select' ? (
                        <select className="input w-full" value={form[f.field] ?? ''} onChange={e => set(f.field, e.target.value)}>
                          <option value="">—</option>
                          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'bool' ? (
                        <select className="input w-full" value={/^(y|true|1)$/i.test(form[f.field] ?? '') ? 'Y' : 'N'} onChange={e => set(f.field, e.target.value)}>
                          <option value="N">아니오</option>
                          <option value="Y">예</option>
                        </select>
                      ) : f.type === 'text' || f.type === 'number' ? (
                        <input
                          className="input w-full"
                          inputMode={f.type === 'number' ? 'numeric' : undefined}
                          disabled={!isCreate && f.readonlyOnEdit}
                          value={form[f.field] ?? ''}
                          onChange={e => set(f.field, e.target.value)}
                        />
                      ) : (
                        <textarea
                          className="input w-full font-mono text-xs leading-relaxed"
                          rows={f.type === 'json' ? 4 : f.type === 'array' ? 3 : 2}
                          value={form[f.field] ?? ''}
                          onChange={e => set(f.field, e.target.value)}
                          placeholder={f.type === 'array' ? '한 줄에 하나씩' : f.type === 'json' ? '{ "2": 20000000 }' : ''}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">취소</button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─────────────── 엑셀 내보내기/가져오기 ───────────────
type Summary = { added: number; changed: number; removed: number; total: number; changedKeys?: string[] };

export function ItemAdminBar({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ summary: Summary; errors: string[]; ok: boolean } | null>(null);

  const upload = async (file: File, apply: boolean) => {
    const fd = new FormData();
    fd.append('file', file);
    if (apply) fd.append('apply', '1');
    const res = await fetch('/api/test-items/import', { method: 'POST', body: fd });
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
      setPreview({ summary: data.summary, errors: data.errors ?? [], ok: !!data.ok });
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
        <a href="/api/test-items/export" className="btn-ghost text-xs">
          <Download className="w-3.5 h-3.5" /> 엑셀 내보내기
        </a>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost text-xs">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} 엑셀 가져오기
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPick} />
        <span className="text-[11px] text-ink-subtle">내보낸 엑셀에서 가격을 일괄 수정한 뒤 다시 가져오면 반영됩니다 (무손실).</span>
      </div>

      {preview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
          <div className="font-semibold text-ink flex items-center gap-1.5">
            {preview.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
            가져오기 미리보기 {preview.ok ? '— 적용 가능' : '— 검증 오류 (적용 불가)'}
          </div>
          <div className="tabular-nums text-ink-muted">
            총 {preview.summary.total} · <span className="text-emerald-600">추가 {preview.summary.added}</span> · <span className="text-amber-600">변경 {preview.summary.changed}</span> · <span className="text-red-600">삭제 {preview.summary.removed}</span>
          </div>
          {preview.summary.changedKeys && preview.summary.changedKeys.length > 0 && (
            <div className="text-[11px] text-ink-subtle">변경 예: {preview.summary.changedKeys.slice(0, 5).join(', ')}{preview.summary.changedKeys.length > 5 ? ' …' : ''}</div>
          )}
          {preview.errors.length > 0 && (
            <ul className="text-red-600 list-disc pl-4 space-y-0.5 max-h-32 overflow-auto">
              {preview.errors.slice(0, 12).map((er, i) => <li key={i}>{er}</li>)}
              {preview.errors.length > 12 && <li>… 외 {preview.errors.length - 12}건</li>}
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setPreview(null); pendingFile.current = null; }} className="btn-ghost text-xs">취소</button>
            <button onClick={apply} disabled={!preview.ok || busy} className={clsx('btn-primary text-xs', (!preview.ok || busy) && 'opacity-50')}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} 적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
