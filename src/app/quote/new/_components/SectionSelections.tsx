'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Search, Plus, X, Trash2, FlaskConical, Pencil, RotateCcw, Sparkles } from 'lucide-react';
import { useWizard, type Selection } from '@/lib/store';
import { POLICY_REGISTRY, applicablePolicies } from '@/engine/policy';

type PolicyInputDef = { key: string; label_ko: string; type: 'number' | 'select'; min?: number; hint_ko?: string;
  options?: { value: string; label_ko: string }[] };
type PolicyDef = {
  label_ko: string;
  description_ko: string;
  appliesTo: (item: { testName: string }) => boolean;
  inputs: PolicyInputDef[];
  compute: (inputs: Record<string, unknown>) => { ok: boolean; value?: number; reason?: string; ruleId: string };
  appliesToField: 'unitPriceOverride' | 'info';
};
const REGISTRY = POLICY_REGISTRY as Record<string, PolicyDef>;

/** override 가 하나라도 설정됐는지 (UI 강조용) */
function hasAnyOverride(s: Selection): boolean {
  return s.unitPriceOverride != null
      || s.studyWeeksOverride != null
      || s.hamryangCountOverride != null
      || !!(s.customNote && s.customNote.trim());
}

/** "12,345" 같은 사용자 입력을 number 로 (빈 문자열 → null) */
function parseNumInput(v: string): number | null {
  const s = v.replace(/[,\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type SearchHit = {
  key: string;
  testName: string;
  adminRoute: string | null;
  category: string | null;
  studyWeeks: number | null;
  unitPrice: number;
};

export default function SectionSelections() {
  const s = useWizard();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!showSearch) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch('/api/items/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            modality: s.modality,
            query,
            priceStandard: s.priceStandard,
            excipientCount: s.excipientCount,
            limit: 50,
          }),
        });
        const data = await res.json() as { hits: SearchHit[]; total: number };
        setHits(data.hits);
        setTotal(data.total);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [showSearch, query, s.modality, s.priceStandard, s.excipientCount]);

  const addManual = (hit: SearchHit) => {
    const sel: Selection = {
      key: hit.key,
      testName: hit.testName,
      adminRoute: hit.adminRoute,
      unitPrice: hit.unitPrice,
      quantity: 1,
      tag: hit.category ?? '수동 추가',
      source: 'manual',
    };
    s.addSelection(sel);
  };

  return (
    <div className="space-y-5">
      {/* 부형제 종수 */}
      <div className="rounded-xl bg-gradient-to-br from-brand-50/40 to-transparent border border-brand-100/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-ink mb-0.5">부형제 종수</div>
            <div className="text-[11px] text-ink-muted">함량분석 단위수 = 기본 × max(종수, 1)</div>
          </div>
          <input
            type="number"
            min={0}
            className="input w-20 text-center font-semibold text-base"
            value={s.excipientCount}
            onChange={(e) => s.patch({ excipientCount: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </div>

      {/* Header w/ search toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <FlaskConical className="w-4 h-4 text-brand-500" />
          선택된 항목 <span className="text-brand-600">{s.selections.length}건</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSearch(v => !v)} className="btn-ghost text-xs px-2 py-1">
            {showSearch ? <><X className="w-3.5 h-3.5" />검색 닫기</> : <><Plus className="w-3.5 h-3.5" />항목 검색·추가</>}
          </button>
          {s.selections.length > 0 && (
            <button onClick={() => s.replaceSelections([])} className="btn-ghost text-xs px-2 py-1 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />모두 비우기
            </button>
          )}
        </div>
      </div>

      {/* Manual search */}
      {showSearch && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 animate-slide-up">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
            <input
              type="text"
              placeholder={`"${s.modality || '전체'}" 모달리티 내 검색…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-9 pr-20"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-subtle font-medium tabular-nums">
              {searching ? '검색 중…' : `${hits.length}/${total}`}
            </span>
          </div>
          <div className="max-h-60 overflow-auto bg-white rounded-lg border border-slate-100">
            {hits.length === 0 ? (
              <div className="text-[11px] text-ink-subtle text-center py-6">
                {query ? '일치하는 항목이 없습니다.' : '검색어를 입력하세요.'}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {hits.map(h => {
                  const already = s.selections.some(x => x.key === h.key);
                  return (
                    <li key={h.key} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/60 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-ink truncate">{h.testName}</div>
                        <div className="text-[10px] text-ink-subtle">
                          {[h.category, h.adminRoute, h.studyWeeks ? `${h.studyWeeks}주` : null].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      <div className="text-right text-xs text-ink-muted tabular-nums whitespace-nowrap">
                        {h.unitPrice > 0 ? `₩${h.unitPrice.toLocaleString()}` : <span className="text-ink-subtle">—</span>}
                      </div>
                      <button
                        onClick={() => addManual(h)}
                        disabled={already}
                        className={clsx(
                          'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all',
                          already
                            ? 'bg-slate-100 text-ink-subtle cursor-not-allowed'
                            : 'bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white',
                        )}
                      >
                        {already ? <span className="text-[10px]">✓</span> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Selected items list */}
      {s.selections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 py-10 px-6 text-center">
          <FlaskConical className="w-8 h-8 mx-auto text-ink-subtle/40 mb-2" />
          <div className="text-xs text-ink-muted">
            3단계 &quot;임상 계획&quot;에서 자동 구성하거나
            <br />
            상단 &quot;항목 검색·추가&quot;로 직접 추가하세요.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-ink-muted w-24">분류</th>
                  <th className="px-3 py-2 text-left font-semibold text-ink-muted">시험명</th>
                  <th className="px-3 py-2 text-left font-semibold text-ink-muted w-16">경로</th>
                  <th className="px-3 py-2 text-center font-semibold text-ink-muted w-16">수량</th>
                  <th className="w-8" />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {(['설치류', '비설치류', '공통'] as const).flatMap(group => {
                  const items = s.selections.filter(it => speciesGroup(it.testName) === group);
                  if (items.length === 0) return [];
                  return [
                    <tr key={`hdr-${group}`} className="bg-slate-50/50">
                      <td colSpan={5} className="px-3 py-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                        {group} <span className="text-brand-600 font-semibold normal-case tracking-normal">· {items.length}건</span>
                      </td>
                    </tr>,
                    ...items.flatMap(it => {
                      const overridden = hasAnyOverride(it);
                      const isEditing = editingKey === it.key;
                      return [
                        <tr key={it.key} className={clsx(
                          'border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-colors',
                          overridden && 'bg-amber-50/30',
                        )}>
                          <td className="px-3 py-2 text-[10px] text-ink-subtle">{it.tag || '—'}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={priorityDot(it.priority)} />
                              <span className="text-ink">{it.testName}</span>
                              {it.source === 'manual' && (
                                <span className="pill bg-amber-50 text-amber-700 border border-amber-200">수동</span>
                              )}
                              {overridden && (
                                <span className="pill bg-orange-100 text-orange-700 border border-orange-300" title="사용자 직접 입력 적용됨">
                                  <Pencil className="w-2.5 h-2.5 inline" /> 수정
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-ink-muted">{it.adminRoute || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min={1}
                              className="w-12 px-1.5 py-0.5 border border-slate-200 rounded text-center text-xs"
                              value={it.quantity}
                              onChange={(e) => s.setQuantity(it.key, Number(e.target.value) || 1)}
                            />
                          </td>
                          <td className="px-1 text-center">
                            <button
                              onClick={() => setEditingKey(isEditing ? null : it.key)}
                              className={clsx(
                                'rounded p-1 transition-colors',
                                isEditing ? 'bg-brand-100 text-brand-700'
                                          : overridden ? 'text-orange-600 hover:bg-orange-100'
                                                       : 'text-ink-subtle hover:text-brand-600 hover:bg-brand-50',
                              )}
                              title={isEditing ? '편집 닫기' : '값 직접 입력 (가격·시험주차·함량회수·메모)'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                          <td className="px-1 text-center">
                            <button
                              onClick={() => s.removeSelection(it.key)}
                              className="text-ink-subtle hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors"
                              title="이 항목 제거"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>,
                        isEditing && (
                          <tr key={it.key + '-edit'} className="bg-slate-50/60 border-b border-slate-100">
                            <td colSpan={6} className="px-4 py-3">
                              <OverrideEditor selection={it} onClose={() => setEditingKey(null)} />
                            </td>
                          </tr>
                        ),
                      ].filter(Boolean);
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function speciesGroup(name: string): '설치류' | '비설치류' | '공통' {
  if (/설치류|rat|마우스|mouse/i.test(name) && !/비설치류/.test(name)) return '설치류';
  if (/비설치류|개|dog|beagle|비글|원숭이|monkey/i.test(name)) return '비설치류';
  return '공통';
}

function priorityDot(p?: string) {
  const color =
    p === '필수' ? 'bg-red-500' :
    p === '권장' ? 'bg-amber-500' :
    p === '옵션' ? 'bg-slate-400' :
    'bg-slate-200';
  return `inline-block w-1.5 h-1.5 rounded-full ${color}`;
}

/**
 * Phase C-3: 항목별 수동 입력 (override) 편집 폼.
 * 비임상시험의 특수 케이스(영업 협의가·비정형 시험주차·함량분석 회수 조정·자유 메모) 대응.
 *
 * 모든 필드 빈 값 = 자동값 사용. 값 입력 = override 적용 (assemble.js R7).
 * 명시적 0 도 유효: unitPrice=0 → 무료 옵션, studyWeeks=0 → 단회, hamryangCount=0 → 함량분석 라인 제거.
 */
function OverrideEditor({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  const s = useWizard();
  const set = (patch: Partial<Pick<Selection, 'unitPriceOverride' | 'studyWeeksOverride' | 'hamryangCountOverride' | 'customNote'>>) => {
    s.setSelectionOverride(selection.key, patch);
  };
  const autoPrice = selection.unitPrice;
  const overridden = hasAnyOverride(selection);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-ink-muted flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5 text-brand-500" />
          항목별 수동 입력 — <span className="text-ink">{selection.testName}</span>
        </div>
        <div className="flex items-center gap-1">
          {overridden && (
            <button
              onClick={() => set({ unitPriceOverride: null, studyWeeksOverride: null, hamryangCountOverride: null, customNote: null })}
              className="btn-ghost text-[10px] px-2 py-0.5 text-ink-muted hover:text-ink"
              title="모든 수동 입력 제거 (자동값으로 복귀)"
            >
              <RotateCcw className="w-3 h-3" /> 자동값으로
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-[10px] px-2 py-0.5">
            <X className="w-3 h-3" /> 닫기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <FieldNum
          label="단가 (원)"
          hint={`자동: ${autoPrice ? autoPrice.toLocaleString() : '—'}`}
          value={selection.unitPriceOverride}
          onChange={(v) => set({ unitPriceOverride: v })}
          placeholder={autoPrice ? autoPrice.toLocaleString() : '입력'}
        />
        <FieldNum
          label="시험 투여 주차"
          hint="함량분석 회수에 영향 (자동: testName 파싱)"
          value={selection.studyWeeksOverride}
          onChange={(v) => set({ studyWeeksOverride: v })}
          placeholder="예: 4, 13, 0=단회"
          min={0}
        />
        <FieldNum
          label="함량분석 회수"
          hint="직접 지정 (0 = 라인 제거)"
          value={selection.hamryangCountOverride}
          onChange={(v) => set({ hamryangCountOverride: v })}
          placeholder="자동 계산"
          min={0}
        />
        <FieldText
          label="비고 (메모)"
          hint="견적서 비고란에 출력"
          value={selection.customNote}
          onChange={(v) => set({ customNote: v })}
          placeholder="예: 의뢰자 협의 단가"
        />
      </div>

      {/* Phase C-4a: 적용 가능한 정책 룰 (PF-001, AD-001, AD-003, AD-010) */}
      <PoliciesPanel selection={selection} />

      <div className="text-[10px] text-ink-subtle leading-relaxed">
        💡 빈 칸으로 두면 자동값을 사용합니다. 입력한 값은 즉시 견적에 반영되며, 견적서 비고에 <span className="font-semibold text-orange-700">[수동 가격]</span> 표시로 출처가 기록됩니다.
      </div>
    </div>
  );
}

/** Phase C-4a: rules_catalog 의 단가·공식 명시 룰을 한 번 클릭으로 적용. */
function PoliciesPanel({ selection }: { selection: Selection }) {
  const s = useWizard();
  const ruleIds: string[] = applicablePolicies({ testName: selection.testName });
  if (ruleIds.length === 0) return null;

  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50/30 p-2.5">
      <div className="text-[10px] font-semibold text-brand-700 mb-1.5 flex items-center gap-1">
        <Sparkles className="w-3 h-3" /> 적용 가능한 정책 룰 {ruleIds.length}개
      </div>
      <div className="space-y-1.5">
        {ruleIds.map(id => (
          <PolicyApplier
            key={id}
            ruleId={id}
            def={REGISTRY[id]}
            onApplyPrice={(value) => s.setSelectionOverride(selection.key, { unitPriceOverride: value })}
            onApplyNote={(text) => {
              const prev = selection.customNote || '';
              const next = prev ? `${prev}\n${text}` : text;
              s.setSelectionOverride(selection.key, { customNote: next });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PolicyApplier({ ruleId, def, onApplyPrice, onApplyNote }: {
  ruleId: string;
  def: PolicyDef;
  onApplyPrice: (v: number) => void;
  onApplyNote: (text: string) => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const apply = () => {
    const result = def.compute(inputs);
    if (!result.ok || result.value == null) {
      setMsg({ kind: 'err', text: result.reason || '계산 실패' });
      return;
    }
    if (def.appliesToField === 'unitPriceOverride') {
      onApplyPrice(result.value);
      setMsg({ kind: 'ok', text: `단가에 ${result.value.toLocaleString()}원 적용됨` });
    } else {
      onApplyNote(`[${ruleId}] ${def.label_ko}: +${result.value.toLocaleString()}원`);
      setMsg({ kind: 'ok', text: `비고에 옵션 정보 추가됨 (+${result.value.toLocaleString()}원)` });
    }
  };

  return (
    <div className="flex items-start gap-2 p-1.5 rounded bg-white/70">
      <span className="pill bg-brand-100 text-brand-700 mt-0.5 text-[10px] font-mono">{ruleId}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-ink">{def.label_ko}</div>
        <div className="text-[10px] text-ink-subtle">{def.description_ko}</div>
        {def.inputs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {def.inputs.map(input => (
              <div key={input.key} className="flex items-center gap-1">
                <span className="text-[10px] text-ink-muted">{input.label_ko}:</span>
                {input.type === 'number' ? (
                  <input
                    type="number"
                    min={input.min ?? 0}
                    className="input w-20 px-1.5 py-0.5 text-[11px]"
                    placeholder={input.hint_ko}
                    value={inputs[input.key] ?? ''}
                    onChange={(e) => setInputs(prev => ({ ...prev, [input.key]: e.target.value }))}
                  />
                ) : (
                  <select
                    className="input px-1.5 py-0.5 text-[11px]"
                    value={inputs[input.key] ?? ''}
                    onChange={(e) => setInputs(prev => ({ ...prev, [input.key]: e.target.value }))}
                  >
                    <option value="">-- 선택 --</option>
                    {input.options?.map(o => <option key={o.value} value={o.value}>{o.label_ko}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
        {msg && (
          <div className={clsx('text-[10px] mt-0.5', msg.kind === 'ok' ? 'text-emerald-700' : 'text-red-600')}>
            {msg.text}
          </div>
        )}
      </div>
      <button onClick={apply} className="btn-primary text-[10px] px-2 py-1 self-center whitespace-nowrap">
        적용
      </button>
    </div>
  );
}

function FieldNum({ label, hint, value, onChange, placeholder, min }: {
  label: string; hint?: string; value: number | null | undefined;
  onChange: (v: number | null) => void; placeholder?: string; min?: number;
}) {
  const [local, setLocal] = useState<string>(value == null ? '' : String(value));
  useEffect(() => { setLocal(value == null ? '' : String(value)); }, [value]);
  return (
    <label className="block">
      <div className="text-[10px] font-semibold text-ink-muted mb-0.5">{label}</div>
      <input
        type="text"
        inputMode="numeric"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = parseNumInput(local);
          if (min != null && n != null && n < min) { setLocal(value == null ? '' : String(value)); return; }
          onChange(n);
        }}
        placeholder={placeholder}
        className="input w-full text-xs tabular-nums"
      />
      {hint && <div className="text-[10px] text-ink-subtle mt-0.5">{hint}</div>}
    </label>
  );
}

function FieldText({ label, hint, value, onChange, placeholder }: {
  label: string; hint?: string; value: string | null | undefined;
  onChange: (v: string | null) => void; placeholder?: string;
}) {
  const [local, setLocal] = useState<string>(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <label className="block">
      <div className="text-[10px] font-semibold text-ink-muted mb-0.5">{label}</div>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local.trim() === '' ? null : local)}
        placeholder={placeholder}
        className="input w-full text-xs"
      />
      {hint && <div className="text-[10px] text-ink-subtle mt-0.5">{hint}</div>}
    </label>
  );
}
