/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
    // 서버리스(Vercel) 함수 번들에 data/ JSON 을 포함 → 런타임 fs 읽기 동작.
    // loadData()/loadKnowledge() 가 process.cwd()/data 를 읽으므로 필수.
    outputFileTracingIncludes: {
      '/**': ['./data/**/*'],
    },
  },
};

export default nextConfig;
