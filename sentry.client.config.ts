// 브라우저 측 Sentry. DSN(NEXT_PUBLIC_SENTRY_DSN)이 없으면 SDK 는 아무것도 보내지 않는다.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  // 고객 개인정보(담당자 이름·연락처)가 폼에 있으므로 요청 본문·사용자 정보는 보내지 않는다.
  sendDefaultPii: false,
  ignoreErrors: ['ResizeObserver loop', 'AbortError', 'Load failed', 'Failed to fetch'],
});
