import Link from 'next/link';
import { getViewMode } from '@/lib/admin/view';
import { getCompanyDetail } from '@/lib/admin/aggregate';
import { fmtWon, fmtPct } from '@/lib/admin/format';
import { quoteStatus } from '@/lib/admin/status';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function CustomerDetail({ params }: { params: { name: string } }) {
  await getViewMode();
  const name = decodeURIComponent(params.name);
  const d = await getCompanyDetail(name);
  const s = d.stats;

  return (
    <>
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink mb-4"><Icon name="chevron-left" className="w-4 h-4" /> 고객 관리</Link>

      <div className="flex flex-wrap items-center gap-2.5 mb-1">
        <h1 className="text-[28px] sm:text-[32px] font-bold text-ink tracking-tight">{name}</h1>
        {d.company?.isNewClient && <span className="tag">신규</span>}
        {!d.company && d.prospect && <span className="tag" style={{ background: 'var(--accent-tint)', color: 'var(--accent-press)' }}>잠재고객</span>}
      </div>
      <p className="text-[13px] text-ink-subtle mb-6">{d.company ? `${d.company.owner} · ${d.company.center} · ${d.company.industry ?? '—'}` : '고객사 미등록'}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="누적 수주" value={fmtWon(s.wonAmount)} dark />
        <Stat label="진행 파이프라인" value={fmtWon(s.pipelineAmount)} />
        <Stat label="견적" value={`${s.quoteCount}건`} />
        <Stat label="수주율" value={s.winRate != null ? fmtPct(s.winRate, 0) : '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* 견적 */}
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-ink">견적 {d.quotes.length}</h2>
              <Link href={`/admin/quotes?company=${encodeURIComponent(name)}`} className="link text-[13px]">견적 현황에서 보기 →</Link>
            </div>
            {d.quotes.length ? (
              <table className="w-full">
                <thead><tr className="table-head text-left"><th className="pb-2 font-medium">견적번호</th><th className="pb-2 font-medium">견적명</th><th className="pb-2 font-medium text-right">금액</th><th className="pb-2 font-medium text-right">결론</th></tr></thead>
                <tbody>
                  {d.quotes.map((q) => { const st = quoteStatus(q.status); return (
                    <tr key={q.id} className="table-row">
                      <td className="py-2.5 mono-no text-[12px]">{q.quoteNumber}</td>
                      <td className="py-2.5 text-[13px] text-ink max-w-[280px]"><span className="line-clamp-1" title={q.projectName}>{q.projectName}</span><span className="block text-[11px] text-ink-subtle tabular-nums">{q.sentAt ?? '—'}{q.testStandard ? ` · ${q.testStandard}` : ''}</span></td>
                      <td className="py-2.5 text-[13px] font-semibold text-ink text-right tabular-nums">{fmtWon(q.grandTotal ?? 0)}</td>
                      <td className="py-2.5 text-right"><span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: st.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{q.trackingNote || st.label}</span></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            ) : <p className="text-[13px] text-ink-subtle py-4">견적 없음</p>}
          </div>

          {/* 업무 기록 */}
          {d.reports.length > 0 && (
            <div className="card card-pad">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-ink">업무 기록 {d.reports.length}</h2>
                <Link href="/admin/reports" className="link text-[13px]">일일 업무에서 보기 →</Link>
              </div>
              <div className="space-y-2.5">
                {d.reports.map((r) => (
                  <div key={r.id} className="text-[13px] flex gap-3">
                    <span className="tabular-nums text-ink-muted flex-shrink-0 w-24">{r.date}</span>
                    <span className="text-ink-body">{r.snippet}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* 잠재고객 */}
          {d.prospect && (
            <div className="card card-pad">
              <h2 className="text-[15px] font-semibold text-ink mb-3">잠재 고객 리서치</h2>
              <dl className="space-y-1.5 text-[13px]">
                {d.prospect.pipeline && <RowKV k="파이프라인" v={d.prospect.pipeline} />}
                {d.prospect.stage && <RowKV k="개발단계" v={d.prospect.stage} />}
                {d.prospect.indTarget && <RowKV k="IND 목표" v={d.prospect.indTarget} />}
                {d.prospect.croOutlook && <RowKV k="CRO 전망" v={d.prospect.croOutlook} />}
              </dl>
            </div>
          )}
          {/* 연락처 */}
          {d.company?.contacts?.length ? (
            <div className="card card-pad">
              <h2 className="text-[15px] font-semibold text-ink mb-3">연락처 {d.company.contacts.length}</h2>
              <div className="space-y-2.5">
                {d.company.contacts.map((c, i) => (
                  <div key={i} className="text-[13px]">
                    <span className="font-medium text-ink">{c.name}</span>{c.position && <span className="text-ink-subtle"> · {c.position}</span>}
                    <div className="text-[12px] text-ink-muted">{[c.phone, c.email].filter(Boolean).join('  ·  ') || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {d.company?.memo && (
            <div className="card card-pad"><h2 className="text-[15px] font-semibold text-ink mb-2">메모</h2><p className="text-[13px] text-ink-body leading-relaxed">{d.company.memo}</p></div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`${dark ? 'card-dark' : 'card'} card-pad`}>
      <div className="text-[13px]" style={dark ? { color: 'var(--on-dark-soft)' } : { color: 'var(--muted)' }}>{label}</div>
      <div className="mt-2 text-[26px] font-bold tabular-nums leading-none" style={{ whiteSpace: 'nowrap', color: dark ? 'var(--on-dark)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}
function RowKV({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><dt className="w-20 text-ink-muted flex-shrink-0">{k}</dt><dd className="text-ink-body flex-1">{v}</dd></div>;
}
