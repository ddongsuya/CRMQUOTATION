'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '../Icon';
import { fmtWon, fmtPct } from '@/lib/admin/format';
import { quoteStatus } from '@/lib/admin/status';

type Detail = {
  name: string;
  company: { industry: string | null; memo: string | null; isNewClient: boolean; owner: string; center: string;
    contacts: { name: string; position: string | null; email: string | null; phone: string | null }[] } | null;
  prospect: { id: number; pipeline: string | null; stage: string | null; indTarget: string | null; croOutlook: string | null } | null;
  stats: { wonAmount: number; pipelineAmount: number; quoteCount: number; winRate: number | null };
  quotes: { id: number; quoteNumber: string; sentAt: string | null; projectName: string; grandTotal: number | null; status: string; trackingNote: string | null; testStandard: string | null }[];
  reports: { id: number; date: string; snippet: string }[];
};

export default function CompanyDrawer({ name, onClose }: { name: string | null; onClose: () => void }) {
  const open = name != null;
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) return;
    setLoading(true); setData(null);
    fetch(`/api/admin/detail/company/${encodeURIComponent(name)}`)
      .then((r) => r.json()).then((d) => setData(d)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const s = data?.stats;

  return (
    <>
      <div onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[440px] bg-[var(--card)] border-l border-slate-200 flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}>
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-bold text-ink truncate">{name}</h2>
              {data?.company?.isNewClient && <span className="tag">신규</span>}
              {data && !data.company && data.prospect && <span className="tag" style={{ background: 'var(--accent-tint)', color: 'var(--accent-press)' }}>잠재고객</span>}
            </div>
            {data?.company && <p className="text-[12px] text-ink-subtle mt-0.5">{data.company.owner} · {data.company.center} · {data.company.industry ?? '—'}</p>}
          </div>
          <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="닫기"><Icon name="x" className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {loading && <div className="py-10 text-center text-[13px] text-ink-subtle">불러오는 중…</div>}

          {data && (
            <>
              {/* 통계 */}
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="누적 수주" value={fmtWon(s!.wonAmount)} dark />
                <Stat label="진행 파이프라인" value={fmtWon(s!.pipelineAmount)} />
                <Stat label="견적" value={`${s!.quoteCount}건`} />
                <Stat label="수주율" value={s!.winRate != null ? fmtPct(s!.winRate, 0) : '—'} />
              </div>

              {/* 잠재고객 */}
              {data.prospect && (
                <Section title="잠재 고객 리서치">
                  <div className="space-y-1 text-[13px]">
                    {data.prospect.pipeline && <Row k="파이프라인" v={data.prospect.pipeline} />}
                    {data.prospect.stage && <Row k="개발단계" v={data.prospect.stage} />}
                    {data.prospect.indTarget && <Row k="IND 목표" v={data.prospect.indTarget} />}
                    {data.prospect.croOutlook && <Row k="CRO 전망" v={data.prospect.croOutlook} />}
                  </div>
                </Section>
              )}

              {/* 연락처 */}
              {data.company?.contacts?.length ? (
                <Section title={`연락처 ${data.company.contacts.length}`}>
                  <div className="space-y-2">
                    {data.company.contacts.map((c, i) => (
                      <div key={i} className="text-[13px]">
                        <span className="font-medium text-ink">{c.name}</span>{c.position && <span className="text-ink-subtle"> · {c.position}</span>}
                        <div className="text-[12px] text-ink-muted tabular-nums">{[c.phone, c.email].filter(Boolean).join('  ·  ')}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* 견적 */}
              <Section title={`견적 ${data.quotes.length}`} link={`/admin/quotes?company=${encodeURIComponent(name!)}`}>
                {data.quotes.length ? (
                  <div className="space-y-2">
                    {data.quotes.map((q) => {
                      const st = quoteStatus(q.status);
                      return (
                        <div key={q.id} className="rounded-lg border border-slate-200 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="mono-no text-[12px]">{q.quoteNumber}</span>
                            <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: st.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{q.trackingNote || st.label}</span>
                          </div>
                          <div className="text-[12px] text-ink-body mt-0.5 line-clamp-1" title={q.projectName}>{q.projectName}</div>
                          <div className="flex items-center justify-between mt-1 text-[12px]">
                            <span className="text-ink-subtle tabular-nums">{q.sentAt ?? '—'}{q.testStandard ? ` · ${q.testStandard}` : ''}</span>
                            <span className="font-semibold text-ink tabular-nums">{fmtWon(q.grandTotal ?? 0)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <Empty />}
              </Section>

              {/* 일일보고 언급 */}
              {data.reports.length > 0 && (
                <Section title={`업무 기록 ${data.reports.length}`} link="/admin/reports">
                  <div className="space-y-2">
                    {data.reports.map((r) => (
                      <div key={r.id} className="text-[12px]">
                        <span className="tabular-nums text-ink-muted">{r.date}</span>
                        <span className="text-ink-body"> · {r.snippet}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>

        {/* 푸터 — 전체 페이지 */}
        {name && (
          <div className="px-5 py-3 border-t border-slate-200 flex-shrink-0">
            <Link href={`/admin/customers/${encodeURIComponent(name)}`} onClick={onClose} className="btn-primary w-full">
              전체 페이지로 열기 <Icon name="arrow-right" className="w-4 h-4" />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`${dark ? 'card-dark' : 'card'} px-3 py-2.5`}>
      <div className="text-[11px]" style={dark ? { color: 'var(--on-dark-soft)' } : { color: 'var(--muted)' }}>{label}</div>
      <div className="mt-0.5 text-[18px] font-bold tabular-nums leading-none" style={{ whiteSpace: 'nowrap', color: dark ? 'var(--on-dark)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}
function Section({ title, link, children }: { title: string; link?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="eyebrow">{title}</h3>
        {link && <Link href={link} className="link text-[12px]">전체 보기 →</Link>}
      </div>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><span className="w-20 text-ink-muted flex-shrink-0">{k}</span><span className="text-ink-body flex-1">{v}</span></div>;
}
function Empty() { return <div className="text-[13px] text-ink-subtle">없음</div>; }
