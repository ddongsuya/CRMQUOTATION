'use client';

import { usePathname, useRouter } from 'next/navigation';

export type Chip = { key: string; label: string };

/**
 * 필터 칩(알약) — 활성 ink 반전. URL 파라미터(paramKey)로 매핑, 스코프 등 기존 쿼리는 보존.
 * 활성/현재값은 서버(page)에서 active·carry props로 주입.
 */
export default function FilterChips({ paramKey, chips, active, carry }: {
  paramKey: string; chips: Chip[]; active: string; carry: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const go = (key: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(carry)) if (v) q.set(k, v);
    if (key !== chips[0].key) q.set(paramKey, key); else q.delete(paramKey);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <div className="flex gap-2 flex-wrap">
      {chips.map((c) => (
        <button key={c.key} onClick={() => go(c.key)} className={`chip ${active === c.key ? 'chip-active' : 'chip-inactive'}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
