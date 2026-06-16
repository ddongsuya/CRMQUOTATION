'use client';

import clsx from 'clsx';
import { useWizard } from '@/lib/store';
import { COMING_SOON_MODALITIES, isComingSoon } from '@/lib/modality-config';

export default function SectionModality({ modalities }: { modalities: string[] }) {
  const s = useWizard();
  const ready = modalities.filter(m => !isComingSoon(m));
  return (
    <div className="space-y-5">
      <div>
        <div className="label">모달리티</div>
        <div className="flex flex-wrap gap-2">
          {ready.map(m => (
            <button
              key={m}
              onClick={() => { s.setModality(m); s.replaceSelections([]); }}
              className={clsx('chip', s.modality === m ? 'chip-active' : 'chip-inactive')}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label flex items-center gap-2">
          준비 중
          <span className="text-[10px] font-normal text-ink-subtle">규제 데이터 정비 후 오픈 예정</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {COMING_SOON_MODALITIES.map(m => (
            <button
              key={m}
              onClick={() => { s.setModality(m); s.replaceSelections([]); }}
              className={clsx(
                'chip inline-flex items-center gap-1.5',
                s.modality === m ? 'chip-active' : 'chip-inactive opacity-70',
              )}
            >
              {m}
              <span className="text-[9px] px-1 py-px rounded bg-amber-100 text-amber-700 font-semibold">준비중</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label">가격 기준</div>
        <div className="inline-flex p-1 bg-slate-100 rounded-lg">
          {(['MFDS', 'OECD'] as const).map(ps => (
            <button
              key={ps}
              onClick={() => s.patch({ priceStandard: ps })}
              className={clsx(
                'px-4 py-1.5 rounded-md text-xs font-semibold transition-all',
                s.priceStandard === ps
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {ps}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
