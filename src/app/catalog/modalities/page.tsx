'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Save, GripVertical, ArrowLeft, Layers, ChevronDown, Pencil, FlaskConical, Search } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ItemEditorModal } from '../_components/CatalogAdmin';

type Mod = { key: string; label: string; desc?: string; source?: string };
type Cat = { id: string; label: string; modalities: Mod[] };
type Rec = Record<string, unknown>;

const fmt = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n.toLocaleString() : '—');

/** 모달리티 → 그 템플릿에 속한 항목. source 가 있으면 key prefix 로 정밀 매칭
 *  (sourceFile.includes 는 '스크리닝_'⊂'심혈관계스크리닝_' 같은 부분문자열 충돌이 있어 사용 X).
 *  source 가 없으면(가짜 없으니 사실상 미사용) modalityPool 로 매칭. */
function itemsOf(mod: Mod, all: Rec[]): Rec[] {
  const src = (mod.source ?? '').trim();
  if (src) return all.filter(it => String(it.key ?? '').startsWith(src));
  return all.filter(it => Array.isArray(it.modalityPool) && (it.modalityPool as string[]).includes(mod.key));
}

export default function ModalityTemplatesAdmin() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Rec[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [q, setQ] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ record: Rec | null; createDefaults?: Rec } | null>(null);

  const loadCfg = () => fetch('/api/modality-templates').then(r => r.json()).then(d => {
    setCats(d.categories); setAvailable(d.availableKeys ?? []); setIsAdmin(!!d.isAdmin);
  }).catch(() => {});
  const loadItems = () => fetch('/api/test-items').then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => {});
  useEffect(() => { loadCfg(); loadItems(); }, []);

  const usedKeys = useMemo(() => new Set((cats ?? []).flatMap(c => c.modalities.map(m => m.key))), [cats]);
  const unused = available.filter(k => !usedKeys.has(k));

  if (!cats) return <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;

  const update = (fn: (draft: Cat[]) => Cat[]) => setCats(prev => fn(structuredClone(prev ?? [])));

  const saveCfg = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/modality-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ categories: cats }) });
      const d = await res.json();
      if (!res.ok) throw new Error(Array.isArray(d.details) ? d.details.join('\n') : (d.error ?? `HTTP ${res.status}`));
      toast.success('모달리티 구성이 저장되었습니다.'); setCats(d.categories);
    } catch (e) { toast.error(`저장 실패: ${e instanceof Error ? e.message : '알 수 없음'}`); }
    finally { setSaving(false); }
  };

  const delItem = async (rec: Rec) => {
    if (!confirm(`"${String(rec.testName ?? rec.key)}" 항목을 삭제할까요?`)) return;
    try {
      const res = await fetch('/api/test-items/mutate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'delete', key: rec.key }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success('삭제되었습니다.'); loadItems();
    } catch (e) { toast.error(`삭제 실패: ${e instanceof Error ? e.message : '알 수 없음'}`); }
  };

  const toggle = (k: string) => setExpanded(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/catalog" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink mb-1"><ArrowLeft className="w-3.5 h-3.5" /> 항목·가격</Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Layers className="w-6 h-6 text-brand-500" /> 모달리티 구성 · 템플릿</h1>
          <p className="text-sm text-ink-muted mt-0.5">분류·모달리티와 각 모달리티의 템플릿 항목을 직접 편집합니다. (구성 변경은 "저장", 항목 편집은 즉시 반영)</p>
        </div>
        {isAdmin && <button onClick={saveCfg} disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 구성 저장</button>}
      </div>

      {!isAdmin && <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">읽기 전용 — 관리자만 편집할 수 있습니다.</div>}

      <div className="space-y-4">
        {cats.map((cat, ci) => (
          <div key={ci} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-ink-subtle/50" />
              <input className="input font-semibold flex-1" value={cat.label} disabled={!isAdmin}
                onChange={e => update(d => { d[ci].label = e.target.value; return d; })} placeholder="분류 이름" />
              {isAdmin && <button onClick={() => { if (cat.modalities.length && !confirm('이 분류의 모달리티 구성도 함께 삭제됩니다(항목은 유지). 계속할까요?')) return; update(d => d.filter((_, i) => i !== ci)); }}
                className="p-2 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="분류 삭제"><Trash2 className="w-4 h-4" /></button>}
            </div>

            <div className="space-y-2 pl-6">
              {cat.modalities.map((m, mi) => {
                const its = itemsOf(m, items);
                const open = expanded.has(m.key);
                const search = (q[m.key] ?? '').trim().toLowerCase();
                const shown = search ? its.filter(it => String(it.testName ?? '').toLowerCase().includes(search)) : its;
                return (
                  <div key={m.key} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap p-2.5 bg-slate-50/50">
                      <span className="pill bg-slate-100 text-ink-subtle font-mono">{m.key}</span>
                      <input className="input flex-1 min-w-[120px]" value={m.label} disabled={!isAdmin}
                        onChange={e => update(d => { d[ci].modalities[mi].label = e.target.value; return d; })} placeholder="표시명" />
                      <input className="input w-32" value={m.desc ?? ''} disabled={!isAdmin}
                        onChange={e => update(d => { d[ci].modalities[mi].desc = e.target.value; return d; })} placeholder="설명" />
                      {isAdmin && (
                        <select className="input w-28" value={ci}
                          onChange={e => { const to = Number(e.target.value); if (to === ci) return; update(d => { const [mv] = d[ci].modalities.splice(mi, 1); d[to].modalities.push(mv); return d; }); }} title="분류 이동">
                          {cats.map((c2, i2) => <option key={i2} value={i2}>{c2.label || `분류 ${i2 + 1}`}</option>)}
                        </select>
                      )}
                      <button onClick={() => toggle(m.key)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100">
                        <FlaskConical className="w-3.5 h-3.5" /> 템플릿 {its.length}개
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {isAdmin && <button onClick={() => update(d => { d[ci].modalities.splice(mi, 1); return d; })} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="모달리티 제거"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>

                    {open && (
                      <div className="p-3 border-t border-slate-100 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle" />
                            <input className="input pl-8 text-xs py-1.5" placeholder="항목 검색" value={q[m.key] ?? ''} onChange={e => setQ(p => ({ ...p, [m.key]: e.target.value }))} />
                          </div>
                          {isAdmin && (
                            <button onClick={() => setEditing({ record: null, createDefaults: { key: `${(m.source || m.key)}#new#${Date.now()}__`, masterId: `${(m.source || m.key)}#new#${Date.now()}`, modalityPool: [m.key], sourceFile: m.source || '', category: m.label, status: '수동' } })}
                              className="btn-ghost text-xs whitespace-nowrap"><Plus className="w-3.5 h-3.5" /> 항목 추가</button>
                          )}
                        </div>
                        {shown.length === 0 ? (
                          <div className="text-xs text-ink-subtle py-2 text-center">{its.length === 0 ? '이 모달리티의 템플릿 항목이 없습니다.' : '검색 결과 없음'}</div>
                        ) : (
                          <div className="max-h-80 overflow-auto divide-y divide-slate-50">
                            {shown.slice(0, 100).map((it, i) => (
                              <div key={String(it.key ?? i)} className="flex items-center gap-2 py-1.5 text-xs hover:bg-slate-50/50 px-1 rounded">
                                <span className="flex-1 min-w-0 truncate text-ink">{String(it.testName ?? '(이름없음)')}</span>
                                <span className="text-ink-subtle w-12 text-center">{it.studyWeeks != null ? `${it.studyWeeks}주` : it.adminRoute ? String(it.adminRoute) : '—'}</span>
                                <span className="tabular-nums w-24 text-right text-ink-muted">{it.priceTiers ? 'tiers' : fmt(it.priceMfds)}</span>
                                {isAdmin && (
                                  <div className="flex items-center gap-0.5">
                                    <button onClick={() => setEditing({ record: it })} className="p-1 rounded text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={() => delItem(it)} className="p-1 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {shown.length > 100 && <div className="text-[11px] text-ink-subtle py-1 text-center">상위 100개 · 검색으로 좁히세요</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {cat.modalities.length === 0 && <div className="text-xs text-ink-subtle py-1">모달리티 없음</div>}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => update(d => [...d, { id: `cat-${d.length + 1}`, label: '새 분류', modalities: [] }])} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> 분류 추가</button>
          {unused.length > 0 && cats.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-subtle text-xs">미배치 모달리티:</span>
              <select className="input" defaultValue="" onChange={e => { const key = e.target.value; if (!key) return; update(d => { d[0].modalities.push({ key, label: key, desc: '', source: '' }); return d; }); e.target.value = ''; }}>
                <option value="">— 추가 ({unused.length}개)</option>
                {unused.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {editing && (
        <ItemEditorModal
          record={editing.record}
          createDefaults={editing.createDefaults}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadItems(); }}
        />
      )}
    </div>
  );
}
