'use client';

import { Beaker } from 'lucide-react';

export type PrintData = {
  meta: {
    quoteNo: string;
    issuedAt: Date;
    validUntilDays: number;
  };
  project: {
    projectName: string;
    substanceName: string;
    modality: string;
    customerCompany: string;
    customerName: string;
    customerEmail: string;
  };
  settings: {
    priceStandard: 'MFDS' | 'OECD';
    currency: 'KRW' | 'USD';
    discountRate: number;
    excipientCount: number;
  };
  lines: Array<{
    kind: 'test' | 'analysis' | 'prep_analysis';
    testName: string;
    adminRoute: string | null;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    note?: string;
    testItemKey?: string;
    breakdown?: Array<{ label: string; weeks: number | null; count: number; quantity: number }>;
    excipientCount?: number;
    guidelineCodes?: string[];   // 근거 가이드라인 (지식베이스 연결)
  }>;
  totals: {
    totalBeforeDiscount: number;
    discountAmount: number;
    totalAfterDiscount: number;
    vatAmount: number;
    grandTotal: number;
  };
  warnings: string[];
  details: Array<{
    key: string;
    testName?: string;
    category?: string | null;
    adminRoute?: string | null;
    studyWeeks?: number | null;
    detail?: string | null;
    notice?: string | null;
    quoteText?: string | null;
    guideline?: string | null;
    missing?: boolean;
  }>;
};

