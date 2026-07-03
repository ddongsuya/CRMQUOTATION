'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ExternalLink, ChevronDown, Loader2, Pencil, Trash2, Plus } from 'lucide-react';
import Icon from '@/components/Icon';
import type { Guideline, ModalityGuideline, DesignRule, KnowledgeDataset } from '@/lib/knowledge';
import { ID_FIELD } from '@/lib/knowledge-schema';
import { toast } from '@/lib/toast';
import { EditorModal, AdminBar } from './_components/KnowledgeAdmin';

type Knowledge = {
  guidelines: Guideline[];
  modalities: ModalityGuideline[];
  designRules: DesignRule[];
  counts: { guidelines: number; modalities: number; designRules: number };
  isAdmin?: boolean;
};

type Tab = 'guidelines' | 'design' | 'modality';

const TAB_DATASET: Record<Tab, KnowledgeDataset> = {
  guidelines: 'guidelines', design: 'designRules', modality: 'modalities',
};

type Rec = Record<string, unknown>;
export type AdminCtx = {
  onEdit: (dataset: KnowledgeDataset, rec: Rec) => void;
  onDelete: (dataset: KnowledgeDataset, rec: Rec) => void;
} | null;

export default function GuidelinesPage() {
  const [data, setData] = useState<Knowledge | null>(null);
  const [tab, setTab] = useState<Tab>('guidelines');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ dataset: KnowledgeDataset; record: Rec | null } | null>(null);

  const load = useCallback(() => {
    fetch('/api/knowledge').then(r => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const isAdmin = !!data?.isAdmin;

  const onDelete = useCallback(async (dataset: KnowledgeDataset, rec: Rec) => {
    const id = String(rec[ID_FIELD[dataset]] ?? '');
    if (!window.confirm(`"${id}" 항목을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      const res = await fetch('/api/knowledge/mutate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataset, op: 'delete', id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success('삭제되었습니다.');
      load();
    } catch (e) {
      toast.error(`삭제 실패: ${e instanceof Error ? e.message : '알 수 없음'}`);
    }
  }, [load]);

  const admin: AdminCtx = isAdmin
    ? { onEdit: (dataset, record) => setEditing({ dataset, record }), onDelete }
    : null;

  if (!data) {
    return (
      <div className="card p-12 text-center text-ink-subtle text-sm">
        <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 가이드라인 불러오는 중…
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'guidelines', label: '가이드라인 사전', count: data.counts.guidelines },
    { id: 'design', label: '시험설계 규칙', count: data.counts.designRules },
    { id: 'modality', label: '모달리티별 가이드라인', count: data.counts.modalities },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">가이드라인</h1>
        <p className="text-subhead text-ink-body mt-2">
          시험 가이드라인 {data.counts.guidelines}종 · 설계규칙 {data.counts.designRules}종 · 모달리티 {data.counts.modalities}종 — 공식 원문 기반, 견적의 근거 자료
        </p>
      </div>

      {isAdmin && <AdminBar onImported={load} />}

      {/* 좌: 카테고리 레일(220) · 우: 내용 */}
      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-5">
        <div className="self-start space-y-3">
          <div className="flex items-center gap-2.5 h-[38px] px-[13px] rounded-lg bg-slate-50 border border-slate-200">
            <Icon name="search" className="w-[15px] h-[15px] text-ink-subtle flex-shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색 (시험명·코드)" className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle outline-none" />
          </div>
          <nav className="space-y-0.5">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'relative w-full flex items-center gap-2.5 h-[38px] px-3 rounded-lg text-[15px] transition-colors',
                  tab === t.id ? 'bg-slate-100 text-ink font-medium' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
                )}
              >
                {tab === t.id && <span className="absolute left-0 top-[9px] bottom-[9px] w-0.5 rounded-full bg-brand-600" />}
                <span className="flex-1 text-left">{t.label}</span>
                <span className="text-[12px] text-ink-subtle tabular-nums">{t.count}</span>
              </button>
            ))}
          </nav>
          {isAdmin && (
            <button onClick={() => setEditing({ dataset: TAB_DATASET[tab], record: null })} className="btn-ghost w-full">
              <Plus className="w-4 h-4" /> 새 항목
            </button>
          )}
        </div>

        <div className="min-w-0">
          {tab === 'guidelines' && <GuidelineList items={data.guidelines} q={q} admin={admin} />}
          {tab === 'design' && <DesignRuleList items={data.designRules} q={q} admin={admin} />}
          {tab === 'modality' && <ModalityList items={data.modalities} q={q} admin={admin} />}
        </div>
      </div>

      {editing && (
        <EditorModal
          dataset={editing.dataset}
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function useFilter<T>(items: T[], q: string, fields: (it: T) => string) {
  return useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(it => fields(it).toLowerCase().includes(s));
  }, [items, q, fields]);
}

/** 카드 우상단 편집/삭제 버튼 (관리자 전용) */
function AdminButtons({ admin, dataset, rec }: { admin: AdminCtx; dataset: KnowledgeDataset; rec: Rec }) {
  if (!admin) return null;
  return (
    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
      <button onClick={() => admin.onEdit(dataset, rec)} className="p-1.5 rounded-lg text-ink-subtle hover:text-brand-600 hover:bg-brand-50" title="수정">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => admin.onDelete(dataset, rec)} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-600 hover:bg-red-50" title="삭제">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function GuidelineList({ items, q, admin }: { items: Guideline[]; q: string; admin: AdminCtx }) {
  const filtered = useFilter(items, q, g => [g.code, g.title_ko, g.title_en, g.category, g.purpose, JSON.stringify(g.checklist), (g.related_tests || []).join(' ')].join(' '));
  // 카테고리별 그룹
  const groups = useMemo(() => {
    const m = new Map<string, Guideline[]>();
    for (const g of filtered) { const k = g.category || '기타'; (m.get(k) ?? m.set(k, []).get(k)!).push(g); }
    return [...m.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      {groups.map(([cat, list]) => (
        <div key={cat}>
          <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">{cat} · {list.length}</div>
          <div className="space-y-2">
            {list.map(g => <GuidelineCard key={g.code} g={g} admin={admin} />)}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <Empty />}
    </div>
  );
}

function GuidelineCard({ g, admin }: { g: Guideline; admin: AdminCtx }) {
  const [open, setOpen] = useState(false);
  const checklist = Object.entries(g.checklist || {}).filter(([k]) => k !== '투여기간_주');
  return (
    <div className="card overflow-hidden">
      <div className="w-full px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50/40 transition-colors">
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill bg-brand-100 text-brand-700 font-mono">{g.code}</span>
            <span className="font-semibold text-ink">{g.title_ko}</span>
            {g.confidence === '원문확인' && <span className="pill bg-emerald-100 text-emerald-700">원문확인</span>}
          </div>
          <div className="text-xs text-ink-muted mt-1 line-clamp-1">{g.purpose}</div>
        </button>
        <div className="flex items-center gap-1">
          <AdminButtons admin={admin} dataset="guidelines" rec={g as unknown as Rec} />
          <button onClick={() => setOpen(o => !o)}>
            <ChevronDown className={clsx('w-4 h-4 text-ink-subtle flex-shrink-0 mt-1 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 animate-slide-up">
          {g.version && <Field label="버전">{g.version}</Field>}
          {g.purpose && <Field label="목적">{g.purpose}</Field>}
          {checklist.length > 0 && (
            <div>
              <div className="label">체크리스트 (요구사항)</div>
              <ul className="space-y-1.5">
                {checklist.map(([k, v]) => (
                  <li key={k} className="text-xs">
                    <span className="font-semibold text-brand-700">{k}</span>
                    <span className="text-ink-muted"> — {String(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {g['함량분석_관련'] && <Field label="함량분석 관련">{g['함량분석_관련']}</Field>}
          {g.related_tests && g.related_tests.length > 0 && (
            <Field label="관련 시험">{g.related_tests.join(', ')}</Field>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <a href={`/catalog?q=${encodeURIComponent(g.related_tests?.[0] ?? g.category ?? g.code)}`} className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
              관련 시험 항목 보기 <ExternalLink className="w-3.5 h-3.5 rotate-90" />
            </a>
            {g.official_url && (
              <a href={g.official_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> 공식 원문 보기
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DesignRuleList({ items, q, admin }: { items: DesignRule[]; q: string; admin: AdminCtx }) {
  const filtered = useFilter(items, q, r => [r.시험, r.별표, r.시험동물, r.투여경로, r.선후행_조건부].join(' '));
  return (
    <div className="space-y-2">
      {filtered.map((r, i) => (
        <details key={i} className="card overflow-hidden group">
          <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-3 hover:bg-slate-50/40">
            <div>
              <span className="font-semibold text-ink">{r.시험}</span>
              <span className="text-[11px] text-ink-subtle ml-2">{r.별표}</span>
            </div>
            <div className="flex items-center gap-1">
              <AdminButtons admin={admin} dataset="designRules" rec={r as unknown as Rec} />
              <ChevronDown className="w-4 h-4 text-ink-subtle group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          <div className="px-4 pb-4 border-t border-slate-100 grid sm:grid-cols-2 gap-3 pt-3 text-xs">
            <Field label="시험동물 (종·마리수)">{r.시험동물}</Field>
            <Field label="투여경로">{r.투여경로}</Field>
            <Field label="투여기간·관찰">{r.투여기간_관찰}</Field>
            <Field label="용량단계">{r.용량단계}</Field>
            <div className="sm:col-span-2"><Field label="선후행·조건부 규칙">{r.선후행_조건부}</Field></div>
            {r.TK && r.TK !== '—' && <Field label="독성동태(TK)">{r.TK}</Field>}
          </div>
        </details>
      ))}
      {filtered.length === 0 && <Empty />}
    </div>
  );
}

function ModalityList({ items, q, admin }: { items: ModalityGuideline[]; q: string; admin: AdminCtx }) {
  const filtered = useFilter(items, q, m => [m.상위분류, m.모달리티, m.하위분류, (m.규제근거 || []).join(' '), m.필수시험구성].join(' '));
  const statusStyle = (s: string) =>
    s === '필요' || s === '필요(스캔)' ? 'bg-red-100 text-red-700'
    : /부분/.test(s) ? 'bg-amber-100 text-amber-800'
    : 'bg-emerald-100 text-emerald-700';
  return (
    <div className="space-y-2">
      {filtered.map((m, i) => (
        <details key={i} className="card overflow-hidden group">
          <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-3 hover:bg-slate-50/40">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-ink">{m.모달리티}</span>
                <span className={clsx('pill', statusStyle(m.상태))}>{m.상태}</span>
              </div>
              <div className="text-[11px] text-ink-subtle mt-0.5">{m.상위분류}{m.하위분류 && m.하위분류 !== '—' ? ` · ${m.하위분류}` : ''}</div>
            </div>
            <div className="flex items-center gap-1">
              <AdminButtons admin={admin} dataset="modalities" rec={m as unknown as Rec} />
              <ChevronDown className="w-4 h-4 text-ink-subtle group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          <div className="px-4 pb-4 border-t border-slate-100 space-y-3 pt-3 text-xs">
            <Field label="규제근거">{(m.규제근거 || []).join(' · ')}</Field>
            <Field label="필수 시험구성">{m.필수시험구성}</Field>
            <Field label="출처">{m.출처}</Field>
          </div>
        </details>
      ))}
      {filtered.length === 0 && <Empty />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-xs text-ink-muted whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function Empty() {
  return <div className="card p-10 text-center text-ink-subtle text-sm">검색 결과가 없습니다.</div>;
}
