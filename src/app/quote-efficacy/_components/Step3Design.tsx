'use client';

import Icon from '@/components/Icon';
import { CHEV, DOSE_FREQ, PHASE, PHASE_TYPES, ROUTES, fmt, type PhaseType } from '@/lib/efficacy-engine/constants';
import { ANIMAL_PRICES } from '@/lib/efficacy-engine/engine';
import type { StudyModel } from '@/lib/efficacy-engine/models';
import {
  animalEntry, animalPrice, durLabel, groupTotal, timeCols, totalAnimalsOf, totalDaysOf,
  type EffState, type Group, type Params, type Phase,
} from '../_lib/state';

export type Step3Handlers = {
  setParam: (k: keyof Params, v: string | number) => void;
  onVendor: (v: string) => void;
  onStrain: (v: string) => void;
  selectPhase: (i: number) => void;
  setType: (i: number, t: PhaseType) => void;
  bump: (i: number, d: number) => void;
  toggleUnit: (i: number) => void;
  addPhase: () => void;
  delPhase: () => void;
  updStepDur: (i: number, val: string) => void;
  updStepUnit: (i: number, unit: 'week' | 'day') => void;
  updGroup: (id: string, u: Partial<Group>) => void;
  addGroup: () => void;
  delGroup: (id: string) => void;
  addSub: (gid: string) => void;
  delSub: (gid: string, sid: string) => void;
  updSub: (gid: string, sid: string, u: { label?: string; n?: number }) => void;
  updEnd: (id: string, u: { name?: string }) => void;
  toggleCell: (id: string, col: string) => void;
  addEnd: () => void;
  delEnd: (id: string) => void;
  goStep: (n: number) => void;
};

const selCls = 'w-full h-[42px] rounded-[10px] border border-slate-200 bg-[var(--card)] px-3 text-[13px] text-ink-body cursor-pointer focus:border-[var(--accent)] outline-none';

