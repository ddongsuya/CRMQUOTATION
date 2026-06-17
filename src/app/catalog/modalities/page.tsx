'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Save, GripVertical, ArrowLeft, Layers } from 'lucide-react';
import { toast } from '@/lib/toast';

type Mod = { key: string; label: string; desc?: string };
type Cat = { id: string; label: string; modalities: Mod[] };

export default function ModalityTemplatesAdmin() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/modality-templates').then(r => r.json()).then(d => {
    setCats(d.categories); setAvailable(d.availableKeys ?? []); setIsAdmin(!!d.isAdmin);
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const usedKeys = useMemo(() => new Set((cats ?? []).flatMap(c => c.modalities.map(m => m.key))), [cats]);
  const unused = available.filter(k => !usedKeys.has(k));

  if (!cats) return <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;

  const update = (fn: (draft: Cat[]) => Cat[]) => setCats(prev => fn(structuredClone(prev ?? [])));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/modality-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ categories: cats }) });
      const d = await res.json();
      if (!res.ok) throw new Error(Array.isArray(d.details) ? d.details.join('\n') : (d.error ?? `HTTP ${res.status}`));
      toast.success('모달리티 구성이 저장되었습니다.');
      setCats(d.categories);
    } catch (e) { toast.error(`저장 실패: ${e instanceof Error ? e.message : '알 수 없음'}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/catalog" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink mb-1"><ArrowLeft className="w-3.5 h-3.5" /> 항목·가격</Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Layers className="w-6 h-6 text-brand-500" /> 모달리티 구성</h1>
          <p className="text-sm text-ink-muted mt-0.5">새 견적 작성의 분류 → 모달리티 구성. 견적서 템플릿(마스터)에 맞춰 직접 편집합니다.</p>
        </div>
        {isAdmin && (
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
          </button>
        )}
      </div>

      {!isAdmin && <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">읽기 전용 — 관리자만 편집할 수 있습니다.</div>}

      <div className="space-y-4">
        {cats.map((cat, ci) => (
          <div key={ci} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-ink-subtle/50" />
              <input
                className="input font-semibold flex-1" value={cat.label} disabled={!isAdmin}
                onChange={e => update(d => { d[ci].label = e.target.value; return d; })}
                placeholder="분류 이름 (예: 의약품 독성)"
              />
              {isAdmin && (
                <button onClick={() => { if (cat.modalities.length && !confirm('이 분류의 모달리티도 함께 삭제됩니다. 계속할까요?')) return; update(d => d.filter((_, i) => i !== ci)); }}
                  className="p-2 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="분류 삭제"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>

            <div className="space-y-2 pl-6">
              {cat.modalities.map((m, mi) => (
                <div key={m.key} className="flex items-center gap-2 flex-wrap">
                  <span className="pill bg-slate-100 text-ink-subtle font-mono">{m.key}</span>
                  <input className="input flex-1 min-w-[140px]" value={m.label} disabled={!isAdmin}
                    onChange={e => update(d => { d[ci].modalities[mi].label = e.target.value; return d; })} placeholder="표시명" />
                  <input className="input w-40" value={m.desc ?? ''} disabled={!isAdmin}
                    onChange={e => update(d => { d[ci].modalities[mi].desc = e.target.value; return d; })} placeholder="설명(선택)" />
                  {isAdmin && (
                    <>
                      <select className="input w-32" value={ci}
                        onChange={e => { const to = Number(e.target.value); if (to === ci) return; update(d => { const [mv] = d[ci].modalities.splice(mi, 1); d[to].modalities.push(mv); return d; }); }}
                        title="다른 분류로 이동">
                        {cats.map((c2, i2) => <option key={i2} value={i2}>{c2.label || `분류 ${i2 + 1}`}</option>)}
                      </select>
                      <button onClick={() => update(d => { d[ci].modalities.splice(mi, 1); return d; })}
                        className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="모달리티 제거"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              ))}
              {cat.modalities.length === 0 && <div className="text-xs text-ink-subtle py-1">모달리티 없음</div>}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => update(d => [...d, { id: `cat-${d.length + 1}`, label: '새 분류', modalities: [] }])} className="btn-ghost text-sm">
            <Plus className="w-4 h-4" /> 분류 추가
          </button>
          {unused.length > 0 && cats.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-subtle text-xs">미배치 모달리티 추가:</span>
              <select className="input" defaultValue="" onChange={e => { const key = e.target.value; if (!key) return; update(d => { d[0].modalities.push({ key, label: key, desc: '' }); return d; }); e.target.value = ''; }}>
                <option value="">— 선택 ({unused.length}개)</option>
                {unused.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <span className="text-[11px] text-ink-subtle">(첫 분류에 추가 후 이동)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
