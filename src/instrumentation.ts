// Next.js instrumentation hook — 서버 기동 시 1회. Sentry 서버/엣지 설정을 런타임별로 로드한다.
// (next.config.mjs 의 experimental.instrumentationHook: true 가 필요 — Next 14)
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// 서버 컴포넌트·미들웨어에서 난 오류(Next 15+ 에서 호출됨. 14 에서는 무해).
export const onRequestError = Sentry.captureRequestError;
