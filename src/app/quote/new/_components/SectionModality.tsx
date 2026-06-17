'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, ChevronLeft, Check, Clock, MousePointerClick } from 'lucide-react';
import { useWizard } from '@/lib/store';
import { isComingSoon } from '@/lib/modality-config';
import type { TemplateCategory } from '@/lib/modality-templates';

/**
 * 모달리티 선택 — data/_modality_templates.json(마스터데이터) 기반 2단계 위저드.
 * 대분류(분류) → 모달리티. 구성은 코드가 아니라 마스터데이터에서 오므로 관리자 편집 가능.
 */
export default function SectionModality({ tree }: { tree: TemplateCategory[] }) {
  const s = useWizard();
  // 항상 대분류부터 시작 (이전 선택을 미리 열지 않음)
  const [c, setC] = useState<number | null>(null);
  const cat = c != null ? tree[c] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className={clsx('px-2.5 py-1 rounded-md', !cat ? 'bg-brand-100 text-brand-700 font-semibold' : 'text-ink-subtle')}>1. 분류</span>
          <ChevronRight className="w-3.5 h-3.5 text-ink-subtle/50" />
          <span className={clsx('px-2.5 py-1 rounded-md', cat ? 'bg-brand-100 text-brand-700 font-semibold' : 'text-ink-subtle')}>2. 모달리티</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
          <MousePointerClick className="w-3.5 h-3.5" /> 카드를 클릭해 선택하세요
        </span>
      </div>

      {cat && (
        <button onClick={() => setC(null)} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand-700 font-medium">
          <ChevronLeft className="w-4 h-4" /> 분류 다시 선택 <span className="text-ink-subtle ml-1">(현재: {cat.label})</span>
        </button>
      )}

      {/* LEVEL 1 — 분류(대분류) */}
      {!cat && (
        <div className="grid sm:grid-cols-2 gap-4">
          {tree.map((tc, i) => (
            <button key={tc.id ?? i} onClick={() => setC(i)}
              className="text-left rounded-2xl border-2 border-slate-200 bg-white p-6 hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-card-hover transition-all group">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold text-ink group-hover:text-brand-700">{tc.label}</div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-ink-subtle group-hover:bg-brand-600 group-hover:text-white transition-colors flex-shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </div>
              <div className="text-xs text-ink-muted mt-3 leading-relaxed">
                {tc.modalities.length}개 · {tc.modalities.slice(0, 3).map(m => m.label).join(' · ')}{tc.modalities.length > 3 ? ' …' : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* LEVEL 2 — 모달리티 확정 */}
      {cat && (
        <div className="grid sm:grid-cols-2 gap-4">
          {cat.modalities.map((m) => {
            const selected = s.modality === m.key;
            const soon = isComingSoon(m.key);
            return (
              <button key={m.key} onClick={() => { s.setModality(m.key); s.replaceSelections([]); }}
                className={clsx(
                  'text-left rounded-2xl border-2 p-5 transition-all flex items-center justify-between gap-3',
                  selected ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-card-hover',
                )}>
                <div className="min-w-0">
                  <div className={clsx('text-base font-bold', selected ? 'text-brand-700' : 'text-ink')}>{m.label}</div>
                  {m.desc && <div className="text-xs text-ink-subtle mt-0.5">{m.desc}</div>}
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
