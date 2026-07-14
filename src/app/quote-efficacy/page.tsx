'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';
import { PHASE, fmt, uid, type PhaseType } from '@/lib/efficacy-engine/constants';
import { ANIMAL_PRICES } from '@/lib/efficacy-engine/engine';
import Stepper from './_components/Stepper';
import Step1Models from './_components/Step1Models';
import Step2Client from './_components/Step2Client';
import Step3Design, { type Step3Handlers } from './_components/Step3Design';
import Step4Quote from './_components/Step4Quote';
import EditorDock from './_components/EditorDock';
import {
  INITIAL, animalEntry, computeCost, computeQuote, findModel, loadModelState,
  type Client, type EffState, type Group, type Params,
} from './_lib/state';

/**
 * 효력시험 견적 위저드 (4단계).
 * 레퍼런스: design_handoff_efficacy_quotation/효력시험 견적서.dc.html — 상태·계산 로직 1:1 이식.
 * 우리 프로젝트 기준: AppChrome 셸 안에서 동작하고, 저장은 기존 Quote 스키마(studyType='efficacy')로 영속한다.
 */
export default function QuoteEfficacyPage() {
  const [s, setS] = useState<EffState>(INITIAL);
  const [companies, setCompanies] = useState<string[]>([]);
  const [issueDate, setIssueDate] = useState<Date>(() => new Date());
  const [quoteNo, setQuoteNo] = useState('미발번');
  const [savedId, setSavedId] = useState<number | null>(null);
  const [dealId, setDealId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = useCallback((u: Partial<EffState>) => setS((p) => ({ ...p, ...u })), []);

  useEffect(() => {
    setIssueDate(new Date());
    fetch('/api/crm/companies')
      .then((r) => r.json())
      .then((j) => {
        const list = Array.isArray(j) ? j : (j?.companies ?? []);
        setCompanies(list.map((c: { name: string }) => c.name).filter(Boolean));
      })
      .catch(() => setCompanies([]));

    const sp = new URLSearchParams(window.location.search);

    // 저장된 견적 다시 열기 — 견적 목록·견적서에서 "수정"으로 진입
    const id = sp.get('id');
    if (id) {
      fetch(`/api/quotes/${id}`)
        .then((r) => r.json())
        .then(({ quote }) => {
          if (!quote?.planJson) throw new Error('견적을 불러올 수 없습니다.');
          const plan = JSON.parse(quote.planJson) as Partial<EffState> & { engine?: string };
          if (plan.engine !== 'efficacy' || !plan.modelId) {
            toast.error('효력시험 견적이 아닙니다. 독성 견적은 독성 모듈에서 수정하세요.');
            return;
          }
          setS({ ...INITIAL, ...plan, step: 3, selIdx: 0 } as EffState);
          setSavedId(quote.id);
          setQuoteNo(quote.quoteNumber);
          setIssueDate(quote.issuedAt ? new Date(quote.issuedAt) : new Date(quote.createdAt));
          if (quote.dealId) setDealId(quote.dealId);
        })
        .catch(() => toast.error('견적을 불러오지 못했습니다.'));
      return;
    }

    // 고객 컨텍스트 프리필 — 독성 모듈과 동일 (/customers "이 고객으로 견적", 안건 연동)
    const d = sp.get('dealId');
    if (d) setDealId(Number(d));
    const co = sp.get('company');
    const nm = sp.get('customerName');
    if (co || nm) setS((p) => ({ ...p, client: { ...p.client, company: co ?? p.client.company, name: nm ?? p.client.name } }));
  }, []);

  const m = useMemo(() => findModel(s.modelId), [s.modelId]);
  const cost = useMemo(() => (s.modelId ? computeCost(s, m) : { items: [], total: 0, byCat: [] }), [s, m]);
  const q = useMemo(() => computeQuote(cost.total, s.margin, s.discount), [cost.total, s.margin, s.discount]);

  // ── 스텝 이동 ───────────────────────────────────────────────
  const goStep = (n: number) => { if (n >= 2 && !s.modelId) return; patch({ step: n }); };
  const pickModel = (id: string) => setS((p) => ({ ...p, ...loadModelState(id), step: 2 }));

  // ── 스케줄 ─────────────────────────────────────────────────
  const updPhase = (i: number, u: Partial<EffState['schedule'][number]>) =>
    setS((p) => ({ ...p, schedule: p.schedule.map((x, idx) => (idx === i ? { ...x, ...u } : x)) }));
  const setType = (i: number, t: PhaseType) => updPhase(i, { type: t, label: PHASE[t].label });
  const bump = (i: number, d: number) => setS((p) => {
    const ph = p.schedule[i];
    const days = Math.max(ph.unit === 'day' ? 1 : 7, ph.days + d);
    const dur = ph.unit === 'week' ? Math.max(1, Math.round(days / 7)) : days;
    return { ...p, schedule: p.schedule.map((x, idx) => (idx === i ? { ...x, dur, days: ph.unit === 'week' ? dur * 7 : dur } : x)) };
  });
  const toggleUnit = (i: number) => setS((p) => {
    const ph = p.schedule[i];
    const next = ph.unit === 'week'
      ? { unit: 'day' as const }
      : (() => { const dur = Math.max(1, Math.round(ph.days / 7)); return { unit: 'week' as const, dur, days: dur * 7 }; })();
    return { ...p, schedule: p.schedule.map((x, idx) => (idx === i ? { ...x, ...next } : x)) };
  });
  const addPhase = () => setS((p) => {
    const at = p.selIdx + 1;
    const a = [...p.schedule];
    a.splice(at, 0, { id: uid(), type: 'observation', label: '관찰', dur: 1, unit: 'week', days: 7 });
    return { ...p, schedule: a, selIdx: at };
  });
  const delPhase = () => setS((p) => (p.schedule.length <= 1 ? p : {
    ...p, schedule: p.schedule.filter((_, i) => i !== p.selIdx), selIdx: Math.max(0, p.selIdx - 1),
  }));
  const updStepDur = (i: number, val: string) => setS((p) => {
    const ph = p.schedule[i];
    const dur = Math.max(1, Number(val) || 1);
    return { ...p, schedule: p.schedule.map((x, idx) => (idx === i ? { ...x, dur, days: ph.unit === 'week' ? dur * 7 : dur } : x)) };
  });
  const updStepUnit = (i: number, unit: 'week' | 'day') => setS((p) => {
    const ph = p.schedule[i];
    return { ...p, schedule: p.schedule.map((x, idx) => (idx === i ? { ...x, unit, days: unit === 'week' ? ph.dur * 7 : ph.dur } : x)) };
  });

  // ── 동물 파라미터 ───────────────────────────────────────────
  const setParam = (k: keyof Params, v: string | number) => setS((p) => ({ ...p, params: { ...p.params, [k]: v } }));
  const onVendor = (v: string) => setS((p) => {
    const first = ANIMAL_PRICES.find((a) => a.vendor === v);
    const strain = first ? first.strain : p.params.strain;
    const weeks = first ? Object.keys(first.priceByWeek) : [];
    const wk = first && first.priceByWeek[`${p.params.ageWeeks}W`] ? p.params.ageWeeks : (weeks.length ? parseInt(weeks[0]) : p.params.ageWeeks);
    return { ...p, params: { ...p.params, vendor: v, strain, ageWeeks: wk } };
  });
  const onStrain = (st: string) => setS((p) => {
    const e = animalEntry(p.params.vendor, st);
    const weeks = e ? Object.keys(e.priceByWeek) : [];
    const wk = e && e.priceByWeek[`${p.params.ageWeeks}W`] ? p.params.ageWeeks : (weeks.length ? parseInt(weeks[0]) : p.params.ageWeeks);
    return { ...p, params: { ...p.params, strain: st, ageWeeks: wk } };
  });

  // ── 군 · 엔드포인트 ─────────────────────────────────────────
  const updGroup = (id: string, u: Partial<Group>) => setS((p) => ({ ...p, groups: p.groups.map((g) => (g.id === id ? { ...g, ...u } : g)) }));
  const addGroup = () => setS((p) => {
    const g = [...p.groups, { id: uid(), tag: `G${p.groups.length + 1}`, label: `시험군 ${p.groups.length - 1}`, induct: true, subs: [{ id: uid(), label: '전체', n: 8 }] }];
    return { ...p, groups: g.map((x, i) => ({ ...x, tag: `G${i + 1}` })) };
  });
  const delGroup = (id: string) => setS((p) => ({ ...p, groups: p.groups.filter((x) => x.id !== id).map((x, i) => ({ ...x, tag: `G${i + 1}` })) }));
  const addSub = (gid: string) => setS((p) => ({
    ...p, groups: p.groups.map((g) => (g.id === gid ? { ...g, subs: [...g.subs, { id: uid(), label: `분할 ${g.subs.length + 1}`, n: 4 }] } : g)),
  }));
  const delSub = (gid: string, sid: string) => setS((p) => ({
    ...p, groups: p.groups.map((g) => (g.id === gid ? { ...g, subs: g.subs.length > 1 ? g.subs.filter((x) => x.id !== sid) : g.subs } : g)),
  }));
  const updSub = (gid: string, sid: string, u: { label?: string; n?: number }) => setS((p) => ({
    ...p, groups: p.groups.map((g) => (g.id === gid ? { ...g, subs: g.subs.map((x) => (x.id === sid ? { ...x, ...u } : x)) } : g)),
  }));

  const updEnd = (id: string, u: { name?: string }) => setS((p) => ({ ...p, endpoints: p.endpoints.map((e) => (e.id === id ? { ...e, ...u } : e)) }));
  const toggleCell = (id: string, col: string) => setS((p) => ({
    ...p, endpoints: p.endpoints.map((e) => (e.id === id ? { ...e, times: { ...e.times, [col]: !e.times[col] } } : e)),
  }));
  const addEnd = () => setS((p) => ({ ...p, endpoints: [...p.endpoints, { id: uid(), name: '새 평가항목', times: { 부검: true } }] }));
  const delEnd = (id: string) => setS((p) => ({ ...p, endpoints: p.endpoints.filter((e) => e.id !== id) }));

  const handlers: Step3Handlers = {
    setParam, onVendor, onStrain,
    selectPhase: (i) => patch({ selIdx: i }),
    setType, bump, toggleUnit, addPhase, delPhase, updStepDur, updStepUnit,
    updGroup, addGroup, delGroup, addSub, delSub, updSub,
    updEnd, toggleCell, addEnd, delEnd,
    goStep,
  };

  // ── 저장 ───────────────────────────────────────────────────
  const save = async () => {
    if (!s.client.company.trim()) { toast.error('고객사를 입력해 주세요. (STEP 2)'); goStep(2); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/quote-efficacy/save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: s, quoteId: savedId, dealId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? '저장 실패');
      setSavedId(d.quote.id);
      setQuoteNo(d.quote.quoteNumber);
      toast.success(`견적 저장 완료 · ${d.quote.quoteNumber}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const dockOpen = s.step === 3 && s.editorOpen;

  return (
    <div className="animate-fade-in">
      {/* 상단 툴바 (스텝 4에서는 문서 위 액션) */}
      <div className="flex items-center justify-end gap-2 mb-3 no-print">
        {s.step === 3 && (
          <button onClick={() => patch({ editorOpen: !s.editorOpen })}
            className="inline-flex items-center gap-[7px] h-[34px] px-[13px] rounded-full text-[13px] font-semibold cursor-pointer transition-colors"
            style={{
              border: `1px solid ${s.editorOpen ? 'var(--accent)' : 'var(--hairline)'}`,
              background: s.editorOpen ? 'rgba(245,129,31,.1)' : 'var(--card)',
              color: s.editorOpen ? 'var(--accent-press)' : 'var(--muted)',
            }}>
            <Icon name="settings" className="w-4 h-4" /> 편집 도구
          </button>
        )}
        {s.step === 4 && (
          <>
            <button onClick={() => goStep(3)} className="btn-ghost"><Icon name="chevron-left" className="w-4 h-4" /> 시험 설계로</button>
            <button onClick={save} disabled={saving} className="btn-ghost">{saving ? '저장 중…' : savedId ? '재저장' : '견적 저장'}</button>
            <button onClick={() => window.print()} className="btn-primary"><Icon name="arrow-right" className="w-4 h-4" /> PDF 저장</button>
          </>
        )}
      </div>

      <Stepper step={s.step} modelId={s.modelId} onGo={goStep} />

      <div className="pt-6 transition-[padding] duration-200" style={dockOpen ? { paddingRight: 412 } : undefined}>
        {s.step === 1 && (
          <Step1Models
            browseCat={s.browseCat} search={s.search} modelId={s.modelId}
            onCat={(c) => patch({ browseCat: c })} onSearch={(v) => patch({ search: v })} onPick={pickModel}
          />
        )}

        {s.step === 2 && (
          <Step2Client value={s.client} companies={companies} dealId={dealId}
            onChange={(u: Partial<Client>) => setS((p) => ({ ...p, client: { ...p.client, ...u } }))} />
        )}

        {s.step === 3 && <Step3Design s={s} m={m} grandTotal={q.vat} h={handlers} />}

        {s.step === 4 && (
          <Step4Quote s={s} items={cost.items} q={q} quoteNo={quoteNo} issueDate={issueDate} />
        )}

        {/* 하단 내비 */}
        {s.step > 1 && s.step < 4 && (
          <div className="flex items-center justify-between mt-6 no-print">
            <button onClick={() => goStep(s.step - 1)} className="btn-ghost">
              <Icon name="chevron-left" className="w-4 h-4" /> {s.step === 2 ? '모델 선택' : '고객 정보'}
            </button>
            <span className="text-[12px] text-ink-subtle tabular-nums">
              {s.step === 3 && <>최종 견적 · <b className="text-ink">₩{fmt(q.vat)}</b></>}
            </span>
            {s.step === 2 ? (
              <button onClick={() => goStep(3)} disabled={!s.client.company.trim()}
                className="btn-primary" style={{ background: 'var(--dark-surface)' }}>
                시험 설계 <Icon name="chevron-right" className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => goStep(4)} className="btn-primary">
                견적서 생성 <Icon name="chevron-right" className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {dockOpen && (
        <EditorDock
          s={s} cost={cost} quoteTotals={q} h={handlers}
          onClose={() => patch({ editorOpen: false })}
          onMargin={(v) => patch({ margin: v })}
          onDiscount={(v) => patch({ discount: v })}
        />
      )}
    </div>
  );
}
