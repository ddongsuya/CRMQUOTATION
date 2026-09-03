'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import { quoteStatus } from '@/lib/admin/status';

type Results = {
  companies: { name: string; industry: string | null }[];
  quotes: { id: number; quoteNumber: string; customerCompany: string | null; projectName: string; status: string; trackingNote: string | null }[];
  reports: { id: number; date: string; snippet: string }[];
};
const EMPTY: Results = { companies: [], quotes: [], reports: [] };

/** 평탄화된 결과 한 줄 — ↑↓ 키보드 이동·Enter 실행의 단위. */
type Row =
  | { kind: 'company'; key: string; title: string; sub: string; run: () => void }
  | { kind: 'quote'; key: string; title: string; sub: string; status: string; note: string | null; run: () => void }
  | { kind: 'report'; key: string; title: string; sub: string; run: () => void };

export default function CommandSearch({ openCompany, openQuote, openReport }: {
  openCompany: (n: string) => void; openQuote: (id: number) => void; openReport: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);   // 느린 이전 응답이 최신 결과를 덮지 않게 하는 순번

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

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(''); setRes(EMPTY); setSel(0); setLoading(false); }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) { setRes(EMPTY); setLoading(false); return; }
    setLoading(true);
    const my = ++reqId.current;
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => { if (my === reqId.current) { setRes(d); setSel(0); setLoading(false); } })
        .catch(() => { if (my === reqId.current) { setRes(EMPTY); setLoading(false); } });
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (fn: () => void) => { fn(); setOpen(false); };

  // 화면 순서(고객사 → 견적 → 업무 기록)와 동일하게 평탄화 — 인덱스가 곧 ↑↓ 순서.
  const rows = useMemo<Row[]>(() => [
    ...res.companies.map((c): Row => ({ kind: 'company', key: `c${c.name}`, title: c.name, sub: c.industry ?? '', run: () => openCompany(c.name) })),
    ...res.quotes.map((qr): Row => ({
      kind: 'quote', key: `q${qr.id}`, title: `${qr.quoteNumber} · ${qr.customerCompany ?? ''}`, sub: qr.projectName,
      status: qr.status, note: qr.trackingNote, run: () => openQuote(qr.id),
    })),
    ...res.reports.map((r): Row => ({ kind: 'report', key: `r${r.id}`, title: r.date, sub: r.snippet, run: () => openReport(r.id) })),
  ], [res, openCompany, openQuote, openReport]);

  // 선택 항목이 목록 밖으로 나가면 스크롤 추종
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel, rows]);

  if (!open) return null;

  /** 입력창 키 처리 — ↑↓ 이동, Enter 실행. (한글 입력 조합 중에는 Enter 무시) */
  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => (i + 1) % rows.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => (i - 1 + rows.length) % rows.length); }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); pick(rows[sel].run); }
  };

  const total = rows.length;
  const idxOf = (kind: Row['kind'], key: string) => rows.findIndex((r) => r.kind === kind && r.key === key);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 bg-black/40" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="통합 검색" className="w-full max-w-[560px] card overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-200">
          <Icon name="search" className="w-4 h-4 text-ink-subtle flex-shrink-0" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
            placeholder="회사·견적번호·업무 기록 검색…" aria-label="검색어"
            className="flex-1 h-12 bg-transparent text-[14px] outline-none placeholder:text-ink-subtle" />
          {loading && <span className="text-[11px] text-ink-subtle">검색 중…</span>}
          <kbd className="text-[11px] text-ink-subtle border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-auto py-2">
          {q.trim() && !loading && total === 0 && <div className="py-8 text-center text-[13px] text-ink-subtle">결과 없음</div>}
          {!q.trim() && <div className="py-8 text-center text-[13px] text-ink-subtle">회사명·견적번호·업무 내용으로 검색하세요.</div>}

          {res.companies.length > 0 && <Group label="고객사">
            {res.companies.map((c) => {
              const i = idxOf('company', `c${c.name}`);
              return <Item key={c.name} selected={i === sel} onMouseEnter={() => setSel(i)}
                onClick={() => pick(() => openCompany(c.name))} icon="users" title={c.name} sub={c.industry ?? ''} />;
            })}
          </Group>}

          {res.quotes.length > 0 && <Group label="견적">
            {res.quotes.map((qr) => {
              const st = quoteStatus(qr.status);
              const i = idxOf('quote', `q${qr.id}`);
              return <Item key={qr.id} selected={i === sel} onMouseEnter={() => setSel(i)}
                onClick={() => pick(() => openQuote(qr.id))} icon="list"
                title={`${qr.quoteNumber} · ${qr.customerCompany ?? ''}`} sub={qr.projectName}
                right={<span className="text-[11px]" style={{ color: st.color }}>{qr.trackingNote || st.label}</span>} />;
            })}
          </Group>}

          {res.reports.length > 0 && <Group label="업무 기록">
            {res.reports.map((r) => {
              const i = idxOf('report', `r${r.id}`);
              return <Item key={r.id} selected={i === sel} onMouseEnter={() => setSel(i)}
                onClick={() => pick(() => openReport(r.id))} icon="notebook" title={r.date} sub={r.snippet} />;
            })}
          </Group>}
        </div>

        {total > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-200 text-[11px] text-ink-subtle">
            <span><kbd className="border border-slate-200 rounded px-1">↑</kbd> <kbd className="border border-slate-200 rounded px-1">↓</kbd> 이동</span>
            <span><kbd className="border border-slate-200 rounded px-1">Enter</kbd> 열기</span>
            <span className="ml-auto tabular-nums">{total}건</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="px-2 pb-1"><div className="eyebrow px-2 py-1">{label}</div>{children}</div>;
}
function Item({ icon, title, sub, right, onClick, selected, onMouseEnter }: {
  icon: 'users' | 'list' | 'notebook'; title: string; sub?: string; right?: React.ReactNode;
  onClick: () => void; selected?: boolean; onMouseEnter?: () => void;
}) {
  return (
    <button onClick={onClick} onMouseEnter={onMouseEnter} data-selected={selected ? 'true' : 'false'}
      className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors text-left ${selected ? 'bg-slate-100' : 'hover:bg-slate-100'}`}>
      <Icon name={icon} className="w-4 h-4 text-ink-subtle flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink font-medium truncate">{title}</div>
        {sub && <div className="text-[11px] text-ink-subtle truncate">{sub}</div>}
      </div>
      {right}
    </button>
  );
}
