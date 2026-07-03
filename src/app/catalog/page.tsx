'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Pencil, Trash2, Plus, Loader2, Layers } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { ItemEditorModal, ItemAdminBar } from './_components/CatalogAdmin';

type Rec = Record<string, unknown>;
type Catalog = { items: Rec[]; modalities: string[]; isAdmin?: boolean };

const MAX_ROWS = 80;
const fmt = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n.toLocaleString() : '—');

export default function CatalogPage() {
  const [data, setData] = useState<Catalog | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');                             // 분류 필터 ('' = 전체)
  const [submit, setSubmit] = useState<'MFDS' | 'OECD'>('MFDS');   // 제출처(단가 기준)
  const [editing, setEditing] = useState<{ record: Rec | null } | null>(null);

  const load = useCallback(() => {
    fetch('/api/test-items').then(r => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  // 가이드라인 등에서 ?q= 로 진입 시 초기 검색어
  useEffect(() => { const p = new URLSearchParams(window.location.search).get('q'); if (p) setQ(p); }, []);

  const isAdmin = !!data?.isAdmin;

  const onDelete = useCallback(async (rec: Rec) => {
    const key = String(rec.key ?? '');
    if (!window.confirm(`"${String(rec.testName ?? key)}" 항목을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      const res = await fetch('/api/test-items/mutate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'delete', key }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success('삭제되었습니다.');
      load();
    } catch (e) {
      toast.error(`삭제 실패: ${e instanceof Error ? e.message : '알 수 없음'}`);
    }
  }, [load]);

  // 분류(category)별 개수 — 필터칩용 (많은 순)
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    (data?.items ?? []).forEach(it => { const c = String(it.category ?? '기타'); m.set(c, (m.get(c) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const priceOf = useCallback((it: Rec) => (submit === 'MFDS' ? it.priceMfds : it.priceOecd), [submit]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.items.filter(it => {
      if (cat && String(it.category ?? '') !== cat) return false;
      if (s) {
        const hay = `${it.testName ?? ''} ${it.category ?? ''} ${it.adminRoute ?? ''} ${it.key ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    }).sort((a, b) => (Number(submit === 'MFDS' ? b.priceMfds : b.priceOecd) || 0) - (Number(submit === 'MFDS' ? a.priceMfds : a.priceOecd) || 0));  // 금액 큰 순
  }, [data, q, cat, submit]);

  if (!data) {
    return (
      <div className="card p-12 text-center text-ink-subtle text-sm">
        <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 시험항목 불러오는 중…
      </div>
    );
  }

  const shown = filtered.slice(0, MAX_ROWS);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">항목·가격 카탈로그</h1>
          <p className="text-subhead text-ink-body mt-2">
            {data.items.length}개 시험 항목의 MFDS·OECD 단가 마스터. 편집은 즉시 견적에 반영됩니다.
          </p>
        </div>
        {/* 제출처 세그먼트 — 단가 기준 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="segmented inline-flex gap-[3px] p-[3px] rounded-lg bg-slate-100">
            {(['MFDS', 'OECD'] as const).map(s => (
              <button key={s} onClick={() => setSubmit(s)} className={clsx('px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors', submit === s ? 'bg-[var(--card)] text-ink' : 'text-ink-muted hover:text-ink')}>{s}</button>
            ))}
          </div>
          <Link href="/catalog/modalities" className="btn-ghost"><Layers className="w-4 h-4" /> 모달리티 구성 편집</Link>
        </div>
      </div>

      {isAdmin && <ItemAdminBar onImported={load} />}

      {/* 분류 필터칩 + 검색 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCat('')} className={clsx('chip', cat === '' ? 'chip-active' : 'chip-inactive')}>전체 <span className="tabular-nums opacity-70">{data.items.length}</span></button>
          {catCounts.map(([c, n]) => (
            <button key={c} onClick={() => setCat(c)} className={clsx('chip', cat === c ? 'chip-active' : 'chip-inactive')}>{c} <span className="tabular-nums opacity-70">{n}</span></button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 h-[38px] px-[13px] rounded-lg bg-slate-50 border border-slate-200 w-56">
            <Icon name="search" className="w-[15px] h-[15px] text-ink-subtle flex-shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="시험명·분류 검색" className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle outline-none" />
          </div>
          {isAdmin && <button onClick={() => setEditing({ record: null })} className="btn-ghost"><Plus className="w-4 h-4" /> 새 항목</button>}
        </div>
      </div>

      <div className="text-[12px] text-ink-subtle">
        표시 {Math.min(filtered.length, MAX_ROWS)}건 · {submit === 'MFDS' ? '국내 식약처(MFDS)' : '해외(OECD)'} 제출 기준 단가 · 금액 큰 순{filtered.length > MAX_ROWS ? ` (상위 ${MAX_ROWS}개)` : ''}
      </div>

      {/* 테이블 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="whitespace-nowrap text-[12px] font-medium text-ink-subtle">
                <th className="px-6 py-[14px] text-left font-medium">시험 항목</th>
                <th className="px-3 py-[14px] text-left font-medium w-36">분류</th>
                <th className="px-3 py-[14px] text-center font-medium w-20">투여경로</th>
                <th className="px-3 py-[14px] text-center font-medium w-14">기간</th>
                <th className="px-3 py-[14px] text-right font-medium w-32">단가 ({submit})</th>
                {isAdmin && <th className="px-3 py-[14px] text-center font-medium w-16">관리</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((it, i) => {
                const pool = (Array.isArray(it.modalityPool) ? it.modalityPool : []) as string[];
                return (
                  <tr key={String(it.key ?? i)} className="border-t border-[var(--hairline-soft)] hover:bg-slate-100 group/row">
                    <td className="px-6 py-[13px] text-[14px] font-medium text-ink">
                      <Link href={`/quote-v2${pool[0] ? `?category=${encodeURIComponent(pool[0])}` : ''}`} className="hover:text-brand-600" title="이 항목으로 견적 마법사 열기">{String(it.testName ?? '')}</Link>
                    </td>
                    <td className="px-3 py-[13px] text-[16px] text-ink">{String(it.category ?? '—')}</td>
                    <td className="px-3 py-[13px] text-center text-[13px] text-ink-muted">{String(it.adminRoute ?? '—')}</td>
                    <td className="px-3 py-[13px] text-center text-[13px] text-ink-muted tabular-nums">{it.studyWeeks != null ? `${it.studyWeeks}주` : '—'}</td>
                    <td className="px-3 py-[13px] text-right text-[15px] font-medium text-ink tabular-nums">
                      {fmt(priceOf(it))}{it.priceTiers ? <span className="tag ml-1.5 align-middle">종수별</span> : ''}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-[13px]">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => setEditing({ record: it })} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-slate-100" title="수정"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDelete(it)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-3 py-10 text-center text-ink-subtle">검색 결과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ItemEditorModal
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
