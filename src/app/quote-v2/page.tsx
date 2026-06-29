'use client';

import { useEffect, useState } from 'react';
import { FlaskConical, Loader2, Receipt, Ban, PlusCircle, AlertTriangle, FileText, ChevronLeft, ChevronRight, Check, Printer } from 'lucide-react';

const DURATIONS = [
  { key: 'SINGLE', label: '단회' }, { key: 'W4', label: '4주' }, { key: 'W13', label: '13주' },
  { key: 'W26', label: '26주' }, { key: 'W39', label: '39주' }, { key: 'W52', label: '52주' },
];
const ADDONS = [
  { key: 'drf', label: 'DRF(용량결정)' }, { key: 'recovery', label: '회복군' }, { key: 'tk', label: 'TK(독성동태)' },
  { key: 'genotox', label: '유전독성 3종' }, { key: 'safetyPharm', label: '안전성약리' },
];
const ROUTES = ['경구', '피하', '근육', '정맥', '경피', '복강', '도포', '점안'];
const COND_LABEL: Record<string, string> = {
  no_uv_absorption_280_480nm: '자외부(280~480nm) 흡수 없음 → 광독성 면제',
  catheter_oral_administration: '카테터 경구투여 (정맥 가격)',
  has_prior_4week_data: '비설치류 4주 반복 선행자료 보유',
  simultaneous_analysis_feasible: '동시분석 가능', foreign_suture: '외국 봉합사',
  non_daily_dosing: '매일 투여 아님', subacute: '아급성', subchronic: '아만성',
  non_absorbable: '비흡수성', absorbable: '흡수성',
};
const STEPS = [
  { n: 1, title: '프로젝트 정보', sub: '의뢰자·시험물질 정보를 입력하세요' },
  { n: 2, title: '모달리티 선택', sub: '시험 분류·제출처·투여경로를 고르세요' },
  { n: 3, title: '시험 구성', sub: '설계값으로 시험을 자동 구성합니다' },
  { n: 4, title: '조건·부형제', sub: '규칙 조건·부형제·추가옵션을 조정하세요' },
  { n: 5, title: '통화·할인·발행', sub: '최종 조건 설정 후 저장·출력합니다' },
];
const won = (n: number | null | undefined) => (n == null ? '—' : `₩${n.toLocaleString()}`);
type Meta = { categories: string[]; conditionKeys: string[]; addonOptions: { key: string; label: string; price: number }[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = any;

export default function QuoteV2Page() {
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [category, setCategory] = useState('의약품');
  const [standard, setStandard] = useState<'MFDS' | 'OECD'>('MFDS');
  const [route, setRoute] = useState('경구');
  const [durations, setDurations] = useState<Set<string>>(new Set(['SINGLE', 'W13']));
  const [species, setSpecies] = useState({ rodent: true, nonRodent: true });
  const [addons, setAddons] = useState<Record<string, boolean>>({ drf: true, recovery: true, tk: true, genotox: true });
  const [tk, setTk] = useState({ points: 8, sessions: 2, sampleOnly: false });
  const [comboCount, setComboCount] = useState(2);
  const [comboAnal, setComboAnal] = useState<'개별' | '동시'>('개별');
  const [excipient, setExcipient] = useState(1);
  const [submissionTarget, setSubmissionTarget] = useState('국내');
  const [vaccineGroups, setVaccineGroups] = useState(2);
  const [healthSubtype, setHealthSubtype] = useState('개별인정형');
  const [conds, setConds] = useState<Record<string, boolean>>({});
  const [reqAddons, setReqAddons] = useState<Record<string, boolean>>({});
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [discountRate, setDiscountRate] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(1400);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [composed, setComposed] = useState<{ id: string; testName: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  // 배터리형(체크리스트) 모달리티 — 제안 시험항목을 사용자가 직접 선택
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // 고객 정보 + 안건연동 + 저장
  const [cust, setCust] = useState({ company: '', name: '', email: '', projectName: '', substanceName: '' });
  const [dealId, setDealId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNo, setSavedNo] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const isCombo = category === '복합제';
  const isBattery = !['의약품', '복합제', '백신', '건강기능식품'].includes(category);

  useEffect(() => { fetch('/api/quote-v2').then(r => r.json()).then(setMeta); }, []);
  useEffect(() => { const d = new URLSearchParams(window.location.search).get('dealId'); if (d) setDealId(Number(d)); }, []);

  const buildPlan = () => ({
    durations: [...durations], species, addons,
    tk: { points: tk.points, sampleOnly: tk.sampleOnly, sessions: tk.sessions },
    componentCount: isCombo ? comboCount : undefined, comboAnalysis: isCombo ? comboAnal : undefined,
    excipientCount: excipient, submissionTarget,
    vaccineGroups: category === '백신' ? vaccineGroups : undefined,
    subtype: category === '건강기능식품' ? healthSubtype : undefined,
  });
  const toggleSet = (s: Set<string>, k: string) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; };
  const priceOf = (it: { priceA?: { MFDS: number | null; OECD: number | null }; priceB?: { MFDS: number | null; OECD: number | null } }) => it.priceA?.[standard] ?? it.priceB?.[standard] ?? null;
  const togglePick = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectPriced = () => setPicked(new Set(items.filter(priceOf).map(it => it.id)));

  // 배터리형 모달리티 선택 시 제안 시험항목 로드
  useEffect(() => {
    if (!isBattery) { setItems([]); setPicked(new Set()); return; }
    fetch('/api/quote-v2?category=' + encodeURIComponent(category)).then(r => r.json()).then(d => { setItems(d.items ?? []); setPicked(new Set()); });
  }, [category, isBattery]);

  const generate = async () => {
    setLoading(true); setSavedNo(null); setSavedId(null);
    try {
      const body = isBattery
        ? { category, standard, route, selectedItems: [...picked].map(id => ({ id })), customerConditions: conds, requestedAddons: reqAddons }
        : { category, standard, route, plan: buildPlan(), customerConditions: conds, requestedAddons: reqAddons, combinationCount: isCombo ? comboCount : undefined };
      const res = await fetch('/api/quote-v2', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      setQuote(d.quote ?? null);
      setComposed(d.composed?.length ? d.composed : (isBattery ? [...picked].map(id => ({ id, testName: null })) : []));
    } finally { setLoading(false); }
  };

  // 4단계 이후 조건·부형제·옵션 변경 시 자동 재구성 (이미 견적이 있을 때만)
  useEffect(() => {
    if (!quote) return;
    const t = setTimeout(() => { generate(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excipient, JSON.stringify(reqAddons), JSON.stringify(conds)]);

  const saveQuote = async (issueNow: boolean) => {
    setSaving(true); setSavedNo(null);
    try {
      const common = {
        category, standard, route, customerConditions: conds, requestedAddons: reqAddons,
        currency, discountRate, exchangeRate,
        projectName: cust.projectName, substanceName: cust.substanceName, customerName: cust.name, customerCompany: cust.company, customerEmail: cust.email, dealId, issueNow,
      };
      const body = isBattery
        ? { ...common, selectedItemIds: [...picked] }
        : { ...common, plan: buildPlan(), combinationCount: isCombo ? comboCount : undefined };
      const res = await fetch('/api/quote-v2/save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.quote?.quoteNumber) { setSavedNo(d.quote.quoteNumber); setSavedId(d.quote.id ?? null); }
    } finally { setSaving(false); }
  };

  const canNext = (): boolean => {
    if (step === 1) return cust.company.trim().length > 0;
    if (step === 2) return !!category;
    if (step === 3) return !!quote;
    if (step === 4) return !!quote;
    return false;
  };
  const showPreview = step >= 3 && !!quote;
  const meta1 = STEPS[step - 1];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FlaskConical className="w-6 h-6 text-brand-500" /> 새 견적 작성 <span className="pill bg-brand-100 text-brand-700">엔진 v2</span></h1>
          <p className="text-sm text-ink-muted mt-0.5">5단계로 견적을 구성하고 PDF로 출력합니다.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="card p-4">
        <div className="flex items-center">
          {STEPS.map((st, i) => {
            const done = step > st.n; const cur = step === st.n;
            return (
              <div key={st.n} className="flex items-center flex-1 last:flex-none">
                <button type="button" onClick={() => (st.n < step || canNext() || st.n <= step) && setStep(st.n)} className="flex items-center gap-2 group">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${done ? 'bg-brand-600 text-white' : cur ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-400' : 'bg-slate-100 text-ink-subtle'}`}>
                    {done ? <Check className="w-4 h-4" /> : st.n}
                  </span>
                  <span className={`text-xs font-medium hidden sm:block ${cur ? 'text-ink' : 'text-ink-subtle'}`}>{st.title}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${done ? 'bg-brand-400' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className={showPreview ? 'grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5' : 'max-w-2xl mx-auto'}>
        {/* LEFT — 현재 단계 */}
        <section className="card overflow-hidden self-start">
          <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-sm font-bold">{step}</span>
            <div><h2 className="font-semibold text-ink">{meta1.title}</h2><p className="text-xs text-ink-muted mt-0.5">{meta1.sub}</p></div>
          </header>

          <div className="p-5 space-y-3.5">
            {/* STEP 1 — 프로젝트 정보 */}
            {step === 1 && <>
              {dealId && <div className="pill bg-violet-100 text-violet-700 mb-1">안건 #{dealId} 연동</div>}
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="고객사 *"><input className="input" value={cust.company} onChange={e => setCust(c => ({ ...c, company: e.target.value }))} placeholder="㈜OOO" /></Field>
                <Field label="담당자"><input className="input" value={cust.name} onChange={e => setCust(c => ({ ...c, name: e.target.value }))} /></Field>
                <Field label="이메일"><input className="input" value={cust.email} onChange={e => setCust(c => ({ ...c, email: e.target.value }))} /></Field>
                <Field label="시험물질명"><input className="input" value={cust.substanceName} onChange={e => setCust(c => ({ ...c, substanceName: e.target.value }))} /></Field>
                <Field label="프로젝트명"><input className="input" value={cust.projectName} onChange={e => setCust(c => ({ ...c, projectName: e.target.value }))} placeholder="(비우면 고객사+모달리티)" /></Field>
              </div>
            </>}

            {/* STEP 2 — 모달리티 */}
            {step === 2 && <>
              <div className="grid grid-cols-3 gap-2">
                <Field label="모달리티"><select className="input" value={category} onChange={e => setCategory(e.target.value)}>{meta?.categories.map(c => <option key={c}>{c}</option>)}</select></Field>
                <Field label="제출처"><select className="input" value={standard} onChange={e => setStandard(e.target.value as 'MFDS' | 'OECD')}><option>MFDS</option><option>OECD</option></select></Field>
                <Field label="투여경로"><select className="input" value={route} onChange={e => setRoute(e.target.value)}>{ROUTES.map(r => <option key={r}>{r}</option>)}</select></Field>
              </div>
              {!isBattery && <div className="grid grid-cols-2 gap-2">
                <Field label="제출 대상 (안전성약리 hERG)"><select className="input" value={submissionTarget} onChange={e => setSubmissionTarget(e.target.value)}><option>국내</option><option>USFDA</option><option>EMA</option></select></Field>
                {category === '백신' && <Field label="군 구성"><div className="flex gap-1.5">{[2, 3, 4, 5].map(g => <Chip key={g} on={vaccineGroups === g} onClick={() => setVaccineGroups(g)}>{g}군</Chip>)}</div></Field>}
                {category === '건강기능식품' && <Field label="하위유형"><select className="input" value={healthSubtype} onChange={e => setHealthSubtype(e.target.value)}><option>개별인정형</option><option>프로바이오틱스</option><option>한시적식품</option></select></Field>}
              </div>}
              <p className="text-xs text-ink-subtle">{isBattery ? '배터리형 — 다음 단계에서 제안 시험항목을 직접 선택합니다.' : '파라메트릭 — 다음 단계에서 설계값으로 자동 구성합니다.'}</p>
            </>}

            {/* STEP 3 — 시험 구성 */}
            {step === 3 && <>
              {isBattery && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="label !mb-0">제안 시험항목 <span className="text-ink-subtle font-normal">({picked.size}/{items.length} 선택)</span></div>
                    <div className="flex gap-1.5 text-xs">
                      <button type="button" className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50" onClick={selectPriced}>가격 있는 항목 전체</button>
                      <button type="button" className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50" onClick={() => setPicked(new Set())}>전체 해제</button>
                    </div>
                  </div>
                  <div className="max-h-[20rem] overflow-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {Object.entries(items.reduce((g: Record<string, typeof items>, it) => { (g[it.testClass ?? '기타'] ??= []).push(it); return g; }, {})).map(([cls, its]) => (
                      <div key={cls} className="p-2">
                        <div className="text-[11px] font-semibold text-ink-subtle mb-1">{cls}</div>
                        {(its as typeof items).map(it => { const pr = priceOf(it); return (
                          <label key={it.id} className={`flex items-center gap-2 py-0.5 text-xs ${pr == null ? 'opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" disabled={pr == null} checked={picked.has(it.id)} onChange={() => togglePick(it.id)} className="rounded border-slate-300 text-brand-600" />
                            <span className="flex-1">{it.testName}</span>
                            <span className="tabular-nums text-ink-muted">{won(pr)}</span>
                          </label>
                        ); })}
                      </div>
                    ))}
                    {items.length === 0 && <div className="p-4 text-center text-xs text-ink-subtle">불러오는 중…</div>}
                  </div>
                </div>
              )}

              {!isCombo && !isBattery && <>
                <Field label="본시험 기간 (복수)"><div className="flex flex-wrap gap-1.5">{DURATIONS.map(d => <Chip key={d.key} on={durations.has(d.key)} onClick={() => setDurations(s => toggleSet(s, d.key))}>{d.label}</Chip>)}</div></Field>
                <Field label="종"><div className="flex gap-1.5">
                  <Chip on={species.rodent} onClick={() => setSpecies(s => ({ ...s, rodent: !s.rodent }))}>설치류</Chip>
                  <Chip on={species.nonRodent} onClick={() => setSpecies(s => ({ ...s, nonRodent: !s.nonRodent }))}>비설치류</Chip>
                </div></Field>
                <Field label="부가 시험"><div className="flex flex-wrap gap-1.5">{ADDONS.map(a => <Chip key={a.key} on={!!addons[a.key]} onClick={() => setAddons(p => ({ ...p, [a.key]: !p[a.key] }))}>{a.label}</Chip>)}</div></Field>
                {addons.tk && (
                  <Field label="TK 사양"><div className="flex flex-wrap gap-2 items-center text-xs">
                    <span>채혈 포인트</span>{[6, 8].map(p => <Chip key={p} on={tk.points === p} onClick={() => setTk(t => ({ ...t, points: p }))}>{p}pt</Chip>)}
                    <span className="ml-2">회차</span>{[2, 3].map(s => <Chip key={s} on={tk.sessions === s} onClick={() => setTk(t => ({ ...t, sessions: s }))}>{s}회</Chip>)}
                    <Chip on={tk.sampleOnly} onClick={() => setTk(t => ({ ...t, sampleOnly: !t.sampleOnly }))}>채혈만</Chip>
                  </div></Field>
                )}
              </>}

              {isCombo && <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="종수"><div className="flex gap-1.5">{[2, 3, 4].map(n => <Chip key={n} on={comboCount === n} onClick={() => setComboCount(n)}>{n}종</Chip>)}</div></Field>
                  <Field label="분석방식"><div className="flex gap-1.5">{(['개별', '동시'] as const).map(a => <Chip key={a} on={comboAnal === a} onClick={() => setComboAnal(a)}>{a}</Chip>)}</div></Field>
                </div>
                <Field label="TK (독성동태)"><div className="flex flex-wrap gap-2 items-center text-xs">
                  <Chip on={!!addons.tk} onClick={() => setAddons(p => ({ ...p, tk: !p.tk }))}>TK 포함</Chip>
                  {addons.tk && <>
                    <span className="ml-1">포인트</span>{[6, 8].map(p => <Chip key={p} on={tk.points === p} onClick={() => setTk(t => ({ ...t, points: p }))}>{p}pt</Chip>)}
                    <Chip on={tk.sampleOnly} onClick={() => setTk(t => ({ ...t, sampleOnly: !t.sampleOnly }))}>채혈만</Chip>
                    <span className="text-ink-muted">{tk.sampleOnly ? '(채혈만)' : '(채혈+분석)'}</span>
                  </>}
                </div></Field>
              </>}

              {meta && meta.conditionKeys.length > 0 && (
                <Field label="고객 조건 (규칙 트리거)"><div className="grid grid-cols-1 gap-1">
                  {meta.conditionKeys.map(k => (
                    <label key={k} className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                      <input type="checkbox" checked={!!conds[k]} onChange={e => setConds(p => ({ ...p, [k]: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
                      {COND_LABEL[k] ?? k}
                    </label>
                  ))}
                </div></Field>
              )}

              <button onClick={generate} disabled={loading || (isBattery && picked.size === 0)} className="btn-primary w-full justify-center">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} 견적 자동 구성
              </button>
            </>}

            {/* STEP 4 — 조건·부형제 */}
            {step === 4 && <>
              {!isBattery && (
                <Field label="부형제(비히클) 종수 — 함량·조제물분석 곱"><div className="flex gap-1.5">{[1, 2, 3].map(n => <Chip key={n} on={excipient === n} onClick={() => setExcipient(n)}>{n}종</Chip>)}</div></Field>
              )}
              {meta && meta.addonOptions.length > 0 && (
                <Field label="추가 옵션 채택"><div className="grid grid-cols-1 gap-1">
                  {meta.addonOptions.map(a => (
                    <label key={a.key} className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                      <input type="checkbox" checked={!!reqAddons[a.key]} onChange={e => setReqAddons(p => ({ ...p, [a.key]: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
                      {a.label} <span className="text-ink-subtle">(+{won(a.price)})</span>
                    </label>
                  ))}
                </div></Field>
              )}
              <p className="text-xs text-ink-subtle">변경하면 오른쪽 견적이 자동 갱신됩니다.</p>
            </>}

            {/* STEP 5 — 통화·할인·발행 */}
            {step === 5 && <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="통화"><div className="flex gap-1.5">{(['KRW', 'USD'] as const).map(c => <Chip key={c} on={currency === c} onClick={() => setCurrency(c)}>{c}</Chip>)}</div></Field>
                {currency === 'USD' && <Field label="환율 (₩/$)"><input type="number" className="input" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} /></Field>}
              </div>
              <Field label={`할인율 — ${(discountRate * 100).toFixed(0)}%`}>
                <input type="range" min={0} max={0.3} step={0.01} value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} className="w-full accent-brand-600" />
              </Field>
              {quote && <TotalsBox subtotal={quote.totals.subtotalKrw} discountRate={discountRate} currency={currency} exchangeRate={exchangeRate} />}
              <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                {savedNo && <span className="text-sm text-emerald-600 font-medium">저장됨 · {savedNo}</span>}
                {savedId && <a href={`/quote/print?id=${savedId}`} target="_blank" rel="noreferrer" className="btn-ghost"><Printer className="w-4 h-4" /> PDF 출력</a>}
                <button onClick={() => saveQuote(false)} disabled={saving} className="btn-outline">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 임시저장</button>
                <button onClick={() => saveQuote(true)} disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} 발행</button>
              </div>
            </>}
          </div>

          <footer className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="btn-outline"><ChevronLeft className="w-4 h-4" /> 이전</button>
            <span className="text-[11px] text-ink-subtle font-medium tabular-nums">{step} / {STEPS.length}</span>
            {step < STEPS.length
              ? <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="btn-primary">다음 <ChevronRight className="w-4 h-4" /></button>
              : <span className="w-16" />}
          </footer>
        </section>

        {/* RIGHT — LivePreview (3단계 자동구성 이후) */}
        {showPreview && (
          <div className="lg:sticky lg:top-4 self-start">
            <QuoteResult quote={quote} composedCount={composed.length} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${on ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300' : 'bg-slate-100 text-ink-muted hover:bg-slate-200'}`}>{children}</button>;
}

function TotalsBox({ subtotal, discountRate, currency, exchangeRate }: { subtotal: number; discountRate: number; currency: 'KRW' | 'USD'; exchangeRate: number }) {
  const conv = (n: number) => currency === 'USD' ? n / exchangeRate : n;
  const sym = currency === 'USD' ? '$' : '₩';
  const f = (n: number) => `${sym}${conv(n).toLocaleString(undefined, { maximumFractionDigits: currency === 'USD' ? 2 : 0 })}`;
  const afterDiscount = subtotal * (1 - discountRate);
  const vat = afterDiscount * 0.1;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm space-y-1">
      <Row label="소계" value={f(subtotal)} />
      {discountRate > 0 && <Row label={`할인 (${(discountRate * 100).toFixed(0)}%)`} value={`- ${f(subtotal * discountRate)}`} />}
      <Row label="할인 후" value={f(afterDiscount)} />
      <Row label="VAT (10% 별도)" value={f(vat)} muted />
      <div className="border-t border-slate-200 pt-1 flex justify-between items-center"><span className="font-semibold">총 합계</span><span className="text-xl font-bold tabular-nums">{f(afterDiscount + vat)}</span></div>
    </div>
  );
}
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className={`flex justify-between ${muted ? 'text-ink-subtle text-xs' : 'text-ink-muted'}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}

function QuoteResult({ quote, composedCount }: { quote: Quote; composedCount: number }) {
  return (
    <section className="card p-5 space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold flex items-center gap-2"><Receipt className="w-5 h-5 text-brand-500" /> 견적 미리보기 <span className="text-xs font-normal text-ink-subtle">자동구성 {composedCount}건</span></h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
            <th className="py-1.5 pr-2">시험명</th><th className="py-1.5 px-2 w-14">경로</th><th className="py-1.5 px-2 w-28 text-right">단가</th><th className="py-1.5 px-2">적용 규칙/비고</th>
          </tr></thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {quote.lineItems.map((li: any, i: number) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-1.5 pr-2 text-ink">{li.testName}{li.isPrereq && <span className="pill bg-violet-100 text-violet-700 ml-1">선행</span>}</td>
                <td className="py-1.5 px-2 text-ink-muted">{li.route}</td>
                <td className="py-1.5 px-2 text-right tabular-nums font-medium">{won(li.unitPrice)}</td>
                <td className="py-1.5 px-2 text-[11px] text-ink-subtle">{[...li.appliedRules, ...li.notes].join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      {quote.waivedItems.length > 0 && <Note icon={<Ban className="w-4 h-4 text-red-500" />} title={`면제 (${quote.waivedItems.length})`}>{quote.waivedItems.map((w: any, i: number) => <div key={i}>• {w.testName} <span className="text-[11px] text-ink-subtle">— {w.reason}</span></div>)}</Note>}
      {quote.addons.length > 0 && <Note icon={<PlusCircle className="w-4 h-4 text-emerald-500" />} title={`추가 옵션 (${quote.addons.length})`}>{quote.addons.map((a: any, i: number) => <div key={i} className="flex justify-between"><span>{a.name}</span><span className="tabular-nums">+{won(a.price)}</span></div>)}</Note>}
      {quote.documentRequirements.length > 0 && <Note icon={<FileText className="w-4 h-4 text-sky-500" />} title="자료 요구">{quote.documentRequirements.map((d: any, i: number) => <div key={i}>• {d.document}{d.mandatory && <span className="text-red-500 ml-1">*</span>}</div>)}</Note>}
      {quote.missingInfo.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="text-sm font-semibold text-amber-900 flex items-center gap-1.5 mb-1"><AlertTriangle className="w-4 h-4" /> 확인 필요 ({quote.missingInfo.length})</div>
          {quote.missingInfo.map((m: any, i: number) => <div key={i} className="text-xs text-amber-800">• {m.message}</div>)}
        </div>
      )}
      {/* eslint-enable @typescript-eslint/no-explicit-any */}

      <div className="border-t border-slate-200 pt-3 flex items-end justify-between flex-wrap gap-2">
        <div className="text-xs text-ink-subtle space-y-0.5">{quote.metaNotes.map((n: string, i: number) => <div key={i}>{n}</div>)}</div>
        <div className="text-right">
          <div className="text-xs text-ink-subtle">시험 {won(quote.totals.lineItemsKrw)} + 옵션 {won(quote.totals.addonsKrw)}</div>
          <div className="text-2xl font-bold text-ink tabular-nums">{won(quote.totals.subtotalKrw)} <span className="text-xs font-normal text-ink-subtle">(VAT 별도)</span></div>
        </div>
      </div>
    </section>
  );
}
function Note({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div><div className="text-sm font-bold text-ink flex items-center gap-1.5 mb-1">{icon} {title}</div><div className="text-sm text-ink-muted space-y-0.5">{children}</div></div>;
}
