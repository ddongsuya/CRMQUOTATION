'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Copy, Trash2, FileText, Printer, Plus, Loader2, Search, Receipt, Clock, Trophy, Coins } from 'lucide-react';
import { toast } from '@/lib/toast';

type QuoteRow = {
  id: number;
  quoteNumber: string;
  projectName: string;
  customerCompany: string | null;
  modality: string;
  status: string;
  grandTotal: number | null;
  currency: string;
  issuedAt: string | null;
  updatedAt: string;
  createdAt: string;
  _count: { items: number };
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT:    'bg-slate-100 text-slate-600',
  ISSUED:   'bg-brand-100 text-brand-700',
  SENT:     'bg-[#e5f3f2] text-[#207a76]',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중', ISSUED: '발행', SENT: '발송', ACCEPTED: '수주', REJECTED: '반려',
};
const FILTERS: [string, string][] = [['ALL', '전체'], ['DRAFT', '작성중'], ['ISSUED', '발행'], ['SENT', '발송'], ['ACCEPTED', '수주'], ['REJECTED', '반려']];
const fmtM = (n: number) => n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(1)}M` : `₩${n.toLocaleString()}`;

export default function QuotesListPage() {
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [q, setQ] = useState('');

  const refresh = () => {
    fetch('/api/quotes').then(r => r.json()).then(d => setQuotes(d.quotes)).catch(e => toast.error(`목록 로딩 실패: ${e.message}`));
  };
  useEffect(refresh, []);

  const duplicate = async (id: number) => {
    const r = await fetch(`/api/quotes/${id}`, { method: 'POST' });
    if (r.ok) { toast.success('복제 완료'); refresh(); } else toast.error('복제 실패');
  };
  const remove = async (id: number, name: string) => {
    if (!confirm(`"${name}" 견적을 삭제하시겠습니까?`)) return;
    const r = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('삭제 완료'); refresh(); } else toast.error('삭제 실패');
  };

  const stats = useMemo(() => {
    const list = quotes ?? [];
    const won = list.filter(x => x.status === 'ACCEPTED');
    return {
      total: list.length,
      inProgress: list.filter(x => ['DRAFT', 'ISSUED', 'SENT'].includes(x.status)).length,
      won: won.length,
      wonRate: list.length ? Math.round(won.length / list.length * 100) : 0,
      wonAmt: won.reduce((s, x) => s + (x.grandTotal ?? 0), 0),
      totalAmt: list.reduce((s, x) => s + (x.grandTotal ?? 0), 0),
    };
  }, [quotes]);

  const filtered = useMemo(() => (quotes ?? []).filter(x =>
    (filter === 'ALL' || x.status === filter) &&
    (!q.trim() || x.quoteNumber.toLowerCase().includes(q.toLowerCase()) || (x.customerCompany ?? '').toLowerCase().includes(q.toLowerCase()) || x.projectName.toLowerCase().includes(q.toLowerCase()))
  ), [quotes, filter, q]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.022em] leading-[1.1]">견적 목록</h1>
          <p className="text-sm text-ink-muted mt-0.5">발행·발송·수주 상태를 한눈에 추적하세요.</p>
        </div>
        <Link href="/quote-v2" className="btn-primary"><Plus className="w-4 h-4" /> 새 견적</Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Receipt className="w-4 h-4" />} label="전체 견적" value={`${stats.total}건`} sub="누적" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="진행 중" value={`${stats.inProgress}건`} sub="작성·발행·발송" />
        <StatCard icon={<Trophy className="w-4 h-4" />} label="수주" value={`${stats.won}건`} sub={`수주율 ${stats.wonRate}%`} />
        <StatCard icon={<Coins className="w-4 h-4" />} label="수주 금액" value={fmtM(stats.wonAmt)} sub={`전체 ${fmtM(stats.totalAmt)}`} invert />
      </div>

      {/* 필터 + 검색 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex flex-wrap gap-1.5">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={clsx('chip', filter === k ? 'chip-active' : 'chip-inactive')}>{l}</button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="견적번호·고객사 검색" className="input pl-9 w-64" />
        </div>
      </div>

      {quotes === null ? (
        <div className="card p-10 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-ink-subtle/40 mb-3" />
          <div className="text-sm text-ink-muted font-medium">{quotes.length === 0 ? '저장된 견적이 없습니다.' : '조건에 맞는 견적이 없습니다.'}</div>
          {quotes.length === 0 && <Link href="/quote-v2" className="btn-primary mt-4 inline-flex"><Plus className="w-4 h-4" /> 첫 견적 작성하기</Link>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50/60 border-b border-slate-200 [&_th]:whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">견적번호</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">프로젝트 / 고객</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted w-28">모달리티</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-ink-muted w-16">항목</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted w-36">합계</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-ink-muted w-20">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted w-28">수정일</th>
                <th className="px-2 py-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(qr => (
                <tr key={qr.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-brand-700">{qr.quoteNumber}</td>
                  <td className="px-4 py-3">
                    <Link href={`/quote/print?id=${qr.id}`} className="font-medium text-ink hover:text-brand-600">{qr.projectName}</Link>
                    {qr.customerCompany && <div className="text-[11px] text-ink-subtle">{qr.customerCompany}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{qr.modality}</td>
                  <td className="px-4 py-3 text-center text-xs tabular-nums text-ink-muted">{qr._count.items}</td>
                  <td className="px-4 py-3 text-right text-amount text-ink tabular-nums">{qr.grandTotal != null ? `${qr.currency === 'USD' ? '$' : '₩'}${qr.grandTotal.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-center"><span className={clsx('pill text-[10px]', STATUS_STYLE[qr.status] ?? 'bg-slate-100')}>{STATUS_LABEL[qr.status] ?? qr.status}</span></td>
                  <td className="px-4 py-3 text-[11px] text-ink-subtle tabular-nums">{new Date(qr.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</td>
                  <td className="px-2 py-3 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <Link href={`/quote/print?id=${qr.id}`} target="_blank" className="p-1.5 rounded hover:bg-slate-100 text-ink-muted hover:text-brand-600 transition-colors" title="PDF 출력"><Printer className="w-3.5 h-3.5" /></Link>
                      <button onClick={() => duplicate(qr.id)} className="p-1.5 rounded hover:bg-slate-100 text-ink-muted hover:text-brand-600 transition-colors" title="복제"><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(qr.id, qr.projectName)} className="p-1.5 rounded hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, invert }: { icon: React.ReactNode; label: string; value: string; sub: string; invert?: boolean }) {
  if (invert) {
    return (
      <div className="rounded-[12px] bg-slate-900 pt-[22px] px-[22px] pb-5 text-white">
        <div className="flex items-center gap-2 text-white/60 mb-3">{icon}<span className="text-[12.5px] font-semibold">{label}</span></div>
        <div className="text-kpi tabular-nums">{value}</div>
        <div className="text-[12.5px] font-semibold text-white/60 mt-2">{sub}</div>
      </div>
    );
  }
  return (
    <div className="card pt-[22px] px-[22px] pb-5">
      <div className="flex items-center gap-2 text-ink-muted mb-3">{icon}<span className="text-[12.5px] font-semibold">{label}</span></div>
      <div className="text-kpi text-ink tabular-nums">{value}</div>
      <div className="text-[12.5px] font-semibold text-ink-muted mt-2">{sub}</div>
    </div>
  );
}
