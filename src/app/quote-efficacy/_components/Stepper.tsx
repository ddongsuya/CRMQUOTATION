'use client';

/** 4단계 스테퍼 — 원(28px)·커넥터(2px). 모델 미선택 시 2단계 이상 잠금(opacity .4 / not-allowed). */
const STEP_LABELS = ['모델 선택', '고객 정보', '시험 설계', '견적서'];

export default function Stepper({ step, modelId, onGo }: { step: number; modelId: string; onGo: (n: number) => void }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-11 px-4 sm:px-6 lg:px-11 py-4 bg-[var(--card)]/92 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-[760px] flex items-center justify-between">
        {STEP_LABELS.map((label, idx) => {
          const n = idx + 1;
          const active = step === n;
          const done = step > n;
          const on = active || done;
          const reachable = n === 1 || !!modelId;
          return (
            <div key={n} className="flex items-center gap-2.5">
              <button
                onClick={() => reachable && onGo(n)}
                disabled={!reachable}
                className="flex items-center gap-[9px] bg-transparent border-none p-0"
                style={{ cursor: reachable ? 'pointer' : 'not-allowed', opacity: reachable ? 1 : 0.4 }}
              >
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12.5px] font-bold flex-shrink-0"
                  style={on
                    ? { background: 'var(--dark-surface)', color: '#fff' }
                    : { background: 'var(--card)', border: '1px solid #d8d5d1', color: 'var(--muted-soft)' }}
                >{n}</span>
                <span className="text-[13px] whitespace-nowrap"
                  style={{ fontWeight: active ? 700 : 500, color: on ? 'var(--ink)' : 'var(--muted-soft)' }}>{label}</span>
              </button>
              {n < 4 && <span className="w-9 h-0.5 rounded-sm" style={{ background: done ? 'var(--dark-surface)' : 'var(--hairline)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
