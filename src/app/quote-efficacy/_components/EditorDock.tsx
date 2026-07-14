'use client';

import Icon from '@/components/Icon';
import { CHEV, DOSE_FREQ, PHASE, PHASE_TYPES, ROUTES, fmt, type PhaseType } from '@/lib/efficacy-engine/constants';
import { ANIMAL_PRICES } from '@/lib/efficacy-engine/engine';
import { animalEntry, type EffState, type Params } from '../_lib/state';
import type { Step3Handlers } from './Step3Design';

const sel = 'w-full h-9 rounded-lg border border-slate-200 bg-[var(--card)] px-2.5 text-[12.5px] text-ink-body cursor-pointer outline-none focus:border-[var(--accent)]';

/** 편집 도구 도크 — ① 시험 정보 ② 스케줄 단계 ③ 견적 조건 + 하단 최종견적 요약. 상단바 토글로 열고닫음. */
export default function EditorDock({
  s, cost, quoteTotals, h, onClose, onMargin, onDiscount,
}: {
  s: EffState;
  cost: { total: number };
  quoteTotals: { wp: number; disc: number; vat: number };
  h: Step3Handlers;
  onClose: () => void;
  onMargin: (v: number) => void;
  onDiscount: (v: number) => void;
}) {
  const vendors = ANIMAL_PRICES.map((a) => a.vendor).filter((v, i, arr) => arr.indexOf(v) === i);
  const strainEntries = ANIMAL_PRICES.filter((a) => a.vendor === s.params.vendor);
  const curEntry = animalEntry(s.params.vendor, s.params.strain);
  const weekKeys = curEntry ? Object.keys(curEntry.priceByWeek) : [];

  return (
    <aside className="fixed top-0 right-0 bottom-0 w-[380px] z-30 bg-[var(--card)] border-l border-slate-200 flex flex-col no-print">
      <header className="flex items-start justify-between gap-2 px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-ink m-0">편집 도구</h2>
          <p className="text-[12px] text-ink-subtle mt-0.5 mb-0">의뢰자 시험 디자인에 맞게 수정</p>
        </div>
        <button onClick={onClose} className="icon-btn"><Icon name="x" className="w-4 h-4" /></button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* ① 시험 정보 */}
        <section>
          <div className="eyebrow mb-2.5">시험 정보</div>
          <div className="space-y-2.5">
            <F label="구입업체">
              <select className={sel} value={s.params.vendor} onChange={(e) => h.onVendor(e.target.value)}>
                {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </F>
            <F label="동물종 (strain)">
              <select className={sel} value={s.params.strain} onChange={(e) => h.onStrain(e.target.value)}>
                {strainEntries.map((e) => <option key={e.strain} value={e.strain}>{e.strain}</option>)}
              </select>
            </F>
            <F label="주령 · 마리당 단가">
              <select className={sel} value={String(s.params.ageWeeks)} onChange={(e) => h.setParam('ageWeeks', parseInt(e.target.value))}>
                {weekKeys.map((w) => <option key={w} value={String(parseInt(w))}>{parseInt(w)}주령 · ₩{fmt(curEntry!.priceByWeek[w])}</option>)}
              </select>
            </F>
            <F label="투여경로">
              <select className={sel} value={s.params.route} onChange={(e) => h.setParam('route', e.target.value)}>
                {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </F>
            <F label="투여 횟수">
              <select className={sel} value={s.params.freq} onChange={(e) => h.setParam('freq', e.target.value)}>
                {DOSE_FREQ.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </F>
            <F label="유발방법">
              <input className={sel} value={s.params.induction} onChange={(e) => h.setParam('induction', e.target.value)} />
            </F>
          </div>
        </section>

        {/* ② 스케줄 단계 */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <span className="eyebrow">스케줄 단계</span>
            <button onClick={h.addPhase} className="btn-ghost h-7 text-[11px] px-2"><Icon name="plus" className="w-3 h-3" /> 추가</button>
          </div>
          <div className="space-y-1.5">
            {s.schedule.map((p, i) => (
              <div key={p.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-[9px]"
                style={{
                  background: s.selIdx === i ? '#faf7f2' : '#faf9f8',
                  border: `1px solid ${s.selIdx === i ? '#f0d9c4' : 'var(--hairline-soft)'}`,
                }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHEV[i % CHEV.length] }} />
                <select value={p.type} onChange={(e) => h.setType(i, e.target.value as PhaseType)}
                  className="flex-1 h-7 rounded-md border border-slate-200 bg-[var(--card)] px-1.5 text-[11.5px] cursor-pointer outline-none">
                  {PHASE_TYPES.map((t) => <option key={t} value={t}>{PHASE[t].label}</option>)}
                </select>
                <input type="number" min={1} value={p.dur} onChange={(e) => h.updStepDur(i, e.target.value)}
                  className="w-12 h-7 rounded-md border border-slate-200 bg-[var(--card)] px-1.5 text-[11.5px] tabular-nums outline-none" />
                <select value={p.unit} onChange={(e) => h.updStepUnit(i, e.target.value as 'week' | 'day')}
                  className="w-[52px] h-7 rounded-md border border-slate-200 bg-[var(--card)] px-1 text-[11.5px] cursor-pointer outline-none">
                  <option value="week">주</option>
                  <option value="day">일</option>
                </select>
                <button onClick={() => { h.selectPhase(i); h.delPhase(); }} className="text-ink-subtle hover:text-[var(--error)] flex-shrink-0">
                  <Icon name="x" className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ③ 견적 조건 */}
        <section>
          <div className="eyebrow mb-2.5">견적 조건</div>
          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                <span className="text-ink-muted">영업이익률</span>
                <span className="font-semibold text-ink tabular-nums">{(s.margin * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={0.3} step={0.05} value={s.margin}
                onChange={(e) => onMargin(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </div>
            <div>
              <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                <span className="text-ink-muted">할인율</span>
                <span className="font-semibold text-ink tabular-nums">{(s.discount * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={0.4} step={0.05} value={s.discount}
                onChange={(e) => onDiscount(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </div>
          </div>
        </section>
      </div>

      {/* 하단 최종견적 요약 */}
      <footer className="flex-shrink-0 border-t border-slate-200 px-5 py-4 space-y-1.5">
        <Row k="원가" v={`₩${fmt(cost.total)}`} />
        <Row k={`견적가 (+${(s.margin * 100).toFixed(0)}%)`} v={`₩${fmt(quoteTotals.wp)}`} />
        <Row k={`할인가 (−${(s.discount * 100).toFixed(0)}%)`} v={`₩${fmt(quoteTotals.disc)}`} />
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200">
          <span className="text-[12px] font-semibold text-ink">최종 견적 · VAT 포함</span>
          <span className="text-[19px] font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>₩{fmt(quoteTotals.vat)}</span>
        </div>
      </footer>
    </aside>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-[11.5px] font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-ink-subtle">{k}</span>
      <span className="text-ink-body tabular-nums">{v}</span>
    </div>
  );
}
