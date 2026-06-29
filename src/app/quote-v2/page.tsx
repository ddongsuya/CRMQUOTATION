'use client';

import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Loader2, Receipt, Ban, PlusCircle, ListChecks, AlertTriangle, FileText } from 'lucide-react';

const ROUTES = ['경구', '피하', '근육', '정맥', '경피', '복강', '도포', '점안'];
const COND_LABEL: Record<string, string> = {
  no_uv_absorption_280_480nm: '자외부(280~480nm) 흡수 없음 → 광독성 면제',
  catheter_oral_administration: '카테터 경구투여 (정맥 가격)',
  has_prior_4week_data: '비설치류 4주 반복 선행자료 보유',
  simultaneous_analysis_feasible: '동시분석 가능',
  foreign_suture: '외국 봉합사',
  non_daily_dosing: '매일 투여 아님',
  subacute: '아급성', subchronic: '아만성', non_absorbable: '비흡수성', absorbable: '흡수성',
};

type Item = { id: string; testName: string; testClass: string; species: string | null; componentCount: string | null; analysisMethod: string | null; priceA: { MFDS: number | null; OECD: number | null }; priceB: { MFDS: number | null; OECD: number | null } };
type Meta = { categories: string[]; conditionKeys: string[]; addonOptions: { key: string; label: string; price: number }[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = any;

const won = (n: number | null | undefined) => (n == null ? '—' : `₩${n.toLocaleString()}`);

export default function QuoteV2Page() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [category, setCategory] = useState('의약품');
  const [standard, setStandard] = useState<'MFDS' | 'OECD'>('MFDS');
  const [route, setRoute] = useState('경구');
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [conds, setConds] = useState<Record<string, boolean>>({});
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch('/api/quote-v2').then(r => r.json()).then(setMeta); }, []);
  useEffect(() => {
    setItems([]); setPicked(new Set()); setQuote(null);
    fetch(`/api/quote-v2?category=${encodeURIComponent(category)}`).then(r => r.json()).then(d => setItems(d.items ?? []));
  }, [category]);

  const filtered = useMemo(() => items.filter(it => !q.trim() || (it.testName ?? '').includes(q) || (it.testClass ?? '').includes(q)), [items, q]);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const evaluate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quote-v2', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, standard, route, selectedItems: [...picked].map(id => ({ id })), customerConditions: conds, requestedAddons: addons }),
      });
      setQuote((await res.json()).quote);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FlaskConical className="w-6 h-6 text-brand-500" /> 견적 엔진 v2 <span className="pill bg-amber-100 text-amber-800">실험</span></h1>
        <p className="text-sm text-ink-muted mt-0.5">보강완료 마스터(426) + 규칙(33룰) 기반. 모달리티·시험·조건을 골라 견적을 생성합니다.</p>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        {/* ─ 입력 ─ */}
        <div className="space-y-4">
          <section className="card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="label">모달리티</span>
                <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  {meta?.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block"><span className="label">제출처 기준</span>
                <select className="input" value={standard} onChange={e => setStandard(e.target.value as 'MFDS' | 'OECD')}>
                  <option value="MFDS">MFDS</option><option value="OECD">OECD</option>
                </select>
              </label>
            </div>
            <label className="block"><span className="label">투여경로</span>
              <select className="input" value={route} onChange={e => setRoute(e.target.value)}>{ROUTES.map(r => <option key={r}>{r}</option>)}</select>
            </label>
          </section>

          {meta && meta.conditionKeys.length > 0 && (
            <section className="card p-4">
              <div className="label mb-2">고객 조건 (규칙 트리거)</div>
              <div className="space-y-1.5">
                {meta.conditionKeys.map(k => (
                  <label key={k} className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                    <input type="checkbox" checked={!!conds[k]} onChange={e => setConds(p => ({ ...p, [k]: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
                    {COND_LABEL[k] ?? k}
                  </label>
                ))}
              </div>
              {meta.addonOptions.length > 0 && <>
                <div className="label mt-3 mb-2">추가 옵션 채택</div>
                <div className="space-y-1.5">
                  {meta.addonOptions.map(a => (
                    <label key={a.key} className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                      <input type="checkbox" checked={!!addons[a.key]} onChange={e => setAddons(p => ({ ...p, [a.key]: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
                      {a.label} <span className="text-ink-subtle">(+{won(a.price)})</span>
                    </label>
                  ))}
                </div>
              </>}
            </section>
          )}

          <button onClick={evaluate} disabled={loading || picked.size === 0} className="btn-primary w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} 견적 생성 ({picked.size})
          </button>
        </div>

        {/* ─ 시험 선택 ─ */}
        <section className="card p-4 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="label flex items-center gap-1.5 !mb-0"><ListChecks className="w-3.5 h-3.5" /> 시험 선택 — {category} ({items.length})</div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="시험명·분류 검색" className="input !w-48 text-xs py-1.5" />
          </div>
          <div className="max-h-[300px] overflow-auto divide-y divide-slate-100">
            {filtered.map(it => {
              const price = (route.match(/정맥|경피|복강/) ? it.priceB[standard] ?? it.priceA[standard] : it.priceA[standard]) ?? it.priceA.MFDS;
              return (
                <label key={it.id} className="flex items-center gap-2 py-1.5 hover:bg-slate-50/60 px-1 cursor-pointer">
                  <input type="checkbox" checked={picked.has(it.id)} onChange={() => toggle(setPicked, it.id)} className="rounded border-slate-300 text-brand-600" />
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{it.testName}
                    {it.componentCount && <span className="text-ink-subtle text-xs ml-1">{it.componentCount}/{it.analysisMethod}</span>}
                    <span className="text-ink-subtle text-[10px] ml-1.5">{it.testClass}</span>
                  </span>
                  <span className="text-xs tabular-nums text-ink-muted whitespace-nowrap">{won(price)}</span>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      {/* ─ 결과 ─ */}
      {quote && <QuoteResult quote={quote} />}
    </div>
  );
}

function QuoteResult({ quote }: { quote: Quote }) {
  return (
    <section className="card p-5 space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold flex items-center gap-2"><Receipt className="w-5 h-5 text-brand-500" /> 견적 결과</h2>

      <Block icon={<FileText className="w-4 h-4" />} title={`시험 항목 (${quote.lineItems.length + quote.prerequisitesAdded.length})`}>
        <table className="w-full text-sm min-w-[520px]">
          <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
            <th className="py-1.5 pr-2">시험명</th><th className="py-1.5 px-2 w-16">경로</th><th className="py-1.5 px-2 w-28 text-right">단가</th><th className="py-1.5 px-2">적용 규칙/비고</th>
          </tr></thead>
          <tbody>
            {[...quote.lineItems, ...quote.prerequisitesAdded].map((li: any, i: number) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-1.5 pr-2 text-ink">{li.testName}{quote.prerequisitesAdded.includes(li) && <span className="pill bg-violet-100 text-violet-700 ml-1">선행</span>}</td>
                <td className="py-1.5 px-2 text-ink-muted">{li.route}</td>
                <td className="py-1.5 px-2 text-right tabular-nums font-medium">{won(li.unitPrice)}</td>
                <td className="py-1.5 px-2 text-[11px] text-ink-subtle">{[...li.appliedRules, ...li.notes].join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      {quote.waivedItems.length > 0 && (
        <Block icon={<Ban className="w-4 h-4 text-red-500" />} title={`면제 (${quote.waivedItems.length})`}>
          {quote.waivedItems.map((w: any, i: number) => <div key={i} className="text-sm text-ink-muted">• {w.testName} <span className="text-[11px] text-ink-subtle">— {w.ruleId}: {w.reason}</span></div>)}
        </Block>
      )}
      {quote.addons.length > 0 && (
        <Block icon={<PlusCircle className="w-4 h-4 text-emerald-500" />} title={`추가 옵션 (${quote.addons.length})`}>
          {quote.addons.map((a: any, i: number) => <div key={i} className="text-sm flex justify-between"><span>{a.name} <span className="text-[11px] text-ink-subtle">{a.ruleId}</span></span><span className="tabular-nums font-medium">+{won(a.price)}</span></div>)}
        </Block>
      )}
      {quote.documentRequirements.length > 0 && (
        <Block icon={<FileText className="w-4 h-4 text-sky-500" />} title="자료 요구">
          {quote.documentRequirements.map((d: any, i: number) => <div key={i} className="text-sm text-ink-muted">• {d.document}{d.mandatory && <span className="text-red-500 ml-1">*</span>}</div>)}
        </Block>
      )}
      {quote.missingInfo.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="text-sm font-semibold text-amber-900 flex items-center gap-1.5 mb-1"><AlertTriangle className="w-4 h-4" /> 확인 필요 ({quote.missingInfo.length})</div>
          {quote.missingInfo.map((m: any, i: number) => <div key={i} className="text-xs text-amber-800">• {m.message}</div>)}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
        <div className="text-xs text-ink-subtle space-y-0.5">{quote.metaNotes.map((n: string, i: number) => <div key={i}>{n}</div>)}</div>
        <div className="text-right">
          <div className="text-xs text-ink-subtle">시험 {won(quote.totals.lineItemsKrw)} + 옵션 {won(quote.totals.addonsKrw)}</div>
          <div className="text-2xl font-bold text-ink tabular-nums">{won(quote.totals.subtotalKrw)} <span className="text-xs font-normal text-ink-subtle">(VAT 별도)</span></div>
        </div>
      </div>
    </section>
  );
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-bold text-ink flex items-center gap-1.5 mb-1.5">{icon} {title}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
