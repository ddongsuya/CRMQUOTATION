import { withAuth } from 'next-auth/middleware';

/**
 * Require an authenticated session on app pages.
 * The matcher lists protected route patterns; public ones are excluded.
 */
export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     *   - api/auth/*  (login flow itself)
     *   - api/items/by-keys, api/quote/calculate, api/plan/suggest, api/items/search
     *     (catalog queries — could later be gated too)
     *   - _next, favicon, login, register
     */
    '/((?!api/auth|api/items|api/plan|api/quote/calculate|api/knowledge|_next/static|_next/image|favicon|login).*)',
  ],
};
