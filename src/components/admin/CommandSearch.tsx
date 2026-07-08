'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { quoteStatus } from '@/lib/admin/status';

type Results = {
  companies: { name: string; industry: string | null }[];
  quotes: { id: number; quoteNumber: string; customerCompany: string | null; projectName: string; status: string; trackingNote: string | null }[];
  reports: { id: number; date: string; snippet: string }[];
};
const EMPTY: Results = { companies: [], quotes: [], reports: [] };

export default function CommandSearch({ openCompany, openQuote, openReport }: {
  openCompany: (n: string) => void; openQuote: (id: number) => void; openReport: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Results>(EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('admin:opensearch', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('admin:opensearch', onOpen); };
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); else { setQ(''); setRes(EMPTY); } }, [open]);

  useEffect(() => {
    if (!q.trim()) { setRes(EMPTY); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setRes).catch(() => setRes(EMPTY));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;
  const pick = (fn: () => void) => { fn(); setOpen(false); };
  const total = res.companies.length + res.quotes.length + res.reports.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 bg-black/40" onClick={() => setOpen(false)}>
      <div className="w-full max-w-[560px] card overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-200">
          <Icon name="search" className="w-4 h-4 text-ink-subtle flex-shrink-0" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="회사·견적번호·업무 기록 검색…"
            className="flex-1 h-12 bg-transparent text-[14px] outline-none placeholder:text-ink-subtle" />
          <kbd className="text-[11px] text-ink-subtle border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-auto py-2">
          {q.trim() && total === 0 && <div className="py-8 text-center text-[13px] text-ink-subtle">결과 없음</div>}
          {!q.trim() && <div className="py-8 text-center text-[13px] text-ink-subtle">회사명·견적번호·업무 내용으로 검색하세요.</div>}

          {res.companies.length > 0 && <Group label="고객사">
            {res.companies.map((c) => (
              <Item key={c.name} onClick={() => pick(() => openCompany(c.name))} icon="users" title={c.name} sub={c.industry ?? ''} />
            ))}
          </Group>}

          {res.quotes.length > 0 && <Group label="견적">
            {res.quotes.map((qr) => {
              const st = quoteStatus(qr.status);
              return <Item key={qr.id} onClick={() => pick(() => openQuote(qr.id))} icon="list"
                title={`${qr.quoteNumber} · ${qr.customerCompany ?? ''}`} sub={qr.projectName}
                right={<span className="text-[11px]" style={{ color: st.color }}>{qr.trackingNote || st.label}</span>} />;
            })}
          </Group>}

          {res.reports.length > 0 && <Group label="업무 기록">
            {res.reports.map((r) => (
              <Item key={r.id} onClick={() => pick(() => openReport(r.id))} icon="notebook" title={r.date} sub={r.snippet} />
            ))}
          </Group>}
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="px-2 pb-1"><div className="eyebrow px-2 py-1">{label}</div>{children}</div>;
}
function Item({ icon, title, sub, right, onClick }: { icon: 'users' | 'list' | 'notebook'; title: string; sub?: string; right?: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors text-left">
      <Icon name={icon} className="w-4 h-4 text-ink-subtle flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink font-medium truncate">{title}</div>
        {sub && <div className="text-[11px] text-ink-subtle truncate">{sub}</div>}
      </div>
      {right}
    </button>
  );
}
