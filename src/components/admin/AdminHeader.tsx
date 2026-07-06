'use client';

import { usePathname, useRouter } from 'next/navigation';

export type ScopeOption = { key: string; label: string; scope: string; centerId?: number };

/**
 * 관리자 화면 공통 헤더 — 제목 + 스코프 토글(전체/센터/개인) + 기간 필.
 * 스코프는 URL searchParams(scope/centerId)로 매핑 → 서버 집계 파라미터.
 * 활성 상태는 서버(page searchParams)에서 props로 주입(useSearchParams Suspense 회피).
 */
export default function AdminHeader({
  title, subtitle, centers, period = '2026 상반기', activeScope = 'all', activeCenterId,
}: { title: string; subtitle: string; centers: { id: number; name: string }[]; period?: string; activeScope?: string; activeCenterId?: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin';
  const curScope = activeScope;
  const curCenter = activeCenterId ?? null;

  const options: ScopeOption[] = [
    { key: 'all', label: '전체', scope: 'all' },
    ...centers.map((c) => ({ key: `c${c.id}`, label: c.name, scope: 'center', centerId: c.id })),
    { key: 'me', label: '개인', scope: 'user' },
  ];
  const isActive = (o: ScopeOption) =>
    o.scope === 'all' ? curScope === 'all'
    : o.scope === 'user' ? curScope === 'user'
    : curScope === 'center' && curCenter === String(o.centerId);

  const go = (o: ScopeOption) => {
    const q = new URLSearchParams();
    if (o.scope !== 'all') q.set('scope', o.scope);
    if (o.centerId != null) q.set('centerId', String(o.centerId));
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-[26px] sm:text-[30px] font-bold text-ink tracking-tight flex items-center gap-2.5">
          {title}
          <span className="text-[13px] font-normal text-ink-subtle">{subtitle}</span>
        </h1>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="segmented">
          {options.map((o) => (
            <button key={o.key} onClick={() => go(o)} className={isActive(o) ? 'active' : ''}>
              {o.label}
            </button>
          ))}
        </div>
        <span className="btn-ghost pointer-events-none gap-2">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18"/></svg>
          {period}
        </span>
      </div>
    </div>
  );
}
