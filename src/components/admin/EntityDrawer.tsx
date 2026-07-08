'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Icon from '../Icon';
import type { Frame } from './DrawerProvider';
import CompanyPanel from './panels/CompanyPanel';
import QuotePanel from './panels/QuotePanel';
import ReportPanel from './panels/ReportPanel';

export default function EntityDrawer({ stack, back, close, showFullPage }: { stack: Frame[]; back: () => void; close: () => void; showFullPage: boolean }) {
  const top = stack[stack.length - 1];
  const open = !!top;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { stack.length > 1 ? back() : close(); } };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, stack.length, back, close]);

  const fullHref = top?.type === 'company' ? `/admin/customers/${encodeURIComponent(top.key)}` : null;

  return (
    <>
      <div onClick={close}
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[460px] bg-[var(--card)] border-l border-slate-200 flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 flex-shrink-0">
          {stack.length > 1
            ? <button onClick={back} className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink"><Icon name="chevron-left" className="w-4 h-4" /> 뒤로</button>
            : <span className="text-[12px] text-ink-subtle">상세</span>}
          <button onClick={close} className="icon-btn" aria-label="닫기"><Icon name="x" className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto">
          {top?.type === 'company' && <CompanyPanel key={`c${top.key}`} name={top.key} />}
          {top?.type === 'quote' && <QuotePanel key={`q${top.key}`} id={top.key} />}
          {top?.type === 'report' && <ReportPanel key={`r${top.key}`} id={top.key} />}
        </div>

        {fullHref && showFullPage && (
          <div className="px-4 py-3 border-t border-slate-200 flex-shrink-0">
            <Link href={fullHref} onClick={close} className="btn-primary w-full">전체 페이지로 열기 <Icon name="arrow-right" className="w-4 h-4" /></Link>
          </div>
        )}
      </aside>
    </>
  );
}
