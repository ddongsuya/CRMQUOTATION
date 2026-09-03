'use client';

/**
 * 전역 검색(Ctrl/⌘+K) — 고객사·의뢰자·견적·안건·기록·할 일. /api/search 결과의 href 로 바로 이동한다.
 * 헤더의 검색 버튼(AppChrome)과 단축키 둘 다 `app:opensearch` 이벤트로 연다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2, User, FileText, Briefcase, StickyNote, CheckSquare, Loader2 } from 'lucide-react';
import { label, QUOTE_STATUS, DEAL_STAGE } from '@/lib/labels';

type Hit = { kind: 'company' | 'contact' | 'quote' | 'deal' | 'note' | 'task'; id: number; title: string; sub: string; href: string; status?: string | null };

const GROUP: Record<Hit['kind'], { label: string; Icon: typeof Search }> = {
  company: { label: '고객사', Icon: Building2 },
  contact: { label: '의뢰자', Icon: User },
  quote: { label: '견적', Icon: FileText },
  deal: { label: '안건', Icon: Briefcase },
  note: { label: '기록', Icon: StickyNote },
  task: { label: '할 일', Icon: CheckSquare },
};
const ORDER: Hit['kind'][] = ['company', 'contact', 'quote', 'deal', 'note', 'task'];

export const OPEN_SEARCH_EVENT = 'app:opensearch';

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_SEARCH_EVENT, onOpen); };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(''); setHits([]); setSel(0); setLoading(false); setError(false); }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) { setHits([]); setLoading(false); setError(false); return; }
    setLoading(true); setError(false);
    const my = ++reqId.current;
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((d) => { if (my === reqId.current) { setHits(d.hits ?? []); setSel(0); setLoading(false); } })
        .catch((e) => { console.error('[search]', e); if (my === reqId.current) { setHits([]); setError(true); setLoading(false); } });
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const rows = useMemo(() => ORDER.flatMap((k) => hits.filter((h) => h.kind === k)), [hits]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel, rows]);

  if (!open) return null;

  const go = (h: Hit) => { setOpen(false); router.push(h.href); };
  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => (i + 1) % rows.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => (i - 1 + rows.length) % rows.length); }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); go(rows[sel]); }
  };
  const statusOf = (h: Hit) => h.kind === 'quote' ? label(QUOTE_STATUS, h.status) : h.kind === 'deal' ? label(DEAL_STAGE, h.status) : null;

  let idx = -1;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4 bg-black/40" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="전역 검색" className="w-full max-w-[600px] card overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-200">
          <Search className="w-4 h-4 text-ink-subtle flex-shrink-0" aria-hidden="true" />
          <label htmlFor="global-search-input" className="sr-only">검색어</label>
          <input id="global-search-input" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
            placeholder="고객사 · 담당자 · 견적번호 · 안건 · 기록 · 할 일"
            role="combobox" aria-expanded={rows.length > 0} aria-controls="global-search-list" aria-activedescendant={rows[sel] ? `gs-${rows[sel].kind}-${rows[sel].id}` : undefined}
            className="flex-1 h-12 bg-transparent text-[14px] outline-none placeholder:text-ink-subtle" autoComplete="off" />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" aria-label="검색 중" />}
          <kbd className="text-[11px] text-ink-subtle border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div ref={listRef} id="global-search-list" role="listbox" className="max-h-[56vh] overflow-auto py-2">
          {!q.trim() && <div className="py-8 text-center text-[13px] text-ink-subtle">이름·번호·내용 일부만 입력해도 찾습니다. ↑↓ 이동 · Enter 열기</div>}
          {q.trim() && !loading && error && <div role="alert" className="py-8 text-center text-[13px]" style={{ color: 'var(--error)' }}>검색에 실패했습니다. 잠시 후 다시 시도해 주세요.</div>}
          {q.trim() && !loading && !error && rows.length === 0 && <div className="py-8 text-center text-[13px] text-ink-subtle">&quot;{q}&quot; 에 해당하는 항목이 없습니다.</div>}
          {ORDER.map((k) => {
            const group = hits.filter((h) => h.kind === k);
            if (!group.length) return null;
            const { label: gl, Icon } = GROUP[k];
            return (
              <div key={k} className="px-2 pb-1">
                <div className="eyebrow px-2 pt-2 pb-1">{gl}</div>
                {group.map((h) => {
                  idx += 1; const i = idx; const st = statusOf(h);
                  return (
                    <button key={`${h.kind}-${h.id}`} id={`gs-${h.kind}-${h.id}`} type="button" role="option" aria-selected={i === sel} data-selected={i === sel}
                      onMouseEnter={() => setSel(i)} onClick={() => go(h)}
                      className={`w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-md ${i === sel ? 'bg-slate-100' : ''}`}>
                      <Icon className="w-4 h-4 text-ink-subtle flex-shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] text-ink truncate">{h.title}</span>
                        <span className="block text-[12px] text-ink-muted truncate">{h.sub}</span>
                      </span>
                      {st && <span className="text-[11px] text-ink-subtle flex-shrink-0">{st}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
