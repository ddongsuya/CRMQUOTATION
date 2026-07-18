'use client';

import { usePathname, useRouter } from 'next/navigation';

export type ScopeOption = { key: string; label: string; scope: string; centerId?: number };

/**
 * 관리자 화면 공통 헤더 — 제목 + 스코프 토글(전체/센터/개인) + 기간 필.
 * 스코프는 URL searchParams(scope/centerId)로 매핑 → 서버 집계 파라미터.
 * 활성 상태는 서버(page searchParams)에서 props로 주입(useSearchParams Suspense 회피).
 */
export type PeriodInfo = { key: string; label: string; year: number };

export default function AdminHeader({
  title, subtitle, centers, period, activeScope = 'all', activeCenterId,
}: { title: string; subtitle: string; centers: { id: number; name: string }[]; period?: PeriodInfo; activeScope?: string; activeCenterId?: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin';
  const curScope = activeScope;
  const curCenter = activeCenterId ?? null;

  // 스코프를 보존한 채 기간(period)만 교체
  const goPeriod = (pkey: string) => {
    const q = new URLSearchParams();
    if (curScope !== 'all') q.set('scope', curScope);
    if (curCenter != null) q.set('centerId', curCenter);
    q.set('period', pkey);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const periodOptions = period
    ? [
        { key: `${period.year}H1`, label: '상반기' },
        { key: `${period.year}H2`, label: '하반기' },
        { key: `${period.year}`, label: '연간' },
      ]
    : [];

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
        {period ? (
          <div className="segmented">
            {periodOptions.map((o) => (
              <button key={o.key} onClick={() => goPeriod(o.key)} className={period.key === o.key ? 'active' : ''}>
                {o.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
