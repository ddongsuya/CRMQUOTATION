'use client';
import Link from 'next/link';

export function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`${dark ? 'card-dark' : 'card'} px-3 py-2.5`}>
      <div className="text-[11px]" style={dark ? { color: 'var(--on-dark-soft)' } : { color: 'var(--muted)' }}>{label}</div>
      <div className="mt-0.5 text-[18px] font-bold tabular-nums leading-none" style={{ whiteSpace: 'nowrap', color: dark ? 'var(--on-dark)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}
export function Section({ title, link, children }: { title: string; link?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="eyebrow">{title}</h3>
        {link && <Link href={link} className="link text-[12px]">전체 보기 →</Link>}
      </div>
      {children}
    </div>
  );
}
export function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2 text-[13px]"><span className="w-20 text-ink-muted flex-shrink-0">{k}</span><span className="text-ink-body flex-1">{v}</span></div>;
}
export function Loading() { return <div className="py-10 text-center text-[13px] text-ink-subtle">불러오는 중…</div>; }
