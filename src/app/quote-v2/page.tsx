'use client';

import { useEffect, useState } from 'react';
import { Loader2, Receipt, Ban, PlusCircle, AlertTriangle, FileText, ChevronLeft, ChevronRight, Check, Printer } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import CustomerFields, { EMPTY_CUSTOMER, type CustomerInfo } from '@/components/quote/CustomerFields';

const DURATIONS = [
  { key: 'SINGLE', label: '단회' }, { key: 'W4', label: '4주' }, { key: 'W13', label: '13주' },
  { key: 'W26', label: '26주' }, { key: 'W39', label: '39주' }, { key: 'W52', label: '52주' },
];
const ADDONS = [
  { key: 'drf', label: 'DRF(용량결정)' }, { key: 'recovery', label: '회복군' }, { key: 'tk', label: 'TK(독성동태)' },
  { key: 'genotox', label: '유전독성 3종' }, { key: 'safetyPharm', label: '안전성약리' },
];
const ROUTES = ['경구', '피하', '근육', '정맥', '경피', '복강', '도포', '점안'];
// 모달리티 분류 그룹 (시안 step2: 1.분류 → 2.모달리티). 앱 카테고리를 도메인별 5그룹으로 묶음.
const CAT_GROUPS: { key: string; cats: string[] }[] = [
  { key: '의약품 독성', cats: ['의약품', '복합제'] },
  { key: '생물·첨단바이오', cats: ['백신', '세포치료제'] },
  { key: '비의약품·식품', cats: ['의료기기', '화장품', '건강기능식품'] },
  { key: '스크리닝·분석', cats: ['스크리닝', '심혈관계스크리닝', 'PK·분포', 'in vitro metabolism', '점안제'] },
  { key: '준비 중', cats: ['화학물질·환경', 'SEND·CTD·번역'] },
];
// 모달리티별 규제 근거·필수 구성 (시안 step3 가이드 박스)
const GUIDELINE_BASIS: Record<string, { basis: string; required: string }> = {
  의약품: { basis: 'ICH M3(R2) · S7A/B · S2(R1) · S3A', required: '단회+반복투여독성, 유전독성 3종, 안전성약리, TK' },
  복합제: { basis: 'ICH M3(R2) · 복합제 가이드', required: '성분별/복합 반복투여독성, 유전독성, 상호작용' },
  백신: { basis: 'WHO TRS · ICH S8', required: '반복투여독성(군구성), 국소내약성, 면역원성' },
  세포치료제: { basis: 'MFDS 세포치료제 · ICH S6(R1)', required: '종양원성, 생체분포, 반복투여독성' },
  건강기능식품: { basis: 'MFDS 기능성 원료 · OECD TG', required: '단회·반복투여독성, 유전독성 3종' },
};
const GUIDELINE_DEFAULT = { basis: '해당 모달리티 규제 가이드라인', required: '필수 시험 자동 구성' };
const COND_LABEL: Record<string, string> = {
  no_uv_absorption_280_480nm: '자외부(280~480nm) 흡수 없음 → 광독성 면제',
  catheter_oral_administration: '카테터 경구투여 (정맥 가격)',
  has_prior_4week_data: '비설치류 4주 반복 선행자료 보유',
  simultaneous_analysis_feasible: '동시분석 가능', foreign_suture: '외국 봉합사',
  non_daily_dosing: '매일 투여 아님', subacute: '아급성', subchronic: '아만성',
  non_absorbable: '비흡수성', absorbable: '흡수성',
};
const STEPS = [
  { n: 1, label: '프로젝트', title: '프로젝트 정보', sub: '견적 기본 정보를 입력하세요. 고객사는 CRM과 연결됩니다.' },
  { n: 2, label: '모달리티', title: '모달리티 선택', sub: '마스터데이터 기반. 모달리티별 시험 구성·단가가 다릅니다.' },
  { n: 3, label: '임상 계획', title: '임상 계획', sub: '경로·기간을 정하고 자동 구성하세요.' },
  { n: 4, label: '항목·부형제', title: '시험 항목 · 부형제', sub: '엔진이 자동 구성한 항목입니다. 조건·부형제를 조정하세요.' },
  { n: 5, label: '통화·할인', title: '가격 기준 · 통화 · 할인', sub: '최종 조건을 설정하면 우측 견적이 즉시 갱신됩니다.' },
];
const won = (n: number | null | undefined) => (n == null ? '—' : `₩${n.toLocaleString()}`);
type Meta = { categories: string[]; conditionKeys: string[]; addonOptions: { key: string; label: string; price: number }[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = any;

export default function QuoteV2Page() {
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [category, setCategory] = useState('의약품');
  const [catGroup, setCatGroup] = useState<string | null>(null);  // step2: 선택된 분류 그룹 (null=분류 선택 단계)
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
  const [cust, setCust] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [dealId, setDealId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNo, setSavedNo] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  // step4 수량·삭제 조정 (라인 id 기준)
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [companyNames, setCompanyNames] = useState<string[]>([]);  // 고객사 자동완성(CRM)
  useEffect(() => { fetch('/api/crm/companies').then(r => r.json()).then(d => setCompanyNames((d.companies ?? []).map((c: { name: string }) => c.name))).catch(() => {}); }, []);

  const isCombo = category === '복합제';
  const isBattery = !['의약품', '복합제', '백신', '건강기능식품'].includes(category);

  useEffect(() => { fetch('/api/quote-v2').then(r => r.json()).then((m: Meta) => { setMeta(m); const c = new URLSearchParams(window.location.search).get('category'); if (c && m.categories?.includes(c)) setCategory(c); }); }, []);
  useEffect(() => { const d = new URLSearchParams(window.location.search).get('dealId'); if (d) setDealId(Number(d)); }, []);
  // 고객 컨텍스트 프리필 — /customers·고객 상세에서 "이 고객으로 견적"
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const co = sp.get('company'); const nm = sp.get('customerName');
    if (co || nm) setCust(c => ({ ...c, company: co ?? c.company, name: nm ?? c.name }));
  }, []);

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
      const edits = { quantityOverrides: qtyOverrides, removedIds };
      const body = isBattery
        ? { category, standard, route, selectedItems: [...picked].map(id => ({ id })), customerConditions: conds, requestedAddons: reqAddons, ...edits }
        : { category, standard, route, plan: buildPlan(), customerConditions: conds, requestedAddons: reqAddons, combinationCount: isCombo ? comboCount : undefined, ...edits };
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
  }, [excipient, JSON.stringify(reqAddons), JSON.stringify(conds), JSON.stringify(qtyOverrides), JSON.stringify(removedIds)]);

  const saveQuote = async (issueNow: boolean) => {
    setSaving(true); setSavedNo(null);
    try {
      const common = {
        category, standard, route, customerConditions: conds, requestedAddons: reqAddons,
        currency, discountRate, exchangeRate, quantityOverrides: qtyOverrides, removedIds,
        projectName: cust.projectName, substanceName: cust.substanceName, customerName: cust.name, customerCompany: cust.company, customerEmail: cust.email, customerPhone: cust.phone, indication: cust.indication, dealId, issueNow,
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
      return d.quote?.id ?? null;
    } finally { setSaving(false); }
  };

  // 견적 완성 — 발행 저장 후 견적서(표지·견적명세·항목별 상세)로 이동
  const completeQuote = async () => {
    const id = await saveQuote(true);
    if (id) window.location.href = `/quote/print?id=${id}`;
    else toast.error('견적 저장에 실패했습니다. 다시 시도해 주세요.');
  };

  const canNext = (): boolean => {
    if (step === 1) return cust.company.trim().length > 0;
    if (step === 2) return !!category;
    if (step === 3) return !!quote;
    if (step === 4) return !!quote;
    return false;
  };
  const meta1 = STEPS[step - 1];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stepper — 원형(활성/완료 오렌지, ✓) + 라벨 아래 + 연결선 */}
      <div className="card px-4 sm:px-6 py-5">
        <div className="flex items-start">
          {STEPS.map((st, i) => {
            const done = step > st.n; const cur = step === st.n; const on = done || cur;
            return (
              <div key={st.n} className="flex items-start flex-1 last:flex-none">
                <button type="button" onClick={() => (st.n <= step || canNext()) && setStep(st.n)} className="flex flex-col items-center gap-2 flex-shrink-0 w-[60px] sm:w-auto">
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-colors ${on ? 'bg-brand-600 text-white' : 'bg-white border border-slate-300 text-ink-subtle'}`}>
                    {done ? <Check className="w-4 h-4" /> : st.n}
                  </span>
                  <span className={`text-[11px] sm:text-[13px] font-medium text-center leading-tight break-keep ${cur ? 'text-brand-600 font-semibold' : done ? 'text-brand-600' : 'text-ink-subtle'}`}>{st.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mt-[17px] mx-1 rounded-full ${done ? 'bg-brand-600' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5">
        {/* LEFT — 현재 단계 */}
        <section className="card overflow-hidden self-start">
          <header className="px-[22px] pt-[22px] pb-4">
            <h2 className="text-[22px] font-bold text-ink tracking-tight">{meta1.title}{step === 3 ? ` — ${category}` : ''}</h2>
            <p className="text-[13px] text-ink-muted mt-1">{meta1.sub}</p>
          </header>

          <div className="px-[22px] pb-[22px] space-y-3.5">
            {/* STEP 1 — 프로젝트 정보 (시안: 프로젝트명 → 고객사·물질명 → 적응증·제출처) */}
            {step === 1 && (
              <CustomerFields
                value={cust} onChange={(u) => setCust(c => ({ ...c, ...u }))}
                companyNames={companyNames} dealId={dealId}
                extra={
                  <label className="block">
                    <span className="label">제출처</span>
                    <select className="input" value={submissionTarget} onChange={e => setSubmissionTarget(e.target.value)}>
                      <option value="국내">한국 (MFDS)</option>
                      <option value="USFDA">미국 (USFDA)</option>
                      <option value="EMA">유럽 (EMA)</option>
                    </select>
                  </label>
                }
              />
            )}

            {/* STEP 2 — 모달리티: 1.분류 → 2.모달리티 (2단계) */}
            {step === 2 && (() => {
              const avail = (cats: string[]) => cats.filter(c => meta?.categories.includes(c));
              const groups = CAT_GROUPS.map(g => ({ ...g, list: avail(g.cats) })).filter(g => g.list.length > 0);
              return <>
                {/* 브레드크럼 1.분류 › 2.모달리티 */}
                <div className="flex items-center gap-2 text-[12px] font-medium">
                  <span className={`px-2 py-0.5 rounded-md ${!catGroup ? 'bg-slate-100 text-ink' : 'text-ink-subtle'}`}>1. 분류</span>
                  <Icon name="chevron-right" className="w-3 h-3 text-ink-subtle" />
                  <span className={`px-2 py-0.5 rounded-md ${catGroup ? 'bg-slate-100 text-ink' : 'text-ink-subtle'}`}>2. 모달리티</span>
                </div>

                {!catGroup ? (
                  /* 1단계: 분류 그룹 카드 */
                  <div className="grid gap-2">
                    {groups.map(g => (
                      <button key={g.key} type="button" onClick={() => setCatGroup(g.key)} className="flex items-center justify-between gap-3 px-[18px] py-4 rounded-[12px] border border-slate-200 bg-white text-left hover:bg-slate-100 transition-colors">
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-ink">{g.key}</div>
                          <div className="text-[12px] text-ink-subtle mt-0.5">{g.list.length}개 · {g.list.join(' · ')}</div>
                        </div>
                        <Icon name="chevron-right" className="w-4 h-4 text-ink-subtle flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  /* 2단계: 그룹 내 모달리티 카드 */
                  <>
                    <button type="button" onClick={() => setCatGroup(null)} className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink"><Icon name="chevron-left" className="w-3.5 h-3.5" /> 분류 다시 선택 <span className="text-ink-subtle">(현재: {catGroup})</span></button>
                    <div className="grid gap-2">
                      {(groups.find(g => g.key === catGroup)?.list ?? []).map(c => {
                        const sel = category === c;
                        const battery = !['의약품', '복합제', '백신', '건강기능식품'].includes(c);
                        return (
                          <button key={c} type="button" onClick={() => setCategory(c)} className={`flex items-center justify-between gap-3 px-[18px] py-4 rounded-[12px] border-2 text-left transition-colors ${sel ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-100'}`}>
                            <div className="min-w-0">
                              <div className="text-[15px] font-semibold text-ink">{c}</div>
                              <div className="text-[12px] text-ink-subtle mt-0.5">{battery ? '배터리형 — 제안 항목 직접 선택' : '파라메트릭 — 설계값 자동 구성'}</div>
                            </div>
                            {sel
                              ? <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 flex-shrink-0"><Icon name="check" className="w-4 h-4" /> 선택</span>
                              : <span className="text-[13px] text-ink-subtle flex-shrink-0">선택</span>}
                          </button>
                        );
                      })}
                    </div>
                    {category === '백신' && <Field label="군 구성"><div className="flex flex-wrap gap-1.5">{[2, 3, 4, 5].map(g => <Chip key={g} on={vaccineGroups === g} onClick={() => setVaccineGroups(g)}>{g}군</Chip>)}</div></Field>}
                    {category === '건강기능식품' && <Field label="하위유형"><select className="input" value={healthSubtype} onChange={e => setHealthSubtype(e.target.value)}><option>개별인정형</option><option>프로바이오틱스</option><option>한시적식품</option></select></Field>}
                  </>
                )}
              </>;
            })()}

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
                {/* 가이드라인 기준 구성 — 모달리티별 규제 근거·필수 구성 */}
                {(() => { const g = GUIDELINE_BASIS[category] ?? GUIDELINE_DEFAULT; return (
                  <div className="rounded-[12px] bg-brand-50 border border-brand-100 px-3.5 py-3">
                    <div className="text-[13px] font-semibold text-brand-800 flex items-center gap-1.5 mb-1.5"><Icon name="book" className="w-4 h-4" /> 가이드라인 기준 구성</div>
                    <div className="text-[12px] text-ink-muted leading-relaxed">
                      <div><b className="font-semibold text-ink">규제 근거</b> · {g.basis}</div>
                      <div className="mt-0.5"><b className="font-semibold text-ink">필수 구성</b> · {g.required}</div>
                    </div>
                  </div>
                ); })()}
                <Field label="투여 경로"><div className="flex flex-wrap gap-1.5">{ROUTES.map(r => <Chip key={r} on={route === r} onClick={() => setRoute(r)}>{r}</Chip>)}</div></Field>
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

            {/* STEP 4 — 항목·부형제: 구성 항목 + 조정 */}
            {step === 4 && <>
              <div className="flex items-center justify-end">
                <button type="button" onClick={() => setStep(3)} className="btn-ghost"><Icon name="chevron-left" className="w-3.5 h-3.5" /> 계획 다시 구성</button>
              </div>
              {/* 구성 항목 — testClass 그룹 + 수량 스텝퍼 + 삭제 */}
              {/* eslint-disable @typescript-eslint/no-explicit-any */}
              {quote && quote.lineItems?.length > 0 && (() => {
                const groups: Record<string, any[]> = {};
                quote.lineItems.forEach((li: any) => { const k = li.testClass || '기타'; (groups[k] ??= []).push(li); });
                return (
                  <div className="space-y-3.5">
                    {Object.entries(groups).map(([cls, lines]) => (
                      <div key={cls}>
                        <div className="text-[12px] font-semibold text-ink-subtle mb-1.5">{cls} <span className="font-normal text-ink-subtle">· {lines.length}건</span></div>
                        <div className="rounded-[12px] border border-slate-200 overflow-hidden">
                          {lines.map((li: any) => {
                            const q = qtyOverrides[li.id] ?? li.quantity;
                            return (
                              <div key={li.id} className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-[var(--hairline-soft)] first:border-t-0">
                                {!li.isPrereq
                                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex-shrink-0">필수</span>
                                  : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-ink-muted text-[10px] font-medium flex-shrink-0">선행</span>}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[14px] text-ink truncate">{li.testName}</div>
                                  <div className="text-[11px] text-ink-subtle truncate">{[li.route, ...li.notes].filter(Boolean).join(' · ')}</div>
                                </div>
                                <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
                                  <button type="button" onClick={() => setQtyOverrides(o => ({ ...o, [li.id]: Math.max(1, q - 1) }))} className="w-7 h-7 flex items-center justify-center text-ink-muted hover:bg-slate-100">−</button>
                                  <span className="w-7 text-center text-[13px] tabular-nums">{q}</span>
                                  <button type="button" onClick={() => setQtyOverrides(o => ({ ...o, [li.id]: q + 1 }))} className="w-7 h-7 flex items-center justify-center text-ink-muted hover:bg-slate-100">+</button>
                                </div>
                                <div className="text-[14px] font-medium text-ink tabular-nums whitespace-nowrap flex-shrink-0 w-24 text-right">{won(li.amount)}</div>
                                <button type="button" onClick={() => setRemovedIds(r => [...r, li.id])} className="w-6 h-6 flex items-center justify-center rounded text-ink-subtle hover:text-red-600 hover:bg-red-50 flex-shrink-0" title="삭제"><Icon name="x" className="w-3.5 h-3.5" /></button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {removedIds.length > 0 && <button type="button" onClick={() => setRemovedIds([])} className="text-[12px] text-brand-600 hover:underline">삭제한 {removedIds.length}건 복원</button>}
                  </div>
                );
              })()}
              {/* eslint-enable @typescript-eslint/no-explicit-any */}
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
              <p className="text-xs text-ink-subtle">부형제·옵션을 변경하면 우측 견적이 자동 갱신됩니다.</p>
            </>}

            {/* STEP 5 — 가격 기준·통화·할인 */}
            {step === 5 && <>
              <Field label="가격 기준">
                <div className="segmented inline-flex gap-[3px] p-[3px] rounded-lg bg-slate-100">
                  {([['MFDS', 'MFDS (국내)'], ['OECD', 'OECD (해외)']] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setStandard(k)} className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${standard === k ? 'bg-[var(--card)] text-brand-600' : 'text-ink-muted hover:text-ink'}`}>{l}</button>
                  ))}
                </div>
                <p className="text-xs text-ink-subtle mt-1.5">{standard === 'MFDS' ? '국내 식약처(MFDS) 제출 기준 단가' : '해외(OECD) 제출 기준 단가'}</p>
              </Field>
              <Field label="통화">
                <div className="segmented inline-flex gap-[3px] p-[3px] rounded-lg bg-slate-100">
                  {([['KRW', 'KRW ₩'], ['USD', 'USD $']] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setCurrency(k)} className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${currency === k ? 'bg-[var(--card)] text-brand-600' : 'text-ink-muted hover:text-ink'}`}>{l}</button>
                  ))}
                </div>
                <p className="text-xs text-ink-subtle mt-1.5">{currency === 'KRW' ? '원화 견적 · VAT 10% 별도 합산' : `달러 견적 · 환율 ₩${exchangeRate}/$`}</p>
                {currency === 'USD' && <input type="number" className="input mt-2" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} placeholder="환율 ₩/$" />}
              </Field>
              <Field label={`할인율 — ${(discountRate * 100).toFixed(0)}%`}>
                <input type="range" min={0} max={0.3} step={0.01} value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} className="w-full accent-brand-600" />
                <div className="flex justify-between text-[11px] text-ink-subtle mt-1"><span>0%</span><span>15%</span><span>30%</span></div>
              </Field>
              {savedNo && <div className="text-[13px] text-emerald-600 font-medium">임시 저장됨 · {savedNo}</div>}
            </>}
          </div>

          <footer className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="btn-outline"><ChevronLeft className="w-4 h-4" /> 이전</button>
            <span className="text-[11px] text-ink-subtle font-medium tabular-nums">{step} / {STEPS.length}</span>
            {step < STEPS.length
              ? <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="btn-primary">다음 <ChevronRight className="w-4 h-4" /></button>
              : <button onClick={completeQuote} disabled={saving || !quote} className="inline-flex items-center justify-center gap-2 h-10 px-[18px] rounded-full text-white font-semibold text-[14px] whitespace-nowrap transition-colors disabled:opacity-50" style={{ background: 'var(--success)' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />} 견적 완성 <ChevronRight className="w-4 h-4" />
                </button>}
          </footer>
        </section>

        {/* RIGHT — 실시간 견적 (항상 표시, 구성 전엔 placeholder) */}
        <div className="lg:sticky lg:top-4 self-start">
          <LivePanel
            quote={quote} composedCount={composed.length}
            projectName={cust.projectName || (cust.company ? `${cust.company} ${category}` : '(프로젝트명 미입력)')}
            company={cust.company} modality={category} standard={standard}
            discountRate={discountRate} currency={currency} exchangeRate={exchangeRate}
            selectedCount={isBattery ? picked.size : composed.length}
            onSaveDraft={() => saveQuote(false)} onComplete={completeQuote} saving={saving}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${on ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-ink-muted hover:bg-slate-100 hover:text-ink'}`}>{children}</button>;
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

// 우측 실시간 견적 패널 — 시안: 항상 표시. 구성 전엔 placeholder, 구성 후 라인·합계.
function LivePanel({ quote, composedCount, projectName, company, modality, standard, discountRate, currency, exchangeRate, selectedCount, onSaveDraft, onComplete, saving }: {
  quote: Quote | null; composedCount: number; projectName: string; company: string; modality: string; standard: 'MFDS' | 'OECD';
  discountRate: number; currency: 'KRW' | 'USD'; exchangeRate: number; selectedCount: number;
  onSaveDraft?: () => void; onComplete?: () => void; saving?: boolean;
}) {
  const conv = (n: number) => currency === 'USD' ? n / exchangeRate : n;
  const sym = currency === 'USD' ? '$' : '₩';
  const f = (n: number) => `${sym}${conv(n).toLocaleString(undefined, { maximumFractionDigits: currency === 'USD' ? 2 : 0 })}`;
  const subtotal = quote?.totals.subtotalKrw ?? 0;
  const discountAmt = subtotal * discountRate;
  const afterDiscount = subtotal - discountAmt;
  const vat = afterDiscount * 0.1;
  const grand = afterDiscount + vat;
  const lineCount = quote?.lineItems.length ?? 0;
  const autoCount = Math.max(0, lineCount - selectedCount);
  const dash = <span className="text-ink-subtle">—</span>;
  return (
    <section className="card p-5 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-1.5"><FileText className="w-4 h-4 text-ink-muted" /> 실시간 견적</h2>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted"><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />동기화</span>
      </div>
      {/* 프로젝트 헤더 */}
      <div className="pt-1">
        <div className="text-[15px] font-semibold text-ink truncate">{projectName}</div>
        <div className="text-[12px] text-ink-subtle truncate">{[company, modality].filter(Boolean).join(' · ') || '고객사·모달리티'}</div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="tag">작성중</span>
          <span className="tag">{standard}</span>
        </div>
      </div>

      {/* 라인아이템 or placeholder */}
      {!quote || lineCount === 0 ? (
        <div className="py-8 text-center text-[13px] text-ink-subtle border-t border-[var(--hairline-soft)]">3단계에서 자동 구성하세요</div>
      ) : (
        <div className="border-t border-[var(--hairline-soft)] max-h-[280px] overflow-auto">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {quote.lineItems.map((li: any, i: number) => {
            const meta = [li.route, ...li.appliedRules, ...li.notes].filter(Boolean).join(' · ');
            return (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-[var(--hairline-soft)]">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink">{li.testName}{li.isPrereq && <span className="tag ml-1.5">선행</span>}</div>
                  {meta && <div className="text-[11px] text-ink-subtle mt-0.5 break-keep">{meta}</div>}
                </div>
                <div className="text-[13px] font-medium text-ink tabular-nums whitespace-nowrap flex-shrink-0">{f(li.amount ?? 0)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 합계 — 소계/할인/VAT/합계 (시안) */}
      <div className="border-t border-[var(--hairline-soft)] pt-3 space-y-1.5">
        <div className="flex justify-between text-[13px] text-ink-muted"><span>소계 <span className="text-ink-subtle">({lineCount}건)</span></span><span className="tabular-nums">{quote ? f(subtotal) : dash}</span></div>
        <div className="flex justify-between text-[13px] text-ink-muted"><span>할인 {(discountRate * 100).toFixed(0)}%</span><span className="tabular-nums">{quote && discountAmt > 0 ? `- ${f(discountAmt)}` : dash}</span></div>
        <div className="flex justify-between text-[13px] text-ink-muted"><span>VAT 10%</span><span className="tabular-nums">{quote ? f(vat) : dash}</span></div>
        <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-[var(--hairline-soft)]">
          <span className="text-[14px] font-bold text-ink">합계</span>
          <span className="text-[20px] font-bold text-brand-600 tabular-nums">{quote ? f(grand) : dash}</span>
        </div>
      </div>

      {/* 저장 · 발행 */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onSaveDraft} disabled={saving} className="btn-outline justify-center">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 임시 저장</button>
        <button onClick={onComplete} disabled={saving || !quote} className="btn-primary justify-center">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} PDF 발행</button>
      </div>
      {/* 푸터 */}
      <div className="flex items-center gap-1.5 text-[11px] text-ink-subtle border-t border-[var(--hairline-soft)] pt-3">
        <Receipt className="w-3.5 h-3.5" /> 선택 {selectedCount}건 + 자동 {autoCount}건 · 엔진 산출
      </div>
    </section>
  );
}