export default function Step3Design({ s, m, grandTotal, h }: {
  s: EffState; m: StudyModel; grandTotal: number; h: Step3Handlers;
}) {
  const totalDays = totalDaysOf(s.schedule);
  const totalWeeks = Math.ceil(totalDays / 7);
  const totalAnimals = totalAnimalsOf(s.groups);
  const cols = timeCols(s.schedule);

  const vendors = ANIMAL_PRICES.map((a) => a.vendor).filter((v, i, arr) => arr.indexOf(v) === i);
  const strainEntries = ANIMAL_PRICES.filter((a) => a.vendor === s.params.vendor);
  const curEntry = animalEntry(s.params.vendor, s.params.strain);
  const weekKeys = curEntry ? Object.keys(curEntry.priceByWeek) : [];
  const selP: Phase | undefined = s.schedule[s.selIdx] ?? s.schedule[0];

  return (
    <div className="space-y-4">
      {/* 선택된 모델 + 파라미터 */}
      <section className="card card-pad">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow mb-1.5">STEP 3 · 선택된 모델</div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[26px] font-extrabold tracking-tight text-ink m-0">{m.title.replace(/^[IVX]+-\d+\.\s*/, '')}</h1>
              <button onClick={() => h.goStep(1)} className="btn-ghost h-8 text-[12px]">모델 변경</button>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow mb-0.5">최종 견적 · VAT 포함</div>
            <div className="text-[28px] font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>₩{fmt(grandTotal)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <Fld label="구입업체">
            <select className={selCls} value={s.params.vendor} onChange={(e) => h.onVendor(e.target.value)}>
              {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Fld>
          <Fld label="동물종 (strain)">
            <select className={selCls} value={s.params.strain} onChange={(e) => h.onStrain(e.target.value)}>
              {strainEntries.map((e) => <option key={e.strain} value={e.strain}>{e.strain}</option>)}
            </select>
          </Fld>
          <Fld label="주령 · 마리당 단가">
            <select className={selCls} value={String(s.params.ageWeeks)} onChange={(e) => h.setParam('ageWeeks', parseInt(e.target.value))}>
              {weekKeys.map((w) => (
                <option key={w} value={String(parseInt(w))}>{parseInt(w)}주령 · ₩{fmt(curEntry!.priceByWeek[w])}</option>
              ))}
            </select>
          </Fld>
          <Fld label="유발방법">
            <input className={selCls} value={s.params.induction} onChange={(e) => h.setParam('induction', e.target.value)} />
          </Fld>
          <Fld label="투여경로">
            <select className={selCls} value={s.params.route} onChange={(e) => h.setParam('route', e.target.value)}>
              {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Fld>
          <Fld label="투여 횟수">
            <select className={selCls} value={s.params.freq} onChange={(e) => h.setParam('freq', e.target.value)}>
              {DOSE_FREQ.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Fld>
          <div className="col-span-2 flex items-end">
            <p className="text-[12px] text-ink-subtle tabular-nums">마리당 ₩{fmt(animalPrice(s.params))} · 총 {totalAnimals}마리 · {totalWeeks}주({totalDays}일)</p>
          </div>
        </div>
      </section>

      {/* 노드 타임라인 */}
      <section className="card card-pad">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <h2 className="text-[17px] font-bold text-ink m-0">시험 진행 타임라인</h2>
          <span className="text-[12px] text-ink-subtle tabular-nums">총 {totalWeeks}주 · {totalDays}일 · 단계를 클릭해 편집</span>
        </div>
        <p className="text-[13px] text-ink-muted mt-0 mb-6">유발기간·투여기간·관찰기간 등을 자유롭게 조정하면 스케줄과 견적이 함께 갱신됩니다.</p>

        <div className="relative overflow-x-auto pb-2">
          <div className="relative flex items-center justify-between gap-6 min-w-[560px] h-[300px] px-4">
            {/* 중앙 수평선 + 양끝 점 */}
            <span className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2" style={{ background: '#e0ddd9' }} />
            <span className="absolute left-0 top-1/2 w-2.5 h-2.5 rounded-full -translate-y-1/2" style={{ background: '#e0ddd9' }} />
            <span className="absolute right-0 top-1/2 w-2.5 h-2.5 rounded-full -translate-y-1/2" style={{ background: '#e0ddd9' }} />

            {s.schedule.map((p, i) => {
              const sel = s.selIdx === i;
              const col = CHEV[i % CHEV.length];
              const up = i % 2 === 0;
              const detail = p.type === 'induction' ? (s.params.induction || '질환 유발')
                : p.type === 'administration' ? '시험물질 반복투여'
                : p.type === 'acclimation' ? '환경 적응'
                : p.type === 'observation' ? '효력 평가·관찰'
                : p.type === 'sacrifice' ? '부검·시료채취' : '시료 분석';
              return (
                <div key={p.id} className="relative flex items-center justify-center flex-1">
                  {/* 라벨 (위/아래 교차) */}
                  <div className="absolute left-1/2 -translate-x-1/2 w-[150px] text-center"
                    style={up ? { bottom: 'calc(50% + 52px)' } : { top: 'calc(50% + 52px)' }}>
                    <div className="text-[13px] font-bold text-ink">{p.label}</div>
                    <div className="mt-1 mb-1 inline-block font-mono text-[10px] font-semibold rounded-full px-[9px] py-0.5"
                      style={{ color: col, background: `${col}18` }}>{durLabel(p)}</div>
                    <div className="text-[11px] text-ink-subtle leading-snug">{detail}</div>
                  </div>
                  {/* 점선 스템 */}
                  <span className="absolute left-1/2 -translate-x-1/2 w-0 h-6"
                    style={{ borderLeft: `2px dotted ${col}`, ...(up ? { bottom: 'calc(50% + 28px)' } : { top: 'calc(50% + 28px)' }) }} />
                  {/* 번호 원 */}
                  <button onClick={() => h.selectPhase(i)}
                    className="relative z-[2] w-14 h-14 rounded-full flex items-center justify-center font-mono text-[17px] font-bold cursor-pointer"
                    style={{
                      background: sel ? col : 'var(--card)', color: sel ? '#fff' : col,
                      border: `2.5px solid ${col}`,
                      boxShadow: sel ? `0 0 0 4px ${col}22` : '0 1px 2px rgba(0,0,0,.05)',
                    }}>{String(i + 1).padStart(2, '0')}</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 인스펙터 */}
        {selP && (
          <div className="mt-4 rounded-[10px] border border-slate-200 p-3.5" style={{ background: '#faf9f8' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold" style={{ color: PHASE[selP.type].color }}>{selP.label}</span>
                <span className="text-[12px] text-ink-subtle tabular-nums">{durLabel(selP)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => h.bump(s.selIdx, selP.unit === 'day' ? -1 : -7)} className="icon-btn w-8 h-8">−</button>
                <button onClick={() => h.bump(s.selIdx, selP.unit === 'day' ? 1 : 7)} className="icon-btn w-8 h-8">+</button>
                <button onClick={() => h.toggleUnit(s.selIdx)} className="btn-ghost h-8 text-[12px]">{selP.unit === 'week' ? '주 단위' : '일 단위'}</button>
                <button onClick={h.addPhase} className="btn-ghost h-8 text-[12px]"><Icon name="plus" className="w-3.5 h-3.5" /> 단계</button>
                <button onClick={h.delPhase} disabled={s.schedule.length <= 1} className="btn-ghost h-8 text-[12px]" style={{ color: 'var(--error)' }}>삭제</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_TYPES.map((t) => {
                const on = selP.type === t;
                const col = PHASE[t].color;
                return (
                  <button key={t} onClick={() => h.setType(s.selIdx, t)}
                    className="px-[11px] py-[5px] rounded-lg text-[11.5px] font-semibold cursor-pointer"
                    style={{ border: `1px solid ${on ? col : 'var(--hairline)'}`, color: on ? '#fff' : 'var(--muted)', background: on ? col : 'var(--card)' }}>
                    {PHASE[t].label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 군 구성 */}
      <section className="card card-pad">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[17px] font-bold text-ink m-0">군 구성</h2>
          <button onClick={h.addGroup} className="btn-ghost h-8 text-[12px]"><Icon name="plus" className="w-3.5 h-3.5" /> 군 추가</button>
        </div>

        <div className="space-y-2.5">
          {s.groups.map((g) => (
            <div key={g.id} className="rounded-[10px] border border-slate-200 p-3" style={{ background: '#faf9f8' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--dark-surface)', color: '#fff' }}>{g.tag}</span>
                <input value={g.label} onChange={(e) => h.updGroup(g.id, { label: e.target.value })}
                  className="flex-1 min-w-[140px] h-8 px-2.5 text-[13px] rounded-md border border-slate-200 bg-[var(--card)] outline-none focus:border-[var(--accent)]" />
                <button onClick={() => h.updGroup(g.id, { induct: !g.induct })}
                  className="h-7 px-[9px] rounded-[7px] text-[10.5px] font-semibold cursor-pointer whitespace-nowrap"
                  style={{ border: `1px solid ${g.induct ? '#d1685a' : 'var(--hairline)'}`, color: g.induct ? '#fff' : 'var(--muted-soft)', background: g.induct ? '#d1685a' : 'var(--card)' }}>
                  {g.induct ? '유발' : '무처치'}
                </button>
                <span className="text-[12px] text-ink-muted tabular-nums whitespace-nowrap">총 {groupTotal(g)}마리</span>
                <button onClick={() => h.addSub(g.id)} className="btn-ghost h-7 text-[11px] px-2">+ 마리수 분할</button>
                <button onClick={() => h.delGroup(g.id)} className="icon-btn w-7 h-7"><Icon name="x" className="w-3.5 h-3.5" /></button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2 pl-1">
                {g.subs.map((x) => (
                  <span key={x.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-[var(--card)] px-1.5 py-1">
                    <input value={x.label} onChange={(e) => h.updSub(g.id, x.id, { label: e.target.value })}
                      className="w-[68px] text-[11.5px] bg-transparent outline-none text-ink-muted" />
                    <input type="number" min={1} value={x.n} onChange={(e) => h.updSub(g.id, x.id, { n: Number(e.target.value) || 1 })}
                      className="w-11 text-[12px] font-semibold text-ink bg-transparent outline-none tabular-nums text-right" />
                    {g.subs.length > 1 && (
                      <button onClick={() => h.delSub(g.id, x.id)} className="text-ink-subtle hover:text-ink"><Icon name="x" className="w-3 h-3" /></button>
                    )}
                  </span>
                ))}
                {g.subs.length > 1 && (
                  <span className="inline-flex items-center text-[11.5px] text-ink-subtle tabular-nums px-1">
                    {g.subs.map((x) => x.n).join('+')} = {groupTotal(g)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[13px] font-semibold text-ink tabular-nums">{s.groups.length}개 군 · 총 {totalAnimals}마리</p>
      </section>

      {/* 엔드포인트 · 평가 스케줄 */}
      <section className="card card-pad">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[17px] font-bold text-ink m-0">엔드포인트 · 평가 스케줄</h2>
          <button onClick={h.addEnd} className="btn-ghost h-8 text-[12px]"><Icon name="plus" className="w-3.5 h-3.5" /> 항목</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-semibold text-ink-subtle uppercase tracking-wider pb-2 pr-3 min-w-[180px]">평가항목</th>
                {cols.map((c) => (
                  <th key={c} className="text-[11px] font-semibold text-ink-subtle pb-2 px-1 w-[42px] whitespace-nowrap">{c}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {s.endpoints.map((e) => (
                <tr key={e.id} className="border-t border-slate-200">
                  <td className="py-1.5 pr-3">
                    <input value={e.name} onChange={(ev) => h.updEnd(e.id, { name: ev.target.value })}
                      className="w-full h-8 px-2.5 text-[13px] rounded-md border border-slate-200 bg-[var(--card)] outline-none focus:border-[var(--accent)]" />
                  </td>
                  {cols.map((c) => {
                    const on = !!e.times[c];
                    return (
                      <td key={c} className="text-center px-1">
                        <button onClick={() => h.toggleCell(e.id, c)}
                          className="w-[26px] h-[26px] rounded-[7px] cursor-pointer text-[9px] leading-none"
                          style={{ border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`, background: on ? 'var(--accent)' : 'var(--card)', color: '#fff' }}>
                          {on ? '●' : ''}
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-center">
                    <button onClick={() => h.delEnd(e.id)} className="icon-btn w-7 h-7"><Icon name="x" className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[12.5px] text-ink-muted">양성대조물질 · <b className="text-ink">{m.positiveControl || 'N/A'}</b></p>
      </section>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
