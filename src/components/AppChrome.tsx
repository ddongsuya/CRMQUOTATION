'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Icon, { type IconName } from './Icon';

export type ChromeStats = { items: number; presets: number; blocks: number; modalities: number };

// 사이드바 8개 메뉴 (standalone 정답: 새 견적은 nav 행이 아니라 CTA 버튼 하나뿐)
const NAV: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/', label: '홈', icon: 'home', exact: true },
  { href: '/customers', label: '고객 관리', icon: 'users' },
  { href: '/notes', label: '개인 기록', icon: 'notebook' },
  { href: '/calendar', label: '캘린더', icon: 'calendar' },
  { href: '/gantt', label: '시험 일정', icon: 'gantt' },
  { href: '/quotes', label: '견적 목록', icon: 'list' },
  { href: '/guidelines', label: '가이드라인', icon: 'book' },
  { href: '/catalog', label: '항목·가격', icon: 'database' },
];

// 모바일 하단 탭바 (홈·견적·고객·일정·더보기)
const BOTTOM_NAV: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/', label: '홈', icon: 'home', exact: true },
  { href: '/quotes', label: '견적', icon: 'list' },
  { href: '/customers', label: '고객', icon: 'users' },
  { href: '/calendar', label: '일정', icon: 'calendar' },
];

const PAGE_LABEL: Record<string, string> = {
  '/': '홈',
  '/customers': '고객 관리',
  '/notes': '개인 기록',
  '/calendar': '캘린더',
  '/gantt': '시험 일정',
  '/quotes': '견적 목록',
  '/guidelines': '가이드라인',
  '/catalog': '항목·가격',
  '/quote-v2': '새 견적 작성',
  '/quote/new': '새 견적 작성 (구)',
};

/**
 * 앱 셸 — 사이드바(264) + 메인(탑바 64 + 콘텐츠). standalone 정답 레이아웃에 맞춤.
 * `/quote/print` · `/login` · `/register` 는 자체 레이아웃.
 */
