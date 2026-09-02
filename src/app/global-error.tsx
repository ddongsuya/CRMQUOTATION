'use client';

/**
 * 루트 레이아웃까지 실패했을 때의 최후 오류 경계. 문서 전체를 대체하므로 html/body 를 직접 렌더한다.
 * 스타일은 전역 CSS 가 로드되지 않았을 수 있어 인라인으로 둔다.
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global-error]', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', background: '#FAFAF8', color: '#1F1D1A' }}>
        <main style={{ maxWidth: 480, margin: '18vh auto 0', padding: '0 24px' }}>
          <p style={{ fontSize: 12, letterSpacing: '.12em', color: '#C2590F', fontWeight: 600, margin: '0 0 8px' }}>오류</p>
          <h1 style={{ fontSize: 22, margin: '0 0 10px' }}>화면을 표시하지 못했습니다</h1>
          <p style={{ fontSize: 14, color: '#4A4640', lineHeight: 1.7, margin: '0 0 18px' }}>
            일시적인 문제일 수 있습니다. 다시 시도해도 반복되면 관리자에게 아래 코드를 알려 주세요.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, fontFamily: 'ui-monospace, Consolas, monospace', color: '#6F6A62', margin: '0 0 18px' }}>코드 {error.digest}</p>
          )}
          <button
            onClick={() => reset()}
            style={{ background: '#F5811F', color: '#1F1D1A', border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
