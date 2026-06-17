'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, ChevronLeft, Check, Clock } from 'lucide-react';
import { useWizard } from '@/lib/store';
import { isComingSoon } from '@/lib/modality-config';

type Leaf = { key: string; label: string; desc?: string };
type Mid = { label: string; desc?: string; leaves: Leaf[] };
type Top = { label: string; en: string; mids: Mid[] };

// 대분류 → 중분류 → 소분류(=앱 모달리티 키)
const TREE: Top[] = [
  {
    label: '합성신약', en: 'Small molecule',
    mids: [
      { label: '일반 합성신약', desc: '단일·복합 성분 저분자', leaves: [
        { key: '합성신약', label: '단일제', desc: '단일 성분' },
        { key: '복합제', label: '복합제', desc: '2~4 성분' },
      ] },
      { label: '특수 제형·성분', leaves: [
        { key: '펩타이드', label: '펩타이드' },
        { key: '항암제', label: '항암제', desc: '세포독성' },
        { key: '방사성의약품', label: '방사성의약품' },
      ] },
    ],
  },
  {
    label: '생물의약품', en: 'Biologics',
    mids: [
      { label: '항체·단백 의약품', leaves: [
        { key: '생물의약품', label: '항체·재조합단백질' },
        { key: '바이오시밀러', label: '바이오시밀러' },
        { key: 'ADC', label: 'ADC', desc: '항체-약물 접합체' },
        { key: '이중특이항체', label: '이중특이항체' },
      ] },
      { label: '백신', leaves: [
        { key: '백신', label: '백신' },
      ] },
    ],
  },
  {
    label: '첨단바이오', en: 'ATMP',
    mids: [
      { label: '세포·유전자 치료제', leaves: [
        { key: '세포치료제', label: '세포치료제' },
        { key: '유전자치료제', label: '유전자치료제' },
        { key: '핵산치료제', label: '핵산치료제' },
      ] },
    ],
  },
  {
    label: '비의약품', en: 'Non-drug',
    mids: [
      { label: '의료기기·화장품·건기식', leaves: [
        { key: '의료기기(ISO10993)', label: '의료기기', desc: 'ISO 10993' },
        { key: '화장품', label: '화장품', desc: '기능성' },
        { key: '건강기능식품', label: '건강기능식품' },
      ] },
      { label: '스크리닝·DMPK', leaves: [
        { key: 'in vitro 대사·PK', label: 'in vitro 대사·PK' },
        { key: '스크리닝', label: '스크리닝' },
        { key: '심혈관계스크리닝', label: '심혈관계 스크리닝' },
      ] },
      { label: '화학물질·환경', desc: '규제 데이터 준비 중', leaves: [
        { key: '화학물질(K-REACH)', label: '화학물질', desc: 'K-REACH' },
        { key: '살생물제(K-BPR)', label: '살생물제', desc: 'K-BPR' },
        { key: '농약', label: '농약' },
        { key: '인축독성', label: '인축독성' },
      ] },
    ],
  },
];

/** 선택된 모달리티 키 → 트리 위치 역추적 */
function locate(key: string): { t: number; m: number } | null {
  if (!key) return null;
  for (let t = 0; t < TREE.length; t++)
    for (let m = 0; m < TREE[t].mids.length; m++)
      if (TREE[t].mids[m].leaves.some(l => l.key === key)) return { t, m };
  return null;
}

export default function SectionModality() {
  const s = useWizard();
  const init = locate(s.modality);
  const [t, setT] = useState<number | null>(init?.t ?? null);
  const [m, setM] = useState<number | null>(init?.m ?? null);

  const top = t != null ? TREE[t] : null;
  const mid = top && m != null ? top.mids[m] : null;

  // 진행 단계 라벨
  const crumbs = [
    { label: top ? top.label : '대분류', active: !top },
    { label: mid ? mid.label : '중분류', active: !!top && !mid },
    { label: s.modality && mid ? '소분류 ✓' : '소분류', active: !!mid },
  ];

  return (
    <div className="space-y-4">
      {/* 진행 표시 */}
      <div className="flex items-center gap-1.5 text-xs">
        {crumbs.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3 text-ink-subtle/50" />}
            <span className={clsx('px-2 py-0.5 rounded-md', c.active ? 'bg-brand-100 text-brand-700 font-semibold' : 'text-ink-subtle')}>
              {c.label}
            </span>
          </span>
        ))}
      </div>

      {/* 뒤로 */}
      {top && (
        <button
          onClick={() => { if (mid) setM(null); else setT(null); }}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> {mid ? '중분류 다시 선택' : '대분류 다시 선택'}
        </button>
      )}

      {/* LEVEL 1 — 대분류 */}
      {!top && (
        <div className="grid sm:grid-cols-2 gap-3">
          {TREE.map((tp, i) => (
            <button key={i} onClick={() => { setT(i); setM(null); }}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300 hover:bg-brand-50/40 transition-all group">
              <div className="font-semibold text-ink group-hover:text-brand-700">{tp.label}</div>
              <div className="text-[11px] text-ink-subtle uppercase tracking-wide mt-0.5">{tp.en}</div>
              <div className="text-xs text-ink-muted mt-2">{tp.mids.flatMap(md => md.leaves).length}개 모달리티</div>
            </button>
          ))}
        </div>
      )}

      {/* LEVEL 2 — 중분류 */}
      {top && !mid && (
        <div className="grid sm:grid-cols-2 gap-3">
          {top.mids.map((md, i) => (
            <button key={i} onClick={() => setM(i)}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300 hover:bg-brand-50/40 transition-all group">
              <div className="font-semibold text-ink group-hover:text-brand-700 flex items-center gap-1.5">
                {md.label}
                <ChevronRight className="w-4 h-4 text-ink-subtle group-hover:text-brand-600" />
              </div>
              {md.desc && <div className="text-xs text-ink-subtle mt-0.5">{md.desc}</div>}
              <div className="text-xs text-ink-muted mt-2">{md.leaves.map(l => l.label).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}

      {/* LEVEL 3 — 소분류 (모달리티 확정) */}
      {mid && (
        <div className="grid sm:grid-cols-2 gap-3">
          {mid.leaves.map((leaf) => {
            const selected = s.modality === leaf.key;
            const soon = isComingSoon(leaf.key);
            return (
              <button key={leaf.key} onClick={() => { s.setModality(leaf.key); s.replaceSelections([]); }}
                className={clsx(
                  'text-left rounded-2xl border p-4 transition-all',
                  selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40',
                )}>
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx('font-semibold', selected ? 'text-brand-700' : 'text-ink')}>{leaf.label}</span>
                  {selected ? <Check className="w-4 h-4 text-brand-600" />
                    : soon ? <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold"><Clock className="w-2.5 h-2.5" />준비중</span>
                    : null}
                </div>
                {leaf.desc && <div className="text-xs text-ink-subtle mt-0.5">{leaf.desc}</div>}
              </button>
            );
          })}
        </div>
      )}

      {s.modality && (
        <div className="rounded-xl bg-brand-50/60 border border-brand-100 px-3 py-2 text-xs text-brand-800 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> 선택됨: <span className="font-semibold">{s.modality}</span>
          <span className="text-ink-subtle ml-1">· 가격기준 {s.priceStandard} ({s.submissionTarget})</span>
        </div>
      )}
    </div>
  );
}
