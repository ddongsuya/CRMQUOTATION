'use client';

import { useEffect, useState } from 'react';
import { FlaskConical, Loader2, Receipt, Ban, PlusCircle, AlertTriangle, FileText } from 'lucide-react';

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
const won = (n: number | null | undefined) => (n == null ? '—' : `₩${n.toLocaleString()}`);
type Meta = { categories: string[]; conditionKeys: string[]; addonOptions: { key: string; label: string; price: number }[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = any;

export default function QuoteV2Page() {
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
  const [cellType, setCellType] = useState<'adult' | 'esc_ipsc'>('adult');
  const [vaccineGroups, setVaccineGroups] = useState(2);
  const [healthSubtype, setHealthSubtype] = useState('개별인정형');
  const [conds, setConds] = useState<Record<string, boolean>>({});
  const [reqAddons, setReqAddons] = useState<Record<string, boolean>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [composed, setComposed] = useState<{ id: string; testName: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  // 고객 정보 + 안건연동 + 저장
  const [cust, setCust] = useState({ company: '', name: '', email: '', projectName: '', substanceName: '' });
  const [dealId, setDealId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNo, setSavedNo] = useState<string | null>(null);

  useEffect(() => { fetch('/api/quote-v2').then(r => r.json()).then(setMeta); }, []);
  useEffect(() => { const d = new URLSearchParams(window.location.search).get('dealId'); if (d) setDealId(Number(d)); }, []);

  const buildPlan = () => ({
    durations: [...durations], species, addons,
    tk: { points: tk.points, sampleOnly: tk.sampleOnly, sessions: tk.sessions },
    componentCount: isCombo ? comboCount : undefined, comboAnalysis: isCombo ? comboAnal : undefined,
    excipientCount: excipient, submissionTarget, cellType,
    vaccineGroups: category === '백신' ? vaccineGroups : undefined,
    subtype: category === '건강기능식품' ? healthSubtype : undefined,
  });
  const saveQuote = async (issueNow: boolean) => {
    setSaving(true); setSavedNo(null);
    try {
      const res = await fetch('/api/quote-v2/save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, standard, route, plan: buildPlan(), customerConditions: conds, requestedAddons: reqAddons, combinationCount: isCombo ? comboCount : undefined,
          projectName: cust.projectName, substanceName: cust.substanceName, customerName: cust.name, customerCompany: cust.company, customerEmail: cust.email, dealId, issueNow }),
      });
      const d = await res.json();
      if (d.quote?.quoteNumber) setSavedNo(d.quote.quoteNumber);
    } finally { setSaving(false); }
  };
  const toggleSet = (s: Set<string>, k: string) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; };
  const isCombo = category === '복합제';

  const generate = async () => {
    setLoading(true); setQuote(null); setSavedNo(null);
    try {
      const res = await fetch('/api/quote-v2', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, standard, route, plan: buildPlan(), customerConditions: conds, requestedAddons: reqAddons, combinationCount: isCombo ? comboCount : undefined }),
      });
      const d = await res.json();
      setQuote(d.quote ?? null); setComposed(d.composed ?? []);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FlaskConical className="w-6 h-6 text-brand-500" /> 견적 엔진 v2 <span className="pill bg-amber-100 text-amber-800">실험</span></h1>
        <p className="text-sm text-ink-muted mt-0.5">파라메트릭 입력 → 426 마스터에서 시험 자동 구성 → 규칙(33룰) 적용 → 견적.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        <section className="card p-4 space-y-3.5">
          <div className="grid grid-cols-3 gap-2">
            <Field label="모달리티"><select className="input" value={category} onChange={e => setCategory(e.target.value)}>{meta?.categories.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="제출처"><select className="input" value={standard} onChange={e => setStandard(e.target.value as 'MFDS' | 'OECD')}><option>MFDS</option><option>OECD</option></select></Field>
            <Field label="투여경로"><select className="input" value={route} onChange={e => setRoute(e.target.value)}>{ROUTES.map(r => <option key={r}>{r}</option>)}</select></Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="제출 대상 (안전성약리 hERG)"><select className="input" value={submissionTarget} onChange={e => setSubmissionTarget(e.target.value)}><option>국내</option><option>USFDA</option><option>EMA</option></select></Field>
            {category === '세포치료제' && <Field label="세포 유형"><div className="flex gap-1.5">
              <Chip on={cellType === 'adult'} onClick={() => setCellType('adult')}>성체(26주)</Chip>
              <Chip on={cellType === 'esc_ipsc'} onClick={() => setCellType('esc_ipsc')}>ESC/iPSC(52주)</Chip>
            </div></Field>}
            {category === '백신' && <Field label="군 구성"><div className="flex gap-1.5">{[2, 3, 4, 5].map(g => <Chip key={g} on={vaccineGroups === g} onClick={() => setVaccineGroups(g)}>{g}군</Chip>)}</div></Field>}
            {category === '건강기능식품' && <Field label="하위유형"><select className="input" value={healthSubtype} onChange={e => setHealthSubtype(e.target.value)}><option>개별인정형</option><option>프로바이오틱스</option><option>한시적식품</option></select></Field>}
          </div>

          {!isCombo && <>
            <Field label="본시험 기간 (복수)">
              <div className="flex flex-wrap gap-1.5">{DURATIONS.map(d => <Chip key={d.key} on={durations.has(d.key)} onClick={() => setDurations(s => toggleSet(s, d.key))}>{d.label}</Chip>)}</div>
            </Field>
            <Field label="종">
              <div className="flex gap-1.5">
                <Chip on={species.rodent} onClick={() => setSpecies(s => ({ ...s, rodent: !s.rodent }))}>설치류</Chip>
                <Chip on={species.nonRodent} onClick={() => setSpecies(s => ({ ...s, nonRodent: !s.nonRodent }))}>비설치류</Chip>
              </div>
            </Field>
            <Field label="부가 시험">
              <div className="flex flex-wrap gap-1.5">{ADDONS.map(a => <Chip key={a.key} on={!!addons[a.key]} onClick={() => setAddons(p => ({ ...p, [a.key]: !p[a.key] }))}>{a.label}</Chip>)}</div>
            </Field>
            <Field label="부형제(비히클) 종수 — 함량·조제물분석 곱">
              <div className="flex gap-1.5">{[1, 2, 3].map(n => <Chip key={n} on={excipient === n} onClick={() => setExcipient(n)}>{n}종</Chip>)}</div>
            </Field>
            {addons.tk && (
              <Field label="TK 사양">
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <span>채혈 포인트</span>{[6, 8].map(p => <Chip key={p} on={tk.points === p} onClick={() => setTk(t => ({ ...t, points: p }))}>{p}pt</Chip>)}
                  <span className="ml-2">회차</span>{[2, 3].map(s => <Chip key={s} on={tk.sessions === s} onClick={() => setTk(t => ({ ...t, sessions: s }))}>{s}회</Chip>)}
                  <Chip on={tk.sampleOnly} onClick={() => setTk(t => ({ ...t, sampleOnly: !t.sampleOnly }))}>채혈만</Chip>
                </div>
              </Field>
            )}
          </>}

          {isCombo && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="종수"><div className="flex gap-1.5">{[2, 3, 4].map(n => <Chip key={n} on={comboCount === n} onClick={() => setComboCount(n)}>{n}종</Chip>)}</div></Field>
              <Field label="분석방식"><div className="flex gap-1.5">{(['개별', '동시'] as const).map(a => <Chip key={a} on={comboAnal === a} onClick={() => setComboAnal(a)}>{a}</Chip>)}</div></Field>
            </div>
          )}

          <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} 견적 자동 구성
          </button>
        </section>

        {meta && (
          <section className="card p-4">
            <div className="label mb-2">고객 조건 (규칙 트리거)</div>
            <div className="grid grid-cols-1 gap-1.5">
              {meta.conditionKeys.map(k => (
                <label key={k} className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                  <input type="checkbox" checked={!!conds[k]} onChange={e => setConds(p => ({ ...p, [k]: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
                  {COND_LABEL[k] ?? k}
                </label>
              ))}
            </div>
            {meta.addonOptions.length > 0 && <>
              <div className="label mt-3 mb-2">추가 옵션 채택</div>
              <div className="grid grid-cols-1 gap-1.5">
                {meta.addonOptions.map(a => (
                  <label key={a.key} className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                    <input type="checkbox" checked={!!reqAddons[a.key]} onChange={e => setReqAddons(p => ({ ...p, [a.key]: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
                    {a.label} <span className="text-ink-subtle">(+{won(a.price)})</span>
                  </label>
                ))}
              </div>
            </>}
          </section>
        )}
      </div>

      {/* 고객 정보 */}
      <section className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="label !mb-0">고객 정보</div>
          {dealId && <span className="pill bg-violet-100 text-violet-700">안건 #{dealId} 연동</span>}
        </div>
        <div className="grid sm:grid-cols-4 gap-2">
          <Field label="고객사"><input className="input" value={cust.company} onChange={e => setCust(c => ({ ...c, company: e.target.value }))} placeholder="㈜OOO" /></Field>
          <Field label="담당자"><input className="input" value={cust.name} onChange={e => setCust(c => ({ ...c, name: e.target.value }))} /></Field>
          <Field label="이메일"><input className="input" value={cust.email} onChange={e => setCust(c => ({ ...c, email: e.target.value }))} /></Field>
          <Field label="물질명"><input className="input" value={cust.substanceName} onChange={e => setCust(c => ({ ...c, substanceName: e.target.value }))} /></Field>
        </div>
      </section>

      {quote && <QuoteResult quote={quote} composedCount={composed.length} />}

      {quote && (
        <div className="flex items-center justify-end gap-2">
          {savedNo && <span className="text-sm text-emerald-600 font-medium">저장됨 · {savedNo}</span>}
          <button onClick={() => saveQuote(false)} disabled={saving} className="btn-ghost">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 임시저장</button>
          <button onClick={() => saveQuote(true)} disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} 발행</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${on ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300' : 'bg-slate-100 text-ink-muted hover:bg-slate-200'}`}>{children}</button>;
}

function QuoteResult({ quote, composedCount }: { quote: Quote; composedCount: number }) {
  return (
    <section className="card p-5 space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold flex items-center gap-2"><Receipt className="w-5 h-5 text-brand-500" /> 견적 결과 <span className="text-xs font-normal text-ink-subtle">자동구성 {composedCount}건</span></h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
            <th className="py-1.5 pr-2">시험명</th><th className="py-1.5 px-2 w-14">경로</th><th className="py-1.5 px-2 w-28 text-right">단가</th><th className="py-1.5 px-2">적용 규칙/비고</th>
          </tr></thead>
          <tbody>
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

      {quote.waivedItems.length > 0 && <Note icon={<Ban className="w-4 h-4 text-red-500" />} title={`면제 (${quote.waivedItems.length})`}>{quote.waivedItems.map((w: any, i: number) => <div key={i}>• {w.testName} <span className="text-[11px] text-ink-subtle">— {w.reason}</span></div>)}</Note>}
      {quote.addons.length > 0 && <Note icon={<PlusCircle className="w-4 h-4 text-emerald-500" />} title={`추가 옵션 (${quote.addons.length})`}>{quote.addons.map((a: any, i: number) => <div key={i} className="flex justify-between"><span>{a.name}</span><span className="tabular-nums">+{won(a.price)}</span></div>)}</Note>}
      {quote.documentRequirements.length > 0 && <Note icon={<FileText className="w-4 h-4 text-sky-500" />} title="자료 요구">{quote.documentRequirements.map((d: any, i: number) => <div key={i}>• {d.document}{d.mandatory && <span className="text-red-500 ml-1">*</span>}</div>)}</Note>}
      {quote.missingInfo.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="text-sm font-semibold text-amber-900 flex items-center gap-1.5 mb-1"><AlertTriangle className="w-4 h-4" /> 확인 필요 ({quote.missingInfo.length})</div>
          {quote.missingInfo.map((m: any, i: number) => <div key={i} className="text-xs text-amber-800">• {m.message}</div>)}
        </div>
      )}

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
