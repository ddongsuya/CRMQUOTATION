import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
    // src/instrumentation.ts (Sentry 서버/엣지 초기화) 활성 — Next 14 에서는 실험 플래그.
    instrumentationHook: true,
    // 서버리스(Vercel) 함수 번들에 data/ JSON 을 포함 → 런타임 fs 읽기 동작.
    // loadData()/loadKnowledge() 가 process.cwd()/data 를 읽으므로 필수.
    outputFileTracingIncludes: {
      '/**': ['./data/**/*'],
    },
  },
};

// Sentry 빌드 플러그인: 소스맵 업로드는 SENTRY_AUTH_TOKEN 이 있을 때만. 없으면 조용히 건너뛴다(빌드는 성공).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: false,
  disableLogger: true,
  automaticVercelMonitors: false,
});
