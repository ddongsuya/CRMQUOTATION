'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Loader2, Plus, Trash2, Save, GripVertical, ArrowLeft, Layers, ChevronDown, Pencil, FileStack, Search, X, Check } from 'lucide-react';
import { toast } from '@/lib/toast';

type Mod = { key: string; label: string; desc?: string; source?: string };
type Cat = { id: string; label: string; modalities: Mod[] };
type Rec = Record<string, unknown>;
type Tpl = { id: string; name: string; modality: string; scenario?: string; tests: { key: string; quantity?: number }[] };

/** 모달리티 → 후보 항목 (source key-prefix 정밀 매칭) */
function itemsOf(mod: Mod, all: Rec[]): Rec[] {
  const src = (mod.source ?? '').trim();
  if (src) return all.filter(it => String(it.key ?? '').startsWith(src));
  return all.filter(it => Array.isArray(it.modalityPool) && (it.modalityPool as string[]).includes(mod.key));
}

export default function ModalityTemplatesAdmin() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [items, setItems] = useState<Rec[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [builder, setBuilder] = useState<{ mod: Mod; tpl: Tpl | null } | null>(null);

  const loadCfg = () => fetch('/api/modality-templates').then(r => r.json()).then(d => { setCats(d.categories); setAvailable(d.availableKeys ?? []); setIsAdmin(!!d.isAdmin); }).catch(() => {});
  const loadItems = () => fetch('/api/test-items').then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => {});
  const loadTpls = () => fetch('/api/quote-templates').then(r => r.json()).then(d => setTemplates(d.templates ?? [])).catch(() => {});
  useEffect(() => { loadCfg(); loadItems(); loadTpls(); }, []);

  const usedKeys = useMemo(() => new Set((cats ?? []).flatMap(c => c.modalities.map(m => m.key))), [cats]);
  const unused = available.filter(k => !usedKeys.has(k));

  if (!cats) return <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;

  const update = (fn: (d: Cat[]) => Cat[]) => setCats(prev => fn(structuredClone(prev ?? [])));

  const saveCfg = async () => {
    setSavingCfg(true);
    try {
      const res = await fetch('/api/modality-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ categories: cats }) });
      const d = await res.json(); if (!res.ok) throw new Error(Array.isArray(d.details) ? d.details.join('\n') : (d.error ?? `HTTP ${res.status}`));
      toast.success('모달리티 구성이 저장되었습니다.'); setCats(d.categories);
    } catch (e) { toast.error(`저장 실패: ${e instanceof Error ? e.message : '알 수 없음'}`); } finally { setSavingCfg(false); }
  };

  // 템플릿 저장 (전체 배열 POST)
  const persistTemplates = async (next: Tpl[]) => {
    try {
      const res = await fetch('/api/quote-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templates: next }) });
      const d = await res.json(); if (!res.ok) throw new Error(Array.isArray(d.details) ? d.details.join('\n') : (d.error ?? `HTTP ${res.status}`));
      setTemplates(d.templates); toast.success('템플릿이 저장되었습니다.');
    } catch (e) { toast.error(`템플릿 저장 실패: ${e instanceof Error ? e.message : '알 수 없음'}`); }
  };
  const saveTemplate = (tpl: Tpl) => { const next = templates.some(t => t.id === tpl.id) ? templates.map(t => t.id === tpl.id ? tpl : t) : [...templates, tpl]; persistTemplates(next); setBuilder(null); };
  const deleteTemplate = (id: string) => { if (!confirm('이 템플릿을 삭제할까요?')) return; persistTemplates(templates.filter(t => t.id !== id)); };

  const toggle = (k: string) => setExpanded(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/catalog" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink mb-1"><ArrowLeft className="w-3.5 h-3.5" /> 항목·가격</Link>
          <h1 className="text-[34px] font-bold tracking-[-0.022em] leading-[1.1] flex items-center gap-2"><Layers className="w-6 h-6 text-brand-500" /> 모달리티 · 템플릿 구성</h1>
          <p className="text-sm text-ink-muted mt-0.5">분류·모달리티 구성과, 각 모달리티의 견적 템플릿(프리셋)을 직접 만듭니다. 템플릿은 새 견적 작성에서 선택해 사용합니다.</p>
        </div>
        {isAdmin && <button onClick={saveCfg} disabled={savingCfg} className="btn-primary">{savingCfg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 구성 저장</button>}
      </div>

      {!isAdmin && <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">읽기 전용 — 관리자만 편집할 수 있습니다.</div>}

      <div className="space-y-4">
        {cats.map((cat, ci) => (
          <div key={ci} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-ink-subtle/50" />
              <input className="input font-semibold flex-1" value={cat.label} disabled={!isAdmin} onChange={e => update(d => { d[ci].label = e.target.value; return d; })} placeholder="분류 이름" />
              {isAdmin && <button onClick={() => { if (cat.modalities.length && !confirm('이 분류의 모달리티 구성도 삭제됩니다(항목·템플릿은 유지). 계속할까요?')) return; update(d => d.filter((_, i) => i !== ci)); }} className="p-2 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="분류 삭제"><Trash2 className="w-4 h-4" /></button>}
            </div>

            <div className="space-y-2 pl-6">
              {cat.modalities.map((m, mi) => {
                const tpls = templates.filter(t => t.modality === m.key);
                const open = expanded.has(m.key);
                return (
                  <div key={m.key} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap p-2.5 bg-slate-50/50">
                      <span className="pill bg-slate-100 text-ink-subtle font-mono">{m.key}</span>
                      <input className="input flex-1 min-w-[120px]" value={m.label} disabled={!isAdmin} onChange={e => update(d => { d[ci].modalities[mi].label = e.target.value; return d; })} placeholder="표시명" />
                      {isAdmin && (
                        <select className="input w-28" value={ci} onChange={e => { const to = Number(e.target.value); if (to === ci) return; update(d => { const [mv] = d[ci].modalities.splice(mi, 1); d[to].modalities.push(mv); return d; }); }} title="분류 이동">
                          {cats.map((c2, i2) => <option key={i2} value={i2}>{c2.label || `분류 ${i2 + 1}`}</option>)}
                        </select>
                      )}
                      <button onClick={() => toggle(m.key)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100">
                        <FileStack className="w-3.5 h-3.5" /> 템플릿 {tpls.length}개 <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {isAdmin && <button onClick={() => update(d => { d[ci].modalities.splice(mi, 1); return d; })} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="모달리티 제거"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>

                    {open && (
                      <div className="p-3 border-t border-slate-100 space-y-2">
                        {tpls.length === 0 && <div className="text-xs text-ink-subtle py-1">아직 템플릿이 없습니다. 새 템플릿을 만들어 보세요.</div>}
                        {tpls.map(t => (
                          <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 hover:bg-slate-50/50">
                            <FileStack className="w-4 h-4 text-brand-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-ink truncate">{t.name}</div>
                              <div className="text-[11px] text-ink-subtle truncate">{t.tests.length}개 시험{t.scenario ? ` · ${t.scenario}` : ''}</div>
                            </div>
                            {isAdmin && (
                              <>
                                <button onClick={() => setBuilder({ mod: m, tpl: t })} className="p-1.5 rounded text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                        ))}
                        {isAdmin && <button onClick={() => setBuilder({ mod: m, tpl: null })} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 새 템플릿</button>}
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

      {builder && (
        <TemplateBuilder
          mod={builder.mod}
          tpl={builder.tpl}
          candidates={itemsOf(builder.mod, items)}
          onClose={() => setBuilder(null)}
          onSave={saveTemplate}
        />
      )}
    </div>
  );
}

// ─────────────── 템플릿 빌더 (시험 선택) ───────────────
function TemplateBuilder({ mod, tpl, candidates, onClose, onSave }: { mod: Mod; tpl: Tpl | null; candidates: Rec[]; onClose: () => void; onSave: (t: Tpl) => void }) {
  const [name, setName] = useState(tpl?.name ?? '');
  const [scenario, setScenario] = useState(tpl?.scenario ?? '');
  const [picked, setPicked] = useState<Set<string>>(() => new Set((tpl?.tests ?? []).map(t => t.key)));
  const [q, setQ] = useState('');
  const [hideNoPrice, setHideNoPrice] = useState(false);

  const hasPrice = (c: Rec) => c.priceMfds != null || c.priceOecd != null;
  const noPriceCount = candidates.filter(c => !hasPrice(c)).length;
  const filtered = candidates.filter(c => {
    if (hideNoPrice && !hasPrice(c) && !picked.has(String(c.key ?? ''))) return false; // 선택된 건 숨겨도 유지
    if (q.trim() && !String(c.testName ?? '').toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });
  const togglePick = (k: string) => setPicked(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const fmtWeeks = (w: unknown) => w == null ? '' : Number(w) === 0 ? '단회' : `${w}주`;
  const fmtPrice = (c: Rec) => {
    const p = c.priceMfds ?? c.priceOecd;
    return p != null && Number(p) > 0 ? `₩${Number(p).toLocaleString()}` : '협의';
  };

  const save = () => {
    if (!name.trim()) { toast.error('템플릿 이름을 입력하세요.'); return; }
    if (picked.size === 0) { toast.error('시험을 1개 이상 선택하세요.'); return; }
    onSave({
      id: tpl?.id ?? `tpl-${Date.now()}`,
      name: name.trim(), modality: mod.key, scenario: scenario.trim(),
      tests: [...picked].map(key => ({ key, quantity: 1 })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-ink">{tpl ? '템플릿 수정' : '새 템플릿'} <span className="text-ink-subtle text-xs ml-1">· {mod.label}</span></div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink"><X className="w-5 h-5" /></button>
        </header>

        <div className="px-5 py-4 space-y-3 border-b border-slate-100">
          <input className="input w-full" value={name} onChange={e => setName(e.target.value)} placeholder="템플릿 이름 (예: IND 1상 최소 패키지)" />
          <input className="input w-full" value={scenario} onChange={e => setScenario(e.target.value)} placeholder="한 줄 설명 (선택, 예: 1상 임상 개시용 최소 구성)" />
        </div>

        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle" />
              <input className="input pl-8 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="시험 검색" />
            </div>
            <span className="text-xs text-brand-700 font-semibold whitespace-nowrap">{picked.size}개 선택</span>
          </div>
          {noPriceCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer select-none w-fit">
              <input type="checkbox" checked={hideNoPrice} onChange={e => setHideNoPrice(e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              가격 미입력(협의) 항목 숨기기 <span className="text-ink-subtle">({noPriceCount}건)</span>
            </label>
          )}
        </div>

        <div className="flex-1 overflow-auto px-5 pb-2">
          {candidates.length === 0 && <div className="text-xs text-ink-subtle py-6 text-center">이 모달리티에 후보 시험이 없습니다. (항목·가격에서 먼저 추가)</div>}
          <div className="divide-y divide-slate-50">
            {filtered.slice(0, 200).map((c, i) => {
              const key = String(c.key ?? '');
              const on = picked.has(key);
              const priced = hasPrice(c);
              const period = fmtWeeks(c.studyWeeks);
              const route = c.adminRoute ? String(c.adminRoute) : '';
              return (
                <button key={key || i} onClick={() => togglePick(key)} className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-slate-50/50 px-1 rounded">
                  <span className={clsx('inline-flex items-center justify-center w-5 h-5 rounded border-2 flex-shrink-0', on ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300')}>{on && <Check className="w-3 h-3" />}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-ink">{String(c.testName ?? '(이름없음)')}</span>
                    {(period || route) && <span className="block text-[11px] text-ink-subtle truncate">{[period, route].filter(Boolean).join(' · ')}</span>}
                  </span>
                  <span className={clsx('text-[11px] font-medium whitespace-nowrap flex-shrink-0 tabular-nums', priced ? 'text-ink-muted' : 'text-amber-600')}>{fmtPrice(c)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">취소</button>
          <button onClick={save} className="btn-primary text-sm"><Save className="w-4 h-4" /> 저장</button>
        </footer>
      </div>
    </div>
  );
}
