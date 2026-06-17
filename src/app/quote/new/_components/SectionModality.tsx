'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, ChevronLeft, Check, Clock, MousePointerClick } from 'lucide-react';
import { useWizard } from '@/lib/store';
import { isComingSoon } from '@/lib/modality-config';

type Leaf = { key: string; label: string; desc?: string };
type Top = { label: string; en: string; leaves: Leaf[] };

// 대분류 → 중분류(=앱 모달리티 키). 소분류는 두지 않음(전용 템플릿이 중분류 단위)
const TREE: Top[] = [
  { label: '합성신약', en: 'Small molecule', leaves: [
    { key: '합성신약', label: '합성신약', desc: '단일 성분 저분자' },
    { key: '복합제', label: '복합제', desc: '2~4 성분' },
    { key: '펩타이드', label: '펩타이드' },
    { key: '항암제', label: '항암제', desc: '세포독성' },
    { key: '방사성의약품', label: '방사성의약품' },
  ] },
  { label: '생물의약품', en: 'Biologics', leaves: [
    { key: '생물의약품', label: '항체·재조합단백질' },
    { key: '바이오시밀러', label: '바이오시밀러' },
    { key: 'ADC', label: 'ADC', desc: '항체-약물 접합체' },
    { key: '이중특이항체', label: '이중특이항체' },
    { key: '백신', label: '백신' },
  ] },
  { label: '첨단바이오', en: 'ATMP', leaves: [
    { key: '세포치료제', label: '세포치료제' },
    { key: '유전자치료제', label: '유전자치료제' },
    { key: '핵산치료제', label: '핵산치료제' },
  ] },
  { label: '비의약품', en: 'Non-drug', leaves: [
    { key: '의료기기(ISO10993)', label: '의료기기', desc: 'ISO 10993' },
    { key: '화장품', label: '화장품', desc: '기능성' },
    { key: '건강기능식품', label: '건강기능식품' },
    { key: 'in vitro 대사·PK', label: 'in vitro 대사·PK' },
    { key: '스크리닝', label: '스크리닝' },
    { key: '심혈관계스크리닝', label: '심혈관계 스크리닝' },
    { key: '화학물질(K-REACH)', label: '화학물질', desc: 'K-REACH' },
    { key: '살생물제(K-BPR)', label: '살생물제', desc: 'K-BPR' },
    { key: '농약', label: '농약' },
    { key: '인축독성', label: '인축독성' },
  ] },
];

export default function SectionModality() {
  const s = useWizard();
  // 항상 대분류부터 시작 (이전 선택을 미리 열지 않음)
  const [t, setT] = useState<number | null>(null);
  const top = t != null ? TREE[t] : null;

  return (
    <div className="space-y-4">
      {/* 진행 표시 + 안내 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className={clsx('px-2.5 py-1 rounded-md', !top ? 'bg-brand-100 text-brand-700 font-semibold' : 'text-ink-subtle')}>1. 대분류</span>
          <ChevronRight className="w-3.5 h-3.5 text-ink-subtle/50" />
          <span className={clsx('px-2.5 py-1 rounded-md', top ? 'bg-brand-100 text-brand-700 font-semibold' : 'text-ink-subtle')}>2. 중분류 (모달리티)</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
          <MousePointerClick className="w-3.5 h-3.5" /> 카드를 클릭해 선택하세요
        </span>
      </div>

      {top && (
        <button onClick={() => setT(null)} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand-700 font-medium">
          <ChevronLeft className="w-4 h-4" /> 대분류 다시 선택 <span className="text-ink-subtle ml-1">(현재: {top.label})</span>
        </button>
      )}

      {/* LEVEL 1 — 대분류 */}
      {!top && (
        <div className="grid sm:grid-cols-2 gap-4">
          {TREE.map((tp, i) => (
            <button key={i} onClick={() => setT(i)}
              className="text-left rounded-2xl border-2 border-slate-200 bg-white p-6 hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-card-hover transition-all group">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-ink group-hover:text-brand-700">{tp.label}</div>
                  <div className="text-[11px] text-ink-subtle uppercase tracking-wide mt-0.5">{tp.en}</div>
                </div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-ink-subtle group-hover:bg-brand-600 group-hover:text-white transition-colors flex-shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </div>
              <div className="text-xs text-ink-muted mt-3 leading-relaxed">
                {tp.leaves.length}개 모달리티 · {tp.leaves.slice(0, 3).map(l => l.label).join(' · ')}{tp.leaves.length > 3 ? ' …' : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* LEVEL 2 — 중분류(모달리티 확정) */}
      {top && (
        <div className="grid sm:grid-cols-2 gap-4">
          {top.leaves.map((leaf) => {
            const selected = s.modality === leaf.key;
            const soon = isComingSoon(leaf.key);
            return (
              <button key={leaf.key} onClick={() => { s.setModality(leaf.key); s.replaceSelections([]); }}
                className={clsx(
                  'text-left rounded-2xl border-2 p-5 transition-all flex items-center justify-between gap-3',
                  selected ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-card-hover',
                )}>
                <div className="min-w-0">
                  <div className={clsx('text-base font-bold', selected ? 'text-brand-700' : 'text-ink')}>{leaf.label}</div>
                  {leaf.desc && <div className="text-xs text-ink-subtle mt-0.5">{leaf.desc}</div>}
                </div>
                {selected ? (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white flex-shrink-0"><Check className="w-5 h-5" /></span>
                ) : soon ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold flex-shrink-0"><Clock className="w-3 h-3" />준비중</span>
                ) : (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-200 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {s.modality && (
        <div className="rounded-xl bg-brand-50/60 border border-brand-100 px-3.5 py-2.5 text-sm text-brand-800 flex items-center gap-2">
          <Check className="w-4 h-4" /> 선택됨: <span className="font-bold">{s.modality}</span>
          <span className="text-ink-subtle text-xs ml-1">· 가격기준 {s.priceStandard} ({s.submissionTarget})</span>
        </div>
      )}
    </div>
  );
}
