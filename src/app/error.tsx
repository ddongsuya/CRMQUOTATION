'use client';

/**
 * 페이지 단위 오류 경계 — 레이아웃(사이드바·헤더)은 유지한 채 본문만 오류 상태로 바꾼다.
 * 서버 컴포넌트에서 던진 오류(DB 연결 실패 등)가 여기로 온다.
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page-error]', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="card p-8 max-w-lg mx-auto mt-16 text-center" role="alert">
      <p className="eyebrow mb-2" style={{ color: 'var(--accent-press)' }}>오류</p>
      <h1 className="text-lg font-bold text-ink mb-2">이 화면을 불러오지 못했습니다</h1>
      <p className="text-[13px] text-ink-muted leading-relaxed mb-5">
        일시적인 연결 문제일 수 있습니다. 다시 시도해도 반복되면 관리자에게 알려 주세요.
        {error.digest && <span className="block mt-1 font-mono text-[11px] text-ink-subtle">코드 {error.digest}</span>}
      </p>
      <button onClick={() => reset()} className="btn-primary h-9 px-4 text-[13px]">다시 시도</button>
    </div>
  );
}