export default function PrintLayout({ data }: { data: PrintData }) {
  const symbol = data.settings.currency === 'USD' ? '$' : '₩';
  const fmt = (n: number) => `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const issuedStr = data.meta.issuedAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const validUntil = new Date(data.meta.issuedAt.getTime() + data.meta.validUntilDays * 86400_000);
  const validUntilStr = validUntil.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  // Get detail entries that have at least one descriptive field, in the same order as quote lines.
  const lineDetails = data.lines
    .filter(l => l.kind === 'test' && l.testItemKey)
    .map(l => {
      const d = data.details.find(x => x.key === l.testItemKey);
      return { line: l, detail: d };
    })
    .filter(({ detail }) => detail && (detail.detail || detail.notice || detail.quoteText || detail.guideline));
  const detailPages = paginateDetails(lineDetails);

  return (
    <div className="print-doc print-root font-sans text-ink">
      {/* ─────────── PAGE 1: COVER ─────────── */}
      <section className="page cover">
        <div className="cover-band">
          <div className="cover-band-inner">
            <div className="cover-brand">
              <span className="cover-logo">
                <Beaker className="w-5 h-5" />
              </span>
              <div>
                <div className="cover-brand-name">Corestemchemon</div>
                <div className="cover-brand-sub">Enterprise placing human and life at the top</div>
              </div>
            </div>
            <div className="cover-quote-no">{data.meta.quoteNo}</div>
          </div>
        </div>

        <div className="cover-body">
          <div className="cover-eyebrow">비임상시험 견적서</div>
          <h1 className="cover-title">{data.project.projectName || '(프로젝트명 미입력)'}</h1>
          {data.project.substanceName && (
            <div className="cover-substance">시험물질 · {data.project.substanceName}</div>
          )}

          <div className="cover-meta-grid">
            <MetaBlock label="고객사">{data.project.customerCompany || '—'}</MetaBlock>
            <MetaBlock label="담당자">{[data.project.customerName, data.project.customerEmail].filter(Boolean).join(' · ') || '—'}</MetaBlock>
            <MetaBlock label="모달리티">{data.project.modality}</MetaBlock>
            <MetaBlock label="가격 기준">{data.settings.priceStandard}</MetaBlock>
            <MetaBlock label="견적 발행일">{issuedStr}</MetaBlock>
            <MetaBlock label="유효기간">{validUntilStr} 까지</MetaBlock>
          </div>

          <div className="cover-grand">
            <div className="cover-grand-label">견적 합계 (VAT 포함)</div>
            <div className="cover-grand-value">{fmt(data.totals.grandTotal)}</div>
          </div>

          <div className="cover-foot">
            <div className="cover-foot-block">
              <div className="cover-foot-label">발행</div>
              <div className="cover-foot-value">㈜코아스템켐온</div>
              <div className="cover-foot-sub">대한민국 · 비임상 CRO</div>
            </div>
            <div className="cover-foot-block">
              <div className="cover-foot-label">결재</div>
              <div className="cover-sign-row">
                <div className="cover-sign-box">담당</div>
                <div className="cover-sign-box">검토</div>
                <div className="cover-sign-box">승인</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── PAGE 2: 견적 ─────────── */}
      <section className="page page-break">
        <PageHeader title="견적 명세" quoteNo={data.meta.quoteNo} pageNum={2} />

        {data.warnings.length > 0 && (
          <div className="warn-box">
            <div className="warn-title">⚠ 확인 필요</div>
            <ul>{data.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        <table className="quote-table">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>No.</th>
              <th>시험 항목</th>
              <th style={{ width: '8%' }}>경로</th>
              <th style={{ width: '14%' }} className="num">단가</th>
              <th style={{ width: '6%' }} className="num">수량</th>
              <th style={{ width: '16%' }} className="num">소계</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i} className={l.kind === 'analysis' || l.kind === 'prep_analysis' ? 'analysis-row' : ''}>
                <td className="num muted">{i + 1}</td>
                <td>
                  <div className="line-name">
                    {l.kind === 'analysis' && <span className="badge-analysis">분석</span>}
                    {l.kind === 'prep_analysis' && <span className="badge-analysis badge-prep">조제물</span>}
                    {l.testName}
                  </div>
                  {l.kind === 'analysis' && l.breakdown && l.breakdown.length > 0 ? (
                    <ul className="analysis-breakdown">
                      {l.breakdown.map((b, j) => (
                        <li key={j}>
                          ({j + 1}) {b.label} : {b.count}회{b.quantity > 1 ? ` × ${b.quantity}수량` : ''}
                        </li>
                      ))}
                      {typeof l.excipientCount === 'number' && l.excipientCount > 0 && (
                        <li className="multiplier">
                          × 부형제 {l.excipientCount}종 = 총 {l.quantity}회
                        </li>
                      )}
                    </ul>
                  ) : l.note ? (
                    <div className="line-note">{l.note}</div>
                  ) : null}
                  {l.guidelineCodes && l.guidelineCodes.length > 0 && (
                    <div className="guideline-codes">
                      {l.guidelineCodes.map(c => (
                        <span key={c} className="gl-code">{c}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td>{l.adminRoute || '—'}</td>
                <td className="num">{l.unitPrice === 0 && l.kind === 'test' ? <span className="negotiate">협의</span> : l.unitPrice.toLocaleString()}</td>
                <td className="num">{l.quantity}</td>
                <td className="num strong">{l.subtotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-block">
          <TotalRow label="소계" value={fmt(data.totals.totalBeforeDiscount)} />
          {data.settings.discountRate > 0 && (
            <TotalRow label={`할인 (${(data.settings.discountRate * 100).toFixed(1)}%)`} value={`- ${fmt(data.totals.discountAmount)}`} muted />
          )}
          <TotalRow label="할인 후" value={fmt(data.totals.totalAfterDiscount)} />
          <TotalRow label="VAT (10% 별도)" value={fmt(data.totals.vatAmount)} muted />
          <div className="totals-divider" />
          <div className="totals-grand">
            <span>총 합계 (VAT 포함)</span>
            <span className="num">{fmt(data.totals.grandTotal)}</span>
          </div>
        </div>

        <div className="terms">
          <h3>견적 조건</h3>
          <ul>
            <li>가격 기준 — {data.settings.priceStandard === 'MFDS' ? '식품의약품안전처 (MFDS) 기준' : 'OECD 가이드라인 기준'}</li>
            <li>통화 — {data.settings.currency === 'KRW' ? '대한민국 원 (KRW)' : '미국 달러 (USD)'}</li>
            <li>부형제 종수 — {data.settings.excipientCount}종 (함량분석 단위 산정 기준)</li>
            <li>VAT — 위 금액에 별도 10% 부가가치세 부과</li>
            <li>유효기간 — 발행일로부터 {data.meta.validUntilDays}일 ({validUntilStr})</li>
            <li>지급 조건 — 시험 착수 시 50% · 종료 시 50% (별도 합의 시 조정 가능)</li>
            <li>&quot;협의&quot; 표시 항목 — 시험 사양 확정 후 별도 산정</li>
          </ul>
        </div>
      </section>

      {/* ─────────── PAGE 3+: 항목별 상세 ─────────── */}
      {/* 상세는 A4 페이지 단위로 분할 — 화면도 인쇄처럼 페이지별로 보이고, 카드는 페이지 경계서 안 잘림 */}
      {detailPages.map((pageItems, p) => {
        const startNo = detailPages.slice(0, p).reduce((s, pg) => s + pg.length, 0);
        return (
          <section className="page page-break" key={`det-${p}`}>
            <PageHeader title={`시험 항목 상세 안내${detailPages.length > 1 ? ` (${p + 1}/${detailPages.length})` : ''}`} quoteNo={data.meta.quoteNo} pageNum={3 + p} />
            <div className="details-list">
              {pageItems.map(({ line, detail }, j) => (
                <DetailCard key={j} line={line} detail={detail} no={startNo + j + 1} symbol={symbol} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type DetailEntry = PrintData['details'][number];
type LineEntry = PrintData['lines'][number];

/** 상세 카드 높이(mm) 추정 → A4(가용 ~230mm) 단위로 묶어 페이지 분할 */
function paginateDetails(lineDetails: { line: LineEntry; detail?: DetailEntry }[]): { line: LineEntry; detail?: DetailEntry }[][] {
  const textMm = (s?: string | null) => (s ? 7 + Math.ceil(s.length / 95) * 4.6 : 0);
  const estMm = (d?: DetailEntry) => 16 + textMm(d?.quoteText) + textMm(d?.detail) + textMm(d?.guideline) + textMm(d?.notice) + 6;
  const pages: { line: LineEntry; detail?: DetailEntry }[][] = [];
  let cur: { line: LineEntry; detail?: DetailEntry }[] = [];
  let h = 0;
  for (const ld of lineDetails) {
    const ch = estMm(ld.detail);
    if (cur.length && h + ch > 230) { pages.push(cur); cur = []; h = 0; }
    cur.push(ld); h += ch;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

function DetailCard({ line, detail, no, symbol }: { line: LineEntry; detail?: DetailEntry; no: number; symbol: string }) {
  return (
    <article className="detail-card">
      <header className="detail-head">
        <div className="detail-no">{String(no).padStart(2, '0')}</div>
        <div>
          <h3 className="detail-title">{line.testName}</h3>
          <div className="detail-subtitle">
            {[detail?.category, line.adminRoute, detail?.studyWeeks ? `${detail.studyWeeks}주` : null].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <div className="detail-price">{line.unitPrice === 0 ? '협의' : `${symbol}${line.unitPrice.toLocaleString()}`}</div>
      </header>
      {detail?.quoteText && (
        <div className="detail-block"><div className="detail-block-label">시험 개요</div><p className="detail-text">{detail.quoteText}</p></div>
      )}
      {detail?.detail && detail.detail !== detail?.quoteText && (
        <div className="detail-block"><div className="detail-block-label">상세 설명</div><p className="detail-text">{detail.detail}</p></div>
      )}
      {(detail?.guideline || (line.guidelineCodes && line.guidelineCodes.length > 0)) && (
        <div className="detail-block">
          <div className="detail-block-label">가이드라인</div>
          {line.guidelineCodes && line.guidelineCodes.length > 0 && (
            <div className="guideline-codes">{line.guidelineCodes.map(c => <span key={c} className="gl-code">{c}</span>)}</div>
          )}
          {detail?.guideline && <p className="detail-text small">{detail.guideline}</p>}
        </div>
      )}
      {detail?.notice && (
        <div className="detail-block notice"><div className="detail-block-label">주의사항 · 협의</div><p className="detail-text small">{detail.notice}</p></div>
      )}
    </article>
  );
}

function MetaBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="meta-block">
      <div className="meta-label">{label}</div>
      <div className="meta-value">{children}</div>
    </div>
  );
}

function PageHeader({ title, quoteNo, pageNum }: { title: string; quoteNo: string; pageNum: number }) {
  return (
    <header className="page-head">
      <div className="page-head-left">
        <div className="page-head-brand">㈜코아스템켐온 · CHEMON</div>
        <div className="page-head-title">{title}</div>
      </div>
      <div className="page-head-right">
        <div>{quoteNo}</div>
        <div className="page-num">p. {pageNum}</div>
      </div>
    </header>
  );
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`totals-row ${muted ? 'muted' : ''}`}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
