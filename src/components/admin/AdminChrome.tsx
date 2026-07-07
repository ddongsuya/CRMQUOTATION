'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon, { type IconName } from '../Icon';
import DrawerProvider from './DrawerProvider';

export type AdminUser = { name: string; roleLabel: string; scopeLabel: string };

// 관리자 콘솔 nav — README §Screens 6종 + 설정. 활성 = 크림 배경 + 좌측 오렌지 바.
const MANAGE: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/admin', label: '대시보드', icon: 'bar-chart', exact: true },
  { href: '/admin/analytics', label: '실적 분석', icon: 'trending-up' },
  { href: '/admin/customers', label: '고객 관리', icon: 'users' },
  { href: '/admin/prospects', label: '잠재 고객', icon: 'search' },
  { href: '/admin/schedule', label: '시험 일정', icon: 'gantt' },
  { href: '/admin/quotes', label: '견적 현황', icon: 'list' },
  { href: '/admin/reports', label: '일일 업무', icon: 'notebook' },
];
const ORG: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/members', label: '구성원 관리', icon: 'users' },
  { href: '/admin/settings', label: '설정', icon: 'settings' },
];

/** 관리자 콘솔 셸 — 전용 사이드바(관리·조직) + 본부장 카드. /admin/* 전용. */
export default function AdminChrome({ children, user }: { children: React.ReactNode; user: AdminUser }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [pathname]);

  // 라이트/다크 — AppChrome 과 동일 규약(localStorage 'theme' + data-theme)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* noop */ }
  };

  // 데모 role 토글 — "일반 사용자로 보기": demoView=user 쿠키 후 홈으로.
  const switchToUser = () => {
    document.cookie = `demoView=user; path=/; max-age=31536000`;
    router.push('/');
    router.refresh();
  };

  const initial = user.name.trim().charAt(0) || '관';
  const NavLink = ({ href, label, icon, exact }: { href: string; label: string; icon: IconName; exact?: boolean }) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        className={`relative flex items-center gap-3 h-[38px] px-3 rounded-lg text-[14px] transition-colors ${
          active ? 'bg-slate-100 text-ink font-medium' : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
        }`}
      >
        {active && <span className="absolute left-0 top-[9px] bottom-[9px] w-0.5 rounded-full bg-brand-600" />}
        <Icon name={icon} className="w-[17px] h-[17px] flex-shrink-0" />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="dev-banner px-4 py-1.5 text-center text-xs no-print flex-shrink-0">
        🚧 개발 중 · 관리자 콘솔(데모) · 프로덕션 데이터 입력 금지
      </div>

      <div className="flex flex-1 min-h-0">
        {drawer && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden no-print" onClick={() => setDrawer(false)} />}

        {/* ─── 관리자 사이드바 ─── */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-[264px] flex-shrink-0 bg-[var(--sidebar-bg)] border-r border-slate-200 flex flex-col no-print transform transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto ${drawer ? 'translate-x-0' : '-translate-x-full'}`}>
          <button onClick={() => setDrawer(false)} className="lg:hidden absolute top-3 right-3 p-1.5 rounded-lg text-ink-muted hover:bg-slate-100" aria-label="메뉴 닫기">
            <Icon name="x" className="w-4 h-4" />
          </button>

          <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-[8px] bg-ink text-slate-50 text-[15px] font-bold leading-none flex-shrink-0">코</span>
            <div className="leading-tight">
              <div className="text-[15px] font-bold text-ink tracking-tight">켐온 사업개발본부</div>
              <div className="eyebrow mt-0.5">Admin Console</div>
            </div>
          </Link>

          <nav className="px-3 mt-1 space-y-3 overflow-y-auto flex-1">
            <div>
              <div className="px-3 pb-1.5 eyebrow">관리</div>
              <div className="space-y-0.5">
                {MANAGE.map((n) => <NavLink key={n.href} {...n} />)}
              </div>
            </div>
            <div>
              <div className="px-3 pb-1.5 eyebrow">조직</div>
              <div className="space-y-0.5">
                {ORG.map((n) => <NavLink key={n.href} {...n} />)}
              </div>
            </div>
          </nav>

          {/* 유틸 — 테마 · 사용자 뷰 전환 */}
          <div className="px-3 py-2 flex items-center gap-2 border-t border-slate-200">
            <button onClick={toggleTheme} className="icon-btn" title={theme === 'dark' ? '라이트 모드' : '다크 모드'} aria-label="테마 전환">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-[17px] h-[17px]" />
            </button>
            <button onClick={switchToUser} className="btn-ghost flex-1 justify-center h-9">
              <Icon name="arrow-right" className="w-4 h-4" /> 사용자 뷰로 전환
            </button>
          </div>

          {/* 본부장 카드 */}
          <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink text-slate-50 font-bold text-sm flex-shrink-0">{initial}</span>
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink truncate">{user.name} {user.roleLabel}</div>
              <div className="text-[11px] text-ink-subtle truncate">{user.scopeLabel}</div>
            </div>
          </div>
        </aside>

        {/* ─── 메인 ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 모바일 상단 바(햄버거) — 데스크톱에선 숨김 */}
          <header className="lg:hidden flex-shrink-0 h-14 bg-[var(--toolbar-bg)] border-b border-slate-200 px-4 flex items-center justify-between no-print">
            <button onClick={() => setDrawer(true)} className="icon-btn" aria-label="메뉴 열기">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
            <span className="text-sm font-semibold text-ink">관리자 콘솔</span>
            <button onClick={toggleTheme} className="icon-btn" aria-label="테마 전환"><Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-[17px] h-[17px]" /></button>
          </header>

          <main className="flex-1 overflow-auto px-4 sm:px-6 lg:px-11 pt-6 lg:pt-9 pb-16">
            <div className="mx-auto max-w-[1180px]"><DrawerProvider>{children}</DrawerProvider></div>
          </main>
        </div>
      </div>
    </div>
  );
}
