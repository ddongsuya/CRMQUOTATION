'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Beaker, Home as HomeIcon, FileText, List, LogOut, BookOpen, Database, Plus,
  HelpCircle, CircleDot, Users, NotebookPen, CalendarDays, GanttChartSquare,
} from 'lucide-react';

export type ChromeStats = { items: number; presets: number; blocks: number; modalities: number };

const NAV = [
  { href: '/', label: '홈', icon: HomeIcon, exact: true },
  { href: '/customers', label: '고객 관리', icon: Users },
  { href: '/notes', label: '개인 기록', icon: NotebookPen },
  { href: '/calendar', label: '캘린더', icon: CalendarDays },
  { href: '/gantt', label: '시험 일정', icon: GanttChartSquare },
  { href: '/quotes', label: '견적 목록', icon: List },
  { href: '/guidelines', label: '가이드라인', icon: BookOpen },
  { href: '/catalog', label: '항목·가격', icon: Database },
  { href: '/quote/new', label: '새 견적', icon: FileText },
];

const PAGE_LABEL: Record<string, string> = {
  '/': '대시보드',
  '/customers': '고객 관리',
  '/notes': '개인 기록',
  '/calendar': '캘린더',
  '/gantt': '시험 일정 간트차트',
  '/quotes': '견적 목록',
  '/guidelines': '가이드라인',
  '/catalog': '항목·가격 마스터',
  '/quote/new': '새 견적 작성',
};

/**
 * 앱 셸 — 좌측 사이드바 + 메인(상단바 + 콘텐츠). CHEMON 디자인 레이아웃.
 * `/quote/print` · `/login` 은 자체 레이아웃을 쓰므로 셸을 끈다.
 */
export default function AppChrome({ children, stats }: { children: React.ReactNode; stats?: ChromeStats }) {
  const pathname = usePathname() ?? '';
  const bare = pathname.startsWith('/quote/print') || pathname.startsWith('/login') || pathname.startsWith('/register');
  if (bare) return <>{children}</>;

  const label = PAGE_LABEL[pathname] ?? Object.entries(PAGE_LABEL).find(([h]) => h !== '/' && pathname.startsWith(h))?.[1] ?? '';

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="dev-banner px-4 py-1.5 text-center text-xs no-print flex-shrink-0">
        🚧 개발 중 · 프로덕션 데이터 입력 금지 (2026-04-24)
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ─── 사이드바 ─── */}
        <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col no-print">
          <Link href="/" className="flex items-center gap-2.5 px-5 py-5 group">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm group-hover:shadow-glow transition-shadow">
              <Beaker className="w-5 h-5" />
            </span>
            <div className="leading-tight">
              <div className="text-[10px] tracking-wide uppercase text-ink-subtle font-semibold">코아스템켐온</div>
              <div className="text-[15px] font-bold text-ink">비임상 견적</div>
            </div>
          </Link>

          <nav className="px-3 mt-1 space-y-0.5">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle mb-1.5">메뉴</div>
            {NAV.map(({ href, label: l, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/') || pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-brand-600" />}
                  <Icon className="w-4 h-4" />
                  {l}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 mt-4">
            <Link href="/quote/new" className="btn-primary w-full justify-center py-2.5 text-sm">
              <Plus className="w-4 h-4" /> 새 견적 작성
            </Link>
          </div>

          <div className="flex-1" />

          {stats && (
            <div className="mx-3 mb-3 rounded-xl bg-brand-50/70 border border-brand-100 px-3.5 py-3">
              <div className="text-[11px] font-semibold text-brand-800">시험 항목 마스터</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-brand-700 tabular-nums">{stats.items}</span>
                <span className="text-[11px] text-ink-subtle">개 · 프리셋 {stats.presets}종</span>
              </div>
            </div>
          )}

          <UserCard />
        </aside>

        {/* ─── 메인 ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex-shrink-0 h-14 bg-white/70 backdrop-blur border-b border-slate-200/70 px-6 flex items-center justify-between no-print">
            <div className="text-sm text-ink-muted">
              <span className="text-ink-subtle">코아스템켐온</span>
              <span className="mx-1.5 text-ink-subtle/60">/</span>
              <span className="font-semibold text-ink">{label}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-ink-subtle">
              <span className="inline-flex items-center gap-1.5">
                <CircleDot className="w-3.5 h-3.5 text-emerald-500" /> 자동 저장됨
              </span>
              <span className="inline-flex items-center gap-1 text-ink-muted">
                <HelpCircle className="w-3.5 h-3.5" /> 도움말
              </span>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-6 py-7">
            <div className="mx-auto max-w-[1280px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function UserCard() {
  const { data: session, status } = useSession();
  // ⚠️ DEMO(임시): 로그인 OFF — 세션 없을 때 로그인 링크 대신 데모 표시.
  if (status === 'loading') return <div className="h-16" />;
  if (!session) {
    return (
      <div className="border-t border-slate-200/70 px-4 py-3 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex-shrink-0">데</span>
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
    <div className="border-t border-slate-200/70 px-4 py-3 flex items-center gap-2.5">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex-shrink-0">
        {initial}
      </span>
      <div className="leading-tight min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink truncate">{name}</div>
        <div className="text-[11px] text-ink-subtle truncate">{(session.user as { role?: string })?.role === 'admin' ? '관리자' : '사용자'}</div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
        title="로그아웃"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