export default function AppChrome({ children, stats, isAdmin }: { children: React.ReactNode; stats?: ChromeStats; isAdmin?: boolean }) {
  const pathname = usePathname() ?? '';
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [pathname]);

  // 라이트/다크 테마 — data-theme 스왑 + localStorage 영속 (tokens.css가 색 자동 스왑)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? (document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null) ?? 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* noop */ }
  };

  const bare = pathname.startsWith('/quote/print') || pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/admin');
  if (bare) return <>{children}</>;

  const label = PAGE_LABEL[pathname] ?? Object.entries(PAGE_LABEL).find(([h]) => h !== '/' && pathname.startsWith(h))?.[1] ?? '';

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="dev-banner px-4 py-1.5 text-center text-xs no-print flex-shrink-0">
        🚧 개발 중 · 프로덕션 데이터 입력 금지 (2026-04-24)
      </div>

      <div className="flex flex-1 min-h-0">
        {drawer && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden no-print" onClick={() => setDrawer(false)} />}

        {/* ─── 사이드바 ─── */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-[264px] flex-shrink-0 bg-[var(--sidebar-bg)] border-r border-slate-200 flex flex-col no-print transform transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto ${drawer ? 'translate-x-0' : '-translate-x-full'}`}>
          <button onClick={() => setDrawer(false)} className="lg:hidden absolute top-3 right-3 p-1.5 rounded-lg text-ink-muted hover:bg-slate-100" aria-label="메뉴 닫기">
            <Icon name="x" className="w-4 h-4" />
          </button>

          <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-[7px] bg-ink text-slate-50 text-[15px] font-bold leading-none flex-shrink-0">코</span>
            <div className="leading-tight">
              <div className="text-[15px] font-bold text-ink tracking-tight">코아스템켐온</div>
              <div className="text-[11px] text-ink-subtle">비임상 통합관리</div>
            </div>
          </Link>

          <nav className="px-3 mt-1 space-y-0.5">
            {NAV.map(({ href, label: l, icon, exact }) => {
              const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-3 h-[38px] px-3 rounded-lg text-[16px] transition-colors ${
                    active ? 'bg-slate-100 text-ink' : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  {active && <span className="absolute left-0 top-[9px] bottom-[9px] w-0.5 rounded-full bg-brand-600" />}
                  <Icon name={icon} className="w-[17px] h-[17px] flex-shrink-0" />
                  {l}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 mt-4">
            <Link href="/quote-v2" className="btn-primary w-full">
              <Icon name="plus" className="w-4 h-4" /> 새 견적 작성
            </Link>
          </div>

          {isAdmin && (
            <Link href="/admin" onClick={() => { document.cookie = 'demoView=admin; path=/; max-age=31536000'; }} className="mx-3 mt-3 flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-[13px] hover:bg-slate-100 transition-colors group">
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-ink text-slate-50 flex-shrink-0"><Icon name="gantt" className="w-[13px] h-[13px]" /></span>
                <span className="leading-tight min-w-0">
                  <span className="block font-semibold text-ink truncate">관리자 콘솔</span>
                  <span className="block text-[11px] text-ink-subtle truncate">전사 조회 · 롤업</span>
                </span>
              </span>
              <Icon name="arrow-right" className="w-4 h-4 text-ink-subtle group-hover:text-brand-600 flex-shrink-0" />
            </Link>
          )}

          <div className="flex-1" />

          {stats && (
            <div className="mx-3 mb-3 rounded-xl bg-slate-100 px-3.5 py-3">
              <div className="eyebrow">시험 항목 마스터</div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-ink tabular-nums tracking-tight">{stats.items}</span>
                <span className="text-[11px] text-ink-subtle">개 · 모달리티 {stats.modalities}종</span>
              </div>
            </div>
          )}

          <UserCard />
        </aside>

        {/* ─── 메인 ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex-shrink-0 h-16 bg-[var(--toolbar-bg)] backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-11 flex items-center justify-between no-print">
            <div className="flex items-center gap-2 text-sm text-ink-muted min-w-0">
              <span className="text-ink-subtle hidden sm:inline">코아스템켐온</span>
              <span className="mx-1.5 text-ink-subtle/60 hidden sm:inline">/</span>
              <span className="font-semibold text-ink truncate">{label}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-ink-subtle flex-shrink-0">
              <span className="inline-flex items-center gap-2"><Icon name="check" className="w-4 h-4 text-emerald-500" /><span className="hidden sm:inline">자동 저장됨</span></span>
              <button onClick={toggleTheme} className="inline-flex items-center justify-center w-8 h-8 rounded-full text-ink-muted hover:bg-slate-100 transition-colors" title={theme === 'dark' ? '라이트 모드' : '다크 모드'} aria-label="테마 전환">
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-[18px] h-[18px]" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-4 sm:px-6 lg:px-11 pt-6 lg:pt-10 pb-24 lg:pb-14">
            <div className="mx-auto max-w-[1180px]">{children}</div>
          </main>
        </div>
      </div>

      {/* ─── 모바일 하단 탭바 ─── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--card)]/95 backdrop-blur border-t border-slate-200 flex no-print" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {BOTTOM_NAV.map(({ href, label: l, icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${active ? 'text-brand-600' : 'text-ink-subtle hover:text-ink'}`}>
              <Icon name={icon} className="w-[22px] h-[22px]" />
              {l}
            </Link>
          );
        })}
        <button onClick={() => setDrawer(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-ink-subtle hover:text-ink transition-colors">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
          더보기
        </button>
      </nav>
    </div>
  );
}

function UserCard() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <div className="h-16" />;
  if (!session) {
    return (
      <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-ink-muted font-bold text-sm flex-shrink-0">데</span>
        <div className="leading-tight min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink truncate">데모 사용자</div>
          <div className="text-[11px] text-ink-subtle truncate">시연 모드 · 로그인 없음</div>
        </div>
      </div>
    );
  }
  const name = session.user?.name ?? '사용자';
  const initial = name.trim().charAt(0) || 'U';
  return (
    <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-2.5">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-ink-muted font-bold text-sm flex-shrink-0">{initial}</span>
      <div className="leading-tight min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink truncate">{name}</div>
        <div className="text-[11px] text-ink-subtle truncate">{(session.user as { role?: string })?.role === 'admin' ? '관리자' : '사용자'}</div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
        title="로그아웃"
        aria-label="로그아웃"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      </button>
    </div>
  );
}
