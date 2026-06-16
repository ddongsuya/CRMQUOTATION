'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Beaker, Home as HomeIcon, FileText, List, LogIn, LogOut, User, BookOpen, Database } from 'lucide-react';

/**
 * Wraps the page with the app chrome (dev banner, sticky header, main padding)
 * — but only when the current route is part of the regular app. Routes like
 * `/quote/print` opt out so they can render a clean PDF-like surface.
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const isPrint = pathname.startsWith('/quote/print');

  if (isPrint) {
    // Render children directly — the print page provides its own layout.
    return <>{children}</>;
  }

  return (
    <>
      <div className="dev-banner px-4 py-1.5 text-center text-xs no-print">
        🚧 개발 중 · 프로덕션 데이터 입력 금지 (2026-04-24)
      </div>
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-200/70 no-print">
        <div className="mx-auto max-w-[1440px] px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm group-hover:shadow-glow transition-shadow">
              <Beaker className="w-4 h-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[10px] tracking-wide uppercase text-ink-subtle font-medium">코아스템켐온</div>
              <div className="text-sm font-semibold text-ink">비임상시험 견적</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/" icon={<HomeIcon className="w-4 h-4" />}>홈</NavLink>
            <NavLink href="/quotes" icon={<List className="w-4 h-4" />}>견적 목록</NavLink>
            <NavLink href="/guidelines" icon={<BookOpen className="w-4 h-4" />}>가이드라인</NavLink>
            <NavLink href="/catalog" icon={<Database className="w-4 h-4" />}>항목·가격</NavLink>
            <NavLink href="/quote/new" icon={<FileText className="w-4 h-4" />}>새 견적</NavLink>
            <UserMenu />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-6 py-8">{children}</main>
    </>
  );
}

function UserMenu() {
  const { data: session, status } = useSession();
  if (status === 'loading') return null;
  if (!session) {
    return (
      <Link href="/login" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors text-sm font-medium">
        <LogIn className="w-4 h-4" /> 로그인
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
      <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-ink-muted">
        <User className="w-3.5 h-3.5" /> {session.user?.name}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors text-xs"
        title="로그아웃"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-slate-100 transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
