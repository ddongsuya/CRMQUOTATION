'use client';

/** 4단계 스테퍼 — 원(28px)·커넥터(2px). 모델 미선택 시 2단계 이상 잠금(opacity .4 / not-allowed). */
const STEP_LABELS = ['모델 선택', '고객 정보', '시험 설계', '견적서'];

/**
 * 4단계 스테퍼. 엑셀 "틀 고정"처럼 스크롤 영역 맨 위에 불투명 바로 얼어붙고 본문이 그 밑으로 지나간다.
 * top 음수값은 main의 상단 패딩(pt-6 / lg:pt-10)을 상쇄해 바가 뜨지 않고 화면 최상단에 밀착시킨다.
 * (반투명이면 표 숫자가 비쳐 "떠다니는 띠"처럼 보여 어색함)
 */
export default function Stepper({ step, modelId, onGo, actions }: {
  step: number; modelId: string; onGo: (n: number) => void; actions?: React.ReactNode;
}) {
  return (
    <div
      className="sticky top-[-24px] lg:top-[-40px] z-20 -mx-4 sm:-mx-6 lg:-mx-11 -mt-6 lg:-mt-10 px-4 sm:px-6 lg:px-11 py-4 border-b border-slate-200 no-print"
      style={{ background: 'var(--card)', boxShadow: '0 6px 14px -10px rgba(0,0,0,.18)' }}
    >
      <div className="relative flex items-center">
        <div className="mx-auto max-w-[760px] w-full flex items-center justify-between">
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

        {/* 편집 도구 · PDF 저장 — 시안처럼 고정 바 우측에 함께 얼어붙는다 */}
        {actions && <div className="absolute right-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
