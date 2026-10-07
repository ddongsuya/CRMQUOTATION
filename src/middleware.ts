import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { authDisabled } from '@/lib/auth-mode';

/**
 * 로그인 게이트 — 세션(JWT) 없으면 화면은 /login 으로, API 는 401 JSON 으로 돌려보낸다.
 *
 * 왜 withAuth 가 아니라 getToken 인가: withAuth 는 API 요청도 로그인 페이지로 리다이렉트(HTML)해서
 * 클라이언트 fetch 가 JSON 파싱 오류로 죽는다. API 는 401 로 끊어야 화면이 "로그인 필요"를 처리할 수 있다.
 *
 * 예전 데모 단계 예외(api/items·api/plan·api/quote/calculate·api/knowledge 공개)는 없앴다.
 * 단가 마스터가 그대로 노출되는 경로라서, 인증 예외는 next-auth 자체 경로(api/auth)뿐이다.
 *
 * 로컬 개발 편의: AUTH_DISABLED=1 이면 게이트를 끈다(src/lib/auth-mode.ts).
 */
export async function middleware(req: NextRequest) {
  if (authDisabled()) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // next-auth 경로·정적 자산·로그인 화면만 제외하고 전부 게이트를 통과시킨다.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon|login).*)'],
};
