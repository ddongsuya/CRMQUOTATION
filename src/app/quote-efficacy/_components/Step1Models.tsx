'use client';

import { useMemo } from 'react';
import Icon from '@/components/Icon';
import { STUDY_CATEGORIES, STUDY_MODELS, type StudyModel } from '@/lib/efficacy-engine/models';
import { PHASE, type PhaseType } from '@/lib/efficacy-engine/constants';

/** 모델 카드의 페이즈 스트립(높이 6px 바). 카드 목록용 단순 타입 추정(파싱 규칙은 parseSchedule과 동일). */
function bars(m: StudyModel) {
  const parsed = m.scheduleDurations.map((d) => {
    const g = d.match(/^(\d+)-(week|day|hour)$/);
    return { dur: g ? parseInt(g[1]) : 1, unit: g ? g[2] : 'week' };
  });
  const tot = parsed.reduce((a, x) => a + (x.unit === 'week' ? x.dur * 7 : x.unit === 'day' ? x.dur : 1), 0) || 1;
  return parsed.map((x, i) => {
    const days = x.unit === 'week' ? x.dur * 7 : x.unit === 'day' ? x.dur : 1;
    const pct = Math.max((days / tot) * 100, 6);
    const ty: PhaseType = i === 0 ? 'acclimation' : i === 1 && parsed.length >= 3 ? 'induction' : i === parsed.length - 1 ? 'observation' : 'administration';
    return { flex: pct, color: PHASE[ty].color };
  });
}

export default function Step1Models({
  browseCat, search, modelId, onCat, onSearch, onPick,
}: {
  browseCat: string; search: string; modelId: string;
  onCat: (c: string) => void; onSearch: (v: string) => void; onPick: (id: string) => void;
}) {
  const cats = useMemo(() => STUDY_CATEGORIES.filter((c) => c.name), []);
  const sq = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const matchQ = (mm: StudyModel) => !sq || (mm.title + mm.titleKr + mm.titleEn + mm.speciesRaw + (mm.inductionMethod || '')).toLowerCase().includes(sq);
    return (browseCat ? STUDY_MODELS.filter((x) => x.category === browseCat) : STUDY_MODELS).filter(matchQ);
  }, [browseCat, sq]);

  const rail = [{ name: '', label: '전체', count: STUDY_MODELS.length }]
    .concat(cats.map((c) => ({ name: c.name, label: c.name, count: STUDY_MODELS.filter((x) => x.category === c.name).length })));

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="eyebrow mb-2">STEP 1 · 질환 모델 선택</div>
          <h1 className="text-[34px] font-extrabold tracking-tight text-ink leading-[1.1] m-0">어떤 질환 모델로 설계할까요?</h1>
          <p className="mt-2 mb-0 text-[15px] text-ink-muted">모델을 선택하면 스케줄·군구성·평가항목이 프리셋으로 자동 구성됩니다.</p>
        </div>
        <div className="relative w-[280px]">
          <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="모델·동물종·유발법 검색"
            className="input pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[236px_minmax(0,1fr)] gap-5">
        {/* 카테고리 레일 */}
        <aside className="lg:sticky lg:top-[92px] self-start card p-2 max-h-[calc(100vh-140px)] overflow-y-auto">
          {rail.map((c) => {
            const active = browseCat === c.name;
            return (
              <button key={c.label} onClick={() => onCat(c.name)}
                className="flex items-center justify-between gap-2 w-full text-left px-3 py-[9px] rounded-[9px] border-none cursor-pointer text-[13px] transition-colors"
                style={active
                  ? { fontWeight: 600, background: 'var(--dark-surface)', color: '#fff' }
                  : { fontWeight: 500, background: 'transparent', color: 'var(--muted)' }}>
                <span className="truncate">{c.label}</span>
                <span className="font-mono text-[10.5px] font-semibold px-[7px] py-px rounded-full flex-shrink-0"
                  style={active
                    ? { background: 'rgba(255,255,255,.18)', color: '#fff' }
                    : { background: 'var(--card-cream)', color: 'var(--muted-soft)' }}>{c.count}</span>
              </button>
            );
          })}
        </aside>

        {/* 카드 그리드 */}
        <div>
          <p className="text-[13px] text-ink-subtle mb-3 tabular-nums">{filtered.length}개 모델</p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
            {filtered.map((mm) => {
              const sel = modelId === mm.id;
              const nEval = mm.evalItemsRaw.split(',').filter((x) => x.trim()).length;
              const chips = [mm.speciesRaw.split('(')[0].trim(), `${mm.ageWeeks || '?'}주령`, `${mm.durationWeeks || '?'}주`, `평가 ${nEval}`];
              return (
                <button key={mm.id} onClick={() => onPick(mm.id)}
                  className="model-card flex flex-col text-left p-4 rounded-[14px] cursor-pointer"
                  style={{
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--hairline)'}`,
                    background: sel ? 'rgba(245,129,31,.05)' : 'var(--card)',
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold text-ink truncate">{mm.titleKr || mm.title.replace(/^[IVX]+-\d+\.\s*/, '')}</div>
                      <div className="text-[11px] text-ink-subtle truncate">{mm.titleEn || ''}</div>
                    </div>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--card-cream)', color: 'var(--muted-soft)' }}>{mm.categoryCode}</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {chips.map((t, i) => (
                      <span key={i} className="px-2 py-[3px] rounded-md text-[10.5px] text-ink-muted" style={{ background: '#f6f5f4' }}>{t}</span>
                    ))}
                  </div>

                  <div className="flex gap-[3px] mt-3">
                    {bars(mm).map((b, i) => (
                      <span key={i} style={{ flex: `${b.flex} 0 0%`, minWidth: 6, height: 6, borderRadius: 3, background: b.color }} />
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-end justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[11.5px] text-ink-subtle truncate">유발 · {(mm.inductionMethod || '').replace(/\s*모델$/, '') || '—'}</div>
                      <div className="text-[11.5px] text-ink-subtle truncate">양성대조 · <b className="text-ink-body">{mm.positiveControl || '—'}</b></div>
                    </div>
                    <span className="text-[12px] font-semibold flex-shrink-0" style={{ color: 'var(--accent)' }}>선택 →</span>
                  </div>
                </button>
              );
            })}
          </div>
          {!filtered.length && <p className="text-[13px] text-ink-subtle py-10 text-center">검색 결과가 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
