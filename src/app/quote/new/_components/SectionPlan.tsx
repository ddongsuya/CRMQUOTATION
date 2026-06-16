'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Sparkles, Info, Loader2, AlertTriangle, BookOpen, ShieldCheck } from 'lucide-react';
import { useWizard, type Duration, type Selection } from '@/lib/store';
import { getModalityConfig, isComingSoon } from '@/lib/modality-config';
import type { Advisory, ModalityBasis } from '@/lib/advisories';
import { toast } from '@/lib/toast';

const ROUTES = ['경구', '정맥', '피하', '근육', '복강', '경피', '도포', '뇌내', '안구점적', '구강점막', '피내'];

const DURATIONS: { v: Duration; lbl: string }[] = [
  { v: 'SINGLE', lbl: '단회' },
  { v: 'W4', lbl: '4주' },
  { v: 'W13', lbl: '13주' },
  { v: 'W26', lbl: '26주' },
  { v: 'W39', lbl: '39주' },
  { v: 'W52', lbl: '52주' },
];

export default function SectionPlan() {
  const s = useWizard();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [modalityBasis, setModalityBasis] = useState<ModalityBasis | null>(null);

  if (!s.modality) {
    return (
      <div className="text-center py-8 text-sm text-ink-subtle">
        <Info className="w-5 h-5 mx-auto mb-2 text-ink-subtle/60" />
        2단계에서 모달리티를 먼저 선택하세요.
      </div>
    );
  }
  if (isComingSoon(s.modality)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mb-3">
          <Info className="w-6 h-6" />
        </div>
        <div className="text-base font-semibold text-ink">{s.modality} — 준비 중입니다</div>
        <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
          해당 모달리티는 규제 시험 데이터(톤수별 매트릭스·시험 단가)를 정비하는 중입니다.<br />
          정비 완료 후 견적 구성이 가능해집니다. 다른 모달리티를 선택해 주세요.
        </p>
      </div>
    );
  }
  const cfg = getModalityConfig(s.modality);

  const apply = async () => {
    setLoading(true);
    setNotes([]);
    setAdvisories([]);
    setModalityBasis(null);
    try {
      const res = await fetch('/api/plan/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modality: s.modality,
          plan: s.plan,
          priceStandard: s.priceStandard,
          excipientCount: s.excipientCount,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        hits: Array<{ key: string; testName: string; adminRoute: string | null; unitPrice: number; priority: '필수' | '권장' | '옵션'; tag: string }>;
        notes: string[];
        advisories?: Advisory[];
        modalityBasis?: ModalityBasis | null;
      };
      setNotes(data.notes);
      setAdvisories(data.advisories ?? []);
      setModalityBasis(data.modalityBasis ?? null);
      const sels: Selection[] = data.hits.map(h => ({
        key: h.key,
        testName: h.testName,
        adminRoute: h.adminRoute,
        unitPrice: h.unitPrice,
        quantity: 1,
        priority: h.priority,
        tag: h.tag,
        source: 'preset',
      }));
      s.replaceSelections(sels);
      const missingPrice = sels.filter(x => x.unitPrice === 0).length;
      toast.success(`${sels.length}개 항목 구성 완료${missingPrice ? ` · ${missingPrice}개는 가격 확인 필요` : ''}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      toast.error(`자동 구성 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const durs = DURATIONS.filter(d => !cfg.durationsAvailable || cfg.durationsAvailable.includes(d.v));
  const isDrugMode = cfg.mode === 'drug';

  const canApply = isDrugMode
    ? (cfg.showRoute ? !!s.plan.route : true) && (cfg.showDurations ? s.plan.durations.length > 0 : Object.values(s.plan.addons).some(Boolean))
    : Object.values(s.plan.categories).some(Boolean);

  return (
    <div className="space-y-5">
      {cfg.note && (
        <div className="flex gap-2 px-3 py-2 rounded-lg bg-brand-50/60 border border-brand-100/60 text-xs text-brand-800">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-brand-500" />
          <span>{cfg.note}</span>
        </div>
      )}

      {cfg.showRoute && (
        <Row label="투여 경로">
          <div className="flex flex-wrap gap-1.5">
            {ROUTES.map(r => (
              <button key={r} onClick={() => s.patchPlan({ route: r })} className={clsx('chip', s.plan.route === r ? 'chip-active' : 'chip-inactive')}>{r}</button>
            ))}
          </div>
        </Row>
      )}

      {s.modality === '복합제' && (
        <>
          <Row label="성분 종수" hint="복합제 구성 성분 수 · 종수별 단가 적용">
            <div className="flex flex-wrap gap-1.5">
              {[2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => s.patch({ excipientCount: n })}
                  className={clsx('chip', s.excipientCount === n ? 'chip-active' : 'chip-inactive')}
                >
                  {n}종
                </button>
              ))}
            </div>
          </Row>
          <Row label="분석방식" hint="동시분석 = 조제물·함량·TK분석 약 10~20% 저렴">
            <div className="flex gap-1.5">
              {(['개별', '동시'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => s.patchPlan({ comboAnalysis: m })}
                  className={clsx('chip', (s.plan.comboAnalysis ?? '개별') === m ? 'chip-active' : 'chip-inactive')}
                >
                  {m}분석
                </button>
              ))}
            </div>
          </Row>
        </>
      )}

      {s.modality === '백신' && (
        <Row label="군 구성" hint="대조군 1 + 백신군 (N−1) · 가격에 직접 반영">
          <div className="flex flex-wrap gap-1.5">
            {[2, 3, 4, 5].map(g => (
              <button
                key={g}
                onClick={() => s.patchPlan({ vaccineGroups: g })}
                className={clsx('chip', (s.plan.vaccineGroups ?? 2) === g ? 'chip-active' : 'chip-inactive')}
              >
                {g}군
              </button>
            ))}
          </div>
        </Row>
      )}

      {cfg.showDurations && (
        <Row label="본시험 기간" hint="복수 선택 가능">
          <div className="flex flex-wrap gap-1.5">
            {durs.map(d => (
              <button key={d.v} onClick={() => s.toggleDuration(d.v)} className={clsx('chip', s.plan.durations.includes(d.v) ? 'chip-active' : 'chip-inactive')}>
                {d.lbl}
              </button>
            ))}
          </div>
        </Row>
      )}

      {cfg.showPhase && (
        <Row label="임상 단계">
          <div className="flex gap-1.5">
            {(['IND1', 'IND2', 'NDA'] as const).map(p => (
              <button key={p} onClick={() => s.patchPlan({ phase: p })} className={clsx('chip', s.plan.phase === p ? 'chip-active' : 'chip-inactive')}>
                {p === 'IND1' ? 'IND 1상' : p === 'IND2' ? 'IND 2상' : 'NDA'}
              </button>
            ))}
          </div>
        </Row>
      )}

      {cfg.showSpecies && (
        <Row label="종 선택">
          <div className="flex gap-2">
            <SpeciesToggle checked={s.plan.species.rodent} onChange={(v) => s.patchPlan({ species: { ...s.plan.species, rodent: v } })} label="설치류" />
            <SpeciesToggle checked={s.plan.species.nonRodent} onChange={(v) => s.patchPlan({ species: { ...s.plan.species, nonRodent: v } })} label="비설치류" />
          </div>
        </Row>
      )}

      {isDrugMode && cfg.addons.length > 0 && (
        <Row label="부가 시험">
          <div className="grid grid-cols-2 gap-2">
            {cfg.addons.map(a => (
              <ToggleCard
                key={a.id}
                checked={!!s.plan.addons[a.id]}
                onChange={() => s.toggleAddon(a.id)}
                label={a.label}
              />
            ))}
          </div>
        </Row>
      )}

      {!isDrugMode && cfg.categories && (
        <Row label="시험 카테고리" hint="해당하는 항목을 선택하세요">
          <div className="grid grid-cols-2 gap-2">
            {cfg.categories.map(c => (
              <ToggleCard
                key={c.id}
                checked={!!s.plan.categories[c.id]}
                onChange={() => s.toggleCategory(c.id)}
                label={c.label}
              />
            ))}
          </div>
        </Row>
      )}

      {isDrugMode && s.plan.addons.tk && (
        <Row label="TK 사양" hint="본시험과 동일 기간 · 종별 1건씩 매칭">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <TKRow label="채혈 회수" values={[2, 3] as const} suffix="회"
              current={s.plan.tk.sessions}
              onChange={(n) => s.patchPlan({ tk: { ...s.plan.tk, sessions: n } })} />
            <TKRow label="타임포인트" values={[6, 8] as const} suffix="pt"
              current={s.plan.tk.points}
              onChange={(n) => s.patchPlan({ tk: { ...s.plan.tk, points: n } })} />
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-ink-muted w-16 font-medium">분석 범위</span>
              <div className="flex gap-1.5">
                <button onClick={() => s.patchPlan({ tk: { ...s.plan.tk, sampleOnly: false } })} className={clsx('chip', !s.plan.tk.sampleOnly ? 'chip-active' : 'chip-inactive')}>분석까지</button>
                <button onClick={() => s.patchPlan({ tk: { ...s.plan.tk, sampleOnly: true } })} className={clsx('chip', s.plan.tk.sampleOnly ? 'chip-active' : 'chip-inactive')}>채혈만</button>
              </div>
            </div>
          </div>
        </Row>
      )}

      <button
        onClick={apply}
        disabled={loading || !canApply}
        className="btn-primary w-full justify-center py-2.5"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? '구성 중…' : '이 계획으로 시험 자동 구성'}
      </button>

      {notes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
          <div className="font-semibold mb-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> 입력 안내
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {advisories.length > 0 && (
        <div className="space-y-2">
          <div className="label flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-500" /> 가이드라인 점검
          </div>
          {advisories.map(a => <AdvisoryCard key={a.id} a={a} />)}
        </div>
      )}

      {modalityBasis && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
          <div className="font-semibold mb-2 flex items-center gap-1.5 text-ink">
            <BookOpen className="w-3.5 h-3.5 text-brand-500" />
            {modalityBasis.모달리티} — 규제 근거
            {modalityBasis.하위분류 && modalityBasis.하위분류 !== '—' && (
              <span className="text-ink-subtle font-normal">· {modalityBasis.하위분류}</span>
            )}
          </div>
          {modalityBasis.규제근거.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5 text-ink-muted mb-2">
              {modalityBasis.규제근거.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          )}
          {modalityBasis.필수시험구성 && (
            <div className="text-ink-muted">
              <span className="font-semibold text-ink">필수 시험구성</span> — {modalityBasis.필수시험구성}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdvisoryCard({ a }: { a: Advisory }) {
  const tone =
    a.severity === '필수' ? { box: 'border-red-200 bg-red-50/70', pill: 'bg-red-100 text-red-700', icon: 'text-red-500' }
    : a.severity === '권장' ? { box: 'border-amber-200 bg-amber-50/70', pill: 'bg-amber-100 text-amber-800', icon: 'text-amber-500' }
    : { box: 'border-brand-100 bg-brand-50/60', pill: 'bg-brand-100 text-brand-700', icon: 'text-brand-500' };
  return (
    <div className={clsx('rounded-xl border p-3 text-xs', tone.box)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={clsx('w-3.5 h-3.5 flex-shrink-0 mt-0.5', tone.icon)} />
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={clsx('pill', tone.pill)}>{a.severity}</span>
            <span className="font-medium text-ink">{a.message}</span>
          </div>
          {a.basis && (
            <div className="text-[11px] text-ink-subtle leading-relaxed">
              <span className="font-semibold">근거</span> · {a.basis}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TKRow<T extends number>({ label, values, suffix, current, onChange }: { label: string; values: readonly T[]; suffix: string; current: T; onChange: (n: T) => void; }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-ink-muted w-16 font-medium">{label}</span>
      <div className="flex gap-1.5">
        {values.map(n => (
          <button key={n} onClick={() => onChange(n)} className={clsx('chip', current === n ? 'chip-active' : 'chip-inactive')}>{n}{suffix}</button>
        ))}
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label flex items-baseline gap-2">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-normal text-ink-subtle">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleCard({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
        checked
          ? 'bg-brand-50 border-brand-300 text-brand-800 shadow-sm'
          : 'bg-white border-slate-200 text-ink-muted hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <span
        className={clsx(
          'inline-flex items-center justify-center w-4 h-4 rounded border-2 flex-shrink-0',
          checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 bg-white',
        )}
      >
        {checked && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </span>
      {label}
    </button>
  );
}

function SpeciesToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={clsx(
        'chip',
        checked ? 'chip-active' : 'chip-inactive',
      )}
    >
      {label}
    </button>
  );
}
