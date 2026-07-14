'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { useDrawer } from '@/components/admin/DrawerProvider';

type QuoteRow = {
  id: number;
  quoteNumber: string;
  projectName: string;
  customerCompany: string | null;
  studyType: string;
  modality: string;
  status: string;
  grandTotal: number | null;
  currency: string;
  issuedAt: string | null;
  updatedAt: string;
  createdAt: string;
  _count: { items: number };
};

// 상태점 색(components.css)
const STATUS_DOT: Record<string, string> = {
  DRAFT: 'var(--muted-soft)', ISSUED: 'var(--accent)', SENT: 'var(--status-sent)', ACCEPTED: 'var(--success)', REJECTED: 'var(--error)',
};
const STATUS_LABEL: Record<string, string> = { DRAFT: '작성중', ISSUED: '발행', SENT: '발송', ACCEPTED: '수주', REJECTED: '반려' };
const FILTERS: [string, string][] = [['ALL', '전체'], ['DRAFT', '작성중'], ['ISSUED', '발행'], ['SENT', '발송'], ['ACCEPTED', '수주'], ['REJECTED', '반려']];
const fmtM = (n: number) => n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(1)}M` : (n > 0 ? `₩${n.toLocaleString()}` : '₩0');

export default function QuotesListPage() {
  const { openCompany } = useDrawer();
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [filter, setFilter] = useState('ALL');

  const refresh = () => {
    fetch('/api/quotes').then(r => r.json()).then(d => setQuotes(d.quotes)).catch(e => toast.error(`목록 로딩 실패: ${e.message}`));
  };
  useEffect(refresh, []);

  const remove = async (id: number, name: string) => {
    if (!confirm(`"${name}" 견적을 삭제하시겠습니까?`)) return;
    const r = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('삭제 완료'); refresh(); } else toast.error('삭제 실패');
  };
  const duplicate = async (id: number) => {
    const r = await fetch(`/api/quotes/${id}`, { method: 'POST' });
    if (r.ok) { toast.success('복제 완료'); refresh(); } else toast.error('복제 실패');
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
    };
  }, [quotes]);

  const filtered = useMemo(() => (quotes ?? []).filter(x => filter === 'ALL' || x.status === filter), [quotes, filter]);

  return (
    <div className="animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">견적 목록</h1>
          <p className="text-subhead text-ink-body mt-2">발행·발송·수주 상태를 한눈에 추적하세요.</p>
        </div>
        <Link href="/quote/start" className="btn-primary"><Icon name="plus" className="w-4 h-4" /> 새 견적 작성</Link>
      </div>

      {/* 통계 4카드 — 아이콘 없음, 수주 금액 블랙 반전(#000) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="전체 견적" value={`${stats.total}`} unit="건" note="누적" />
        <StatCard label="진행 중" value={`${stats.inProgress}`} unit="건" note="작성·발행·발송" />
        <StatCard label="수주" value={`${stats.won}`} unit="건" note={`수주율 ${stats.wonRate}%`} />
        <StatCard label="수주 금액" value={fmtM(stats.wonAmt)} note="누적 수주" invert />
      </div>

      {/* 상태 필터칩 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={clsx('chip', filter === k ? 'chip-active' : 'chip-inactive')}>{l}</button>
        ))}
      </div>

      {/* 테이블 */}
      {quotes === null ? (
        <div className="card p-10 text-center text-ink-subtle text-sm">불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-sm text-ink-muted font-medium">{quotes.length === 0 ? '저장된 견적이 없습니다.' : '조건에 맞는 견적이 없습니다.'}</div>
          {quotes.length === 0 && <Link href="/quote/start" className="btn-primary mt-4 inline-flex"><Icon name="plus" className="w-4 h-4" /> 첫 견적 작성하기</Link>}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {/* 헤더 */}
              <div className="flex items-center px-6 py-[14px] text-[12px] font-medium text-ink-subtle">
                <div className="w-[132px] flex-shrink-0">견적번호</div>
                <div className="flex-1 min-w-0">고객사 · 모달리티</div>
                <div className="w-[84px] flex-shrink-0">상태</div>
                <div className="w-[84px] flex-shrink-0 text-right">작성일</div>
                <div className="w-[120px] flex-shrink-0 text-right">금액</div>
              </div>
              {/* 행 */}
              {filtered.map(qr => (
                <div key={qr.id} className="group relative flex items-center px-6 py-[15px] border-t border-[var(--hairline-soft)] hover:bg-slate-100 transition-colors">
                  <Link href={`/quote/print?id=${qr.id}`} className="flex items-center flex-1 min-w-0">
                    <div className="w-[132px] flex-shrink-0 text-[13px] font-medium text-brand-600 font-mono tabular-nums whitespace-nowrap">{qr.quoteNumber}</div>
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="text-[16px] text-ink truncate">{qr.customerCompany || qr.projectName}</div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="pill flex-shrink-0" style={qr.studyType === 'efficacy'
                          ? { background: 'var(--accent-tint)', color: 'var(--accent-press)' }
                          : { background: 'var(--card-cream)', color: 'var(--muted)' }}>
                          {qr.studyType === 'efficacy' ? '효력' : '독성'}
                        </span>
                        <span className="text-[12px] text-ink-subtle truncate">{qr.modality}</span>
                      </div>
                    </div>
                    <div className="w-[84px] flex-shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-body">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[qr.status] ?? 'var(--muted-soft)' }} />
                      {STATUS_LABEL[qr.status] ?? qr.status}
                    </div>
                    <div className="w-[84px] flex-shrink-0 text-right text-[12.5px] text-ink-subtle tabular-nums">{new Date(qr.updatedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</div>
                    <div className="w-[120px] flex-shrink-0 text-right text-[19px] font-bold text-ink tabular-nums">{qr.grandTotal != null ? `${qr.currency === 'USD' ? '$' : ''}${qr.currency === 'USD' ? qr.grandTotal.toLocaleString() : fmtM(qr.grandTotal)}` : '—'}</div>
                  </Link>
                  {/* hover 액션 — 대기 상태는 시안과 동일, hover 시에만 노출 */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-slate-100 rounded-lg px-1 py-0.5">
                    {qr.customerCompany && <button onClick={() => openCompany(qr.customerCompany!)} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600" title="고객 상세"><Icon name="users" className="w-3.5 h-3.5" /></button>}
                    <Link href={`/quote/print?id=${qr.id}`} target="_blank" className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600" title="PDF 출력"><Icon name="arrow-right" className="w-3.5 h-3.5" /></Link>
                    <button onClick={() => duplicate(qr.id)} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-brand-600" title="복제"><Icon name="plus" className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(qr.id, qr.projectName)} className="p-1.5 rounded hover:bg-white text-ink-muted hover:text-red-600" title="삭제"><Icon name="x" className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, note, invert }: { label: string; value: string; unit?: string; note?: string; invert?: boolean }) {
  const box = invert ? 'bg-slate-900 text-white' : 'card';
  const labelC = invert ? 'text-white/85' : 'text-ink-muted';
  const numC = invert ? 'text-white' : 'text-ink';
  const noteC = invert ? 'text-white/72' : 'text-ink-muted';
  return (
    <div className={`${box} rounded-[12px] px-[22px] py-5`}>
      <div className={`text-[13px] font-medium ${labelC}`}>{label}</div>
      <div className="flex items-baseline gap-1.5 mt-2.5">
        <span className={`text-stat tabular-nums ${numC}`}>{value}</span>
        {unit && <span className={`text-[14px] ${labelC}`}>{unit}</span>}
      </div>
      {note && <div className={`text-[13px] font-medium mt-1.5 ${noteC}`}>{note}</div>}
    </div>
  );
}
