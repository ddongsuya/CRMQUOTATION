'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Copy, Trash2, FileText, Printer, Plus, Loader2 } from 'lucide-react';
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
  SENT:     'bg-emerald-100 text-emerald-700',
  ACCEPTED: 'bg-emerald-600 text-white',
  REJECTED: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '임시저장', ISSUED: '발행', SENT: '발송', ACCEPTED: '수주', REJECTED: '실주',
};

export default function QuotesListPage() {
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);

  const refresh = () => {
    fetch('/api/quotes')
      .then(r => r.json())
      .then(d => setQuotes(d.quotes))
      .catch(e => toast.error(`목록 로딩 실패: ${e.message}`));
  };

  useEffect(refresh, []);

  const duplicate = async (id: number) => {
    const r = await fetch(`/api/quotes/${id}`, { method: 'POST' });
    if (r.ok) { toast.success('복제 완료'); refresh(); }
    else toast.error('복제 실패');
  };
  const remove = async (id: number, name: string) => {
    if (!confirm(`"${name}" 견적을 삭제하시겠습니까?`)) return;
    const r = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('삭제 완료'); refresh(); }
    else toast.error('삭제 실패');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">견적 목록</h1>
          <p className="text-sm text-ink-muted mt-0.5">저장된 견적 {quotes?.length ?? 0}건</p>
        </div>
        <Link href="/quote/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          새 견적
        </Link>
      </div>

      {quotes === null ? (
        <div className="card p-10 text-center text-ink-subtle text-sm">
          <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…
        </div>
      ) : quotes.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-ink-subtle/40 mb-3" />
          <div className="text-sm text-ink-muted font-medium">저장된 견적이 없습니다.</div>
          <Link href="/quote/new" className="btn-primary mt-4 inline-flex">
            <Plus className="w-4 h-4" /> 첫 견적 작성하기
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 border-b border-slate-200">
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
              {quotes.map(q => (
                <tr key={q.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-brand-700">{q.quoteNumber}</td>
                  <td className="px-4 py-3">
                    <Link href={`/quote/new?id=${q.id}`} className="font-medium text-ink hover:text-brand-600">
                      {q.projectName}
                    </Link>
                    {q.customerCompany && (
                      <div className="text-[11px] text-ink-subtle">{q.customerCompany}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{q.modality}</td>
                  <td className="px-4 py-3 text-center text-xs tabular-nums text-ink-muted">{q._count.items}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink font-semibold">
                    {q.grandTotal != null ? `${q.currency === 'USD' ? '$' : '₩'}${q.grandTotal.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('pill text-[10px]', STATUS_STYLE[q.status] ?? 'bg-slate-100')}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-ink-subtle tabular-nums">
                    {new Date(q.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <Link
                        href={`/quote/print?id=${q.id}`}
                        target="_blank"
                        className="p-1.5 rounded hover:bg-slate-100 text-ink-muted hover:text-brand-600 transition-colors"
                        title="PDF 출력"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => duplicate(q.id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-ink-muted hover:text-brand-600 transition-colors"
                        title="복제"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(q.id, q.projectName)}
                        className="p-1.5 rounded hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
