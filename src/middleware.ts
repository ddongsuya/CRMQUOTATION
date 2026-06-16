import { NextResponse } from 'next/server';

/**
 * ⚠️ DEMO(임시): 로그인 게이트 비활성화 — 시연용. 누구나 로그인 없이 접근.
 *    정식 배포 시 아래 주석 블록으로 복구할 것.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [], // 빈 매처 = 미들웨어가 어떤 경로에도 실행되지 않음 (전 페이지 공개)
};

/* ───── 정식 배포 복구용 (로그인 필수) ─────
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/((?!api/auth|api/items|api/plan|api/quote/calculate|api/knowledge|_next/static|_next/image|favicon|login).*)',
  ],
};
──────────────────────────────────────── */
