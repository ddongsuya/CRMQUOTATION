'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useWizard } from '@/lib/store';

const STEPS = [
  { n: 1, label: '프로젝트' },
  { n: 2, label: '모달리티' },
  { n: 3, label: '임상 계획' },
  { n: 4, label: '항목·부형제' },
  { n: 5, label: '통화·할인' },
];

export default function Stepper() {
  const s = useWizard();
  const canJumpTo = (n: number) => {
    if (n <= s.step) return true;
    if (n >= 2 && !s.projectName.trim()) return false;
    if (n >= 3 && !s.modality) return false;
    if (n >= 5 && s.selections.length === 0) return false;
    return true;
  };
  const progress = ((s.step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="relative">
      {/* progress track */}
      <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 rounded-full" />
      <div
        className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500 ease-out"
        style={{ width: `calc(${progress}% - ${progress > 0 ? '0' : '0'}px)`, maxWidth: 'calc(100% - 2rem)' }}
      />

      <ol className="relative flex items-start justify-between">
        {STEPS.map(st => {
          const active = s.step === st.n;
          const done = s.step > st.n;
          const reachable = canJumpTo(st.n);
          return (
            <li key={st.n} className="flex flex-col items-center gap-2 z-10">
              <button
                onClick={() => reachable && s.setStep(st.n)}
                disabled={!reachable}
                className={clsx(
                  'inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all',
                  active && 'bg-brand-600 text-white border-brand-600 shadow-glow scale-110',
                  done && !active && 'bg-brand-600 text-white border-brand-600',
                  !active && !done && reachable && 'bg-white text-ink-muted border-slate-300 hover:border-brand-400 hover:text-ink',
                  !reachable && 'bg-white text-ink-subtle border-slate-200 cursor-not-allowed',
                )}
              >
                {done ? <Check className="w-4 h-4" /> : st.n}
              </button>
              <span
                className={clsx(
                  'text-[11px] font-medium whitespace-nowrap transition-colors',
                  active && 'text-ink',
                  done && !active && 'text-brand-600',
                  !active && !done && 'text-ink-subtle',
                )}
              >
                {st.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
