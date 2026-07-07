'use client';

import { useDrawer } from './DrawerProvider';

/** 회사명 클릭 트리거 — 드로어를 연다. 목록/본문 어디서든 사용. */
export default function CompanyLink({ name, className, children }: { name: string; className?: string; children?: React.ReactNode }) {
  const { openCompany } = useDrawer();
  return (
    <button type="button" onClick={() => openCompany(name)}
      className={className ?? 'text-ink hover:text-brand-600 transition-colors text-left'}
      title="상세 보기">
      {children ?? name}
    </button>
  );
}
