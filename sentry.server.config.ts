// Node 런타임(API 라우트·서버 컴포넌트) Sentry. DSN 미설정 시 비활성.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
});
