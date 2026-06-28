'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Search, Pencil, Trash2, Plus, Loader2, Database, Layers } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ItemEditorModal, ItemAdminBar } from './_components/CatalogAdmin';

type Rec = Record<string, unknown>;
type Catalog = { items: Rec[]; modalities: string[]; isAdmin?: boolean };

const MAX_ROWS = 80;
const fmt = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n.toLocaleString() : '—');

export default function CatalogPage() {
  const [data, setData] = useState<Catalog | null>(null);
  const [q, setQ] = useState('');
  const [modality, setModality] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'priced' | 'unpriced'>('all');
  const [editing, setEditing] = useState<{ record: Rec | null } | null>(null);

  const load = useCallback(() => {
    fetch('/api/test-items').then(r => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

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

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.items.filter(it => {
      if (modality && !(Array.isArray(it.modalityPool) && (it.modalityPool as string[]).includes(modality))) return false;
      if (priceFilter !== 'all') {
        const hasPrice = !!(it.priceMfds || it.priceOecd || it.priceTiers);
        if (priceFilter === 'priced' && !hasPrice) return false;
        if (priceFilter === 'unpriced' && hasPrice) return false;
      }
      if (s) {
        const hay = `${it.testName ?? ''} ${it.category ?? ''} ${it.adminRoute ?? ''} ${it.key ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [data, q, modality, priceFilter]);

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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-brand-500" /> 시험항목·가격 마스터
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            전체 {data.items.length}개 항목 · 견적 엔진의 가격 원천 데이터. 편집은 즉시 견적에 반영됩니다.
          </p>
        </div>
        <Link href="/catalog/modalities" className="btn-ghost text-sm">
          <Layers className="w-4 h-4" /> 모달리티 구성 편집
        </Link>
      </div>

      {isAdmin && <ItemAdminBar onImported={load} />}

      {/* 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색 (시험명·분류·경로·key)" className="input pl-9 w-64" />
          </div>
          <select value={modality} onChange={e => setModality(e.target.value)} className="input">
            <option value="">전체 모달리티</option>
            {data.modalities.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={priceFilter} onChange={e => setPriceFilter(e.target.value as typeof priceFilter)} className="input">
            <option value="all">가격 전체</option>
            <option value="priced">가격 있음</option>
            <option value="unpriced">가격 없음</option>
          </select>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing({ record: null })} className="btn-ghost text-sm">
            <Plus className="w-4 h-4" /> 새 항목
          </button>
        )}
      </div>

      <div className="text-xs text-ink-subtle">
        {filtered.length}개 표시 중{filtered.length > MAX_ROWS ? ` (상위 ${MAX_ROWS}개만 — 검색으로 좁히세요)` : ''}
      </div>

      {/* 테이블 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-ink-muted">
              <tr className="whitespace-nowrap">
                <th className="px-3 py-2.5 text-left font-semibold">시험명</th>
                <th className="px-2 py-2.5 text-left font-semibold w-32">모달리티</th>
                <th className="px-2 py-2.5 text-left font-semibold w-16">경로</th>
                <th className="px-2 py-2.5 text-center font-semibold w-12">주수</th>
                <th className="px-2 py-2.5 text-right font-semibold w-24">MFDS</th>
                <th className="px-2 py-2.5 text-right font-semibold w-24">OECD</th>
                <th className="px-2 py-2.5 text-center font-semibold w-14">종수별</th>
                {isAdmin && <th className="px-2 py-2.5 text-center font-semibold w-16">관리</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((it, i) => {
                const pool = (Array.isArray(it.modalityPool) ? it.modalityPool : []) as string[];
                return (
                  <tr key={String(it.key ?? i)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-ink font-medium">{String(it.testName ?? '')}</td>
                    <td className="px-2 py-2 text-ink-subtle">
                      {pool.length === 0 ? '—' : <span title={pool.join(', ')}>{pool[0]}{pool.length > 1 ? ` +${pool.length - 1}` : ''}</span>}
                    </td>
                    <td className="px-2 py-2 text-ink-subtle">{String(it.adminRoute ?? '—')}</td>
                    <td className="px-2 py-2 text-center text-ink-subtle tabular-nums">{it.studyWeeks != null ? String(it.studyWeeks) : '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(it.priceMfds)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(it.priceOecd)}</td>
                    <td className="px-2 py-2 text-center">{it.priceTiers ? <span className="pill bg-emerald-100 text-emerald-700">tiers</span> : '—'}</td>
                    {isAdmin && (
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditing({ record: it })} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDelete(it)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-3 py-10 text-center text-ink-subtle">검색 결과가 없습니다.</td></tr>
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
