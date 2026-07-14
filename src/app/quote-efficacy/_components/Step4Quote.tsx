'use client';

import { fmt, DOSE_FREQ } from '@/lib/efficacy-engine/constants';
import type { CostItem } from '@/lib/efficacy-engine/engine';
import type { StudyModel } from '@/lib/efficacy-engine/models';
import { dosingWeeks, groupTotal, totalAnimalsOf, totalDaysOf, type EffState, type QuoteTotals } from '../_lib/state';

/** 카테고리별 상세 카드 정의 — DC catGroups 그대로. */
const CAT_GROUPS = [
  { key: '질환유발모델', title: '질환 유발 모델', desc: '질환 병태 재현을 위한 유발 처치' },
  { key: '조직병리', title: '조직병리 분석', desc: 'H&E·특수염색·IHC 및 병리 판독' },
  { key: '행동평가', title: '행동·기능 평가', desc: '행동학적 기능 지표 측정' },
  { key: '영상', title: '영상 분석', desc: 'MRI/CT/초음파 등 영상 촬영·분석' },
  { key: '항암', title: '항암 세포 실험', desc: '세포주 배양 및 종양 이식' },
];

export default function Step4Quote({
  s, m, items, total, q, quoteNo, issueDate,
}: {
  s: EffState; m: StudyModel; items: CostItem[]; total: number; q: QuoteTotals;
  quoteNo: string; issueDate: string;
}) {
  const totalDays = totalDaysOf(s.schedule);
  const totalWeeks = Math.ceil(totalDays / 7);
  const totalAnimals = totalAnimalsOf(s.groups);
  const modelTitle = m.title.replace(/^[IVX]+-\d+\.\s*/, '');
  const freqLabel = (DOSE_FREQ.find((f) => f.key === s.params.freq) ?? DOSE_FREQ[0]).label;
  const animalDesc = `${s.params.strain} ${s.params.ageWeeks}주령${s.params.vendor ? ` (${s.params.vendor})` : ''}`;
  const groupDesc = s.groups.map((g) => {
    const t = groupTotal(g);
    return g.subs.length > 1 ? `${g.tag} ${t}(${g.subs.map((x) => x.n).join('+')})` : `${g.tag} ${t}`;
  }).join(', ') + ` = 총 ${totalAnimals}마리`;
  const endpointList = s.endpoints.map((e) => e.name).join(', ') || '-';

  const coverMeta: [string, string][] = [
    ['고객사', s.client.org || '—'],
    ['담당자', [s.client.name, s.client.email].filter(Boolean).join(' · ') || '—'],
    ['시험계', animalDesc],
    ['시험기간', `${totalWeeks}주 (보고 ${m.reportWeeks}주 별도)`],
    ['견적 발행일', issueDate],
    ['유효기간', '발행일 +60일'],
  ];

  const totalRows: [string, string, string][] = [
    ['소계', `₩${fmt(total)}`, 'var(--muted)'],
    [`영업이익 (${(s.margin * 100).toFixed(0)}%)`, `+ ₩${fmt(q.marginAmt)}`, 'var(--muted-soft)'],
    [`할인 (${(s.discount * 100).toFixed(0)}%)`, `- ₩${fmt(q.discAmt)}`, 'var(--muted-soft)'],
    ['VAT (10%)', `+ ₩${fmt(q.vatAmt)}`, 'var(--muted-soft)'],
  ];

  const terms = [
    '가격 기준 — 코아스템켐온 비임상 효력시험 표준 단가',
    `동물 · 시험계 — ${animalDesc} / ${s.groups.length}군 · 총 ${totalAnimals}마리`,
    `투여 — ${s.params.route} · ${freqLabel}`,
    'VAT — 위 금액에 별도 10% 부가가치세 부과',
    '유효기간 — 발행일로부터 60일',
    '지급 조건 — 시험 착수 시 50% · 종료 시 50% (별도 합의 시 조정 가능)',
  ];

  const catAmt: Record<string, number> = {};
  items.forEach((it) => { catAmt[it.category] = (catAmt[it.category] || 0) + it.subtotal; });

  const detailCards: { no: string; title: string; subtitle: string; price: string; blocks: React.ReactNode }[] = [];
  detailCards.push({
    no: '01', title: modelTitle, subtitle: `효력시험 · ${animalDesc} · ${totalWeeks}주`, price: `₩${fmt(total)}`,
    blocks: (
      <>
        <Block label="시험 개요">
          <Spec rows={[['동물종', animalDesc], ['군구성', groupDesc], ['투여', `${dosingWeeks(s.schedule)} · ${s.params.route} · ${freqLabel}`], ['유발방법', s.params.induction || 'N/A']]} />
        </Block>
        <Block label="시험 목적">
          <p className="m-0 leading-relaxed">{modelTitle} 모델에서 시험물질의 효력을 평가한다. 유발대조군 대비 시험군의 개선 정도를 지표별로 비교하여 유효성을 검증한다.</p>
        </Block>
        <Block label="시험 설계 · 평가항목">
          <Spec rows={[['양성대조', m.positiveControl || 'N/A'], ['시험기간', `${totalWeeks}주 + 보고서 ${m.reportWeeks}주`], ['평가항목', endpointList]]} />
        </Block>
      </>
    ),
  });
  let no = 2;
  CAT_GROUPS.forEach((cg) => {
    if (!catAmt[cg.key]) return;
    const rows = items.filter((it) => it.category === cg.key).map((it) => [it.name.length > 18 ? it.name.slice(0, 18) : it.name, `₩${fmt(it.subtotal)}`] as [string, string]);
    detailCards.push({
      no: String(no).padStart(2, '0'), title: cg.title, subtitle: `${cg.key} · ${rows.length}개 항목`, price: `₩${fmt(catAmt[cg.key])}`,
      blocks: (
        <>
          <Block label="설명"><p className="m-0 leading-relaxed">{cg.desc}</p></Block>
          <Block label="포함 항목"><Spec rows={rows} /></Block>
        </>
      ),
    });
    no++;
  });

  return (
    <div className="print-doc print-root">
      {/* PAGE 1 · 표지 */}
      <section className="page cover">
        <div className="cover-band">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-[42px] h-[42px] rounded-[11px]" style={{ background: '#191919', color: '#fff' }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3.5L4.5 15A3 3 0 0 0 7.3 19h9.4a3 3 0 0 0 2.8-4L16 6.5V3M7 3h10M6.5 13h11" /></svg>
            </span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#191919' }}>㈜코아스템켐온 · CHEMON</div>
              <div style={{ fontFamily: "'Roboto Mono',monospace", fontSize: 8.5, letterSpacing: '.1em', color: '#a39e98', textTransform: 'uppercase' }}>
                Non-clinical CRO · Placing human and life at the top
              </div>
            </div>
          </div>
          <span style={{ fontFamily: "'Roboto Mono',monospace", fontSize: 11, padding: '5px 12px', borderRadius: 9999, background: '#f1f1ef', color: '#615d59' }}>{quoteNo}</span>
        </div>

        <div className="cover-body">
          <div className="cover-eyebrow">QUOTATION · 견적서</div>
          <h1 className="cover-title">{modelTitle}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#615d59' }}>시험 유형 · 비임상 효력시험 (Efficacy Study)</p>

          <div className="cover-meta-grid" style={{ marginTop: 26 }}>
            {coverMeta.map(([label, value], i) => (
              <div key={label} style={{ padding: '14px 16px', borderTop: i < 2 ? 'none' : '1px solid #e6e6e6', borderLeft: i % 2 === 0 ? 'none' : '1px solid #e6e6e6' }}>
                <div style={{ fontFamily: "'Roboto Mono',monospace", fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a39e98', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#191919' }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="cover-grand" style={{ marginTop: 22 }}>
            <div>
              <div style={{ fontFamily: "'Roboto Mono',monospace", fontSize: 9, letterSpacing: '.1em', color: 'rgba(255,255,255,.72)', textTransform: 'uppercase' }}>견적 합계 · VAT 포함</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>₩{fmt(q.vat)}</div>
          </div>

          <div className="cover-foot" style={{ marginTop: 26 }}>
            <div style={{ fontSize: 11, color: '#615d59' }}>발행일 · {issueDate}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['담당', '검토', '승인'].map((r) => (
                <div key={r} style={{ width: 68, height: 54, border: '1px solid #e6e6e6', borderRadius: 6, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4, fontSize: 9, color: '#a39e98' }}>{r}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PAGE 2 · 견적 명세 */}
      <section className="page page-break">
        <PageHeader title="견적 명세" pageNum={2} quoteNo={quoteNo} />
        <table className="quote-table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>No</th>
              <th>시험 항목</th>
              <th style={{ width: 60 }}>계수</th>
              <th style={{ width: 82 }}>단가</th>
              <th style={{ width: 52 }}>수량</th>
              <th style={{ width: 96 }}>소계</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <td style={{ textAlign: 'center', color: '#a39e98' }}>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 600, color: '#191919' }}>{it.name}</div>
                  <div style={{ fontSize: 9, color: '#a39e98' }}>{it.category}</div>
                </td>
                <td style={{ textAlign: 'center' }}>{it.multiplier > 1 ? `×${it.multiplier}` : '—'}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(it.unitPrice)}</td>
                <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{it.quantity}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-block">
          {totalRows.map(([label, value, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 11, color }}>
              <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, marginTop: 5, borderTop: '2px solid #191919' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#191919' }}>총 합계 (VAT 포함)</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#191919', fontVariantNumeric: 'tabular-nums' }}>₩{fmt(q.vat)}</span>
          </div>
        </div>

        <div className="terms">
          <div style={{ fontFamily: "'Roboto Mono',monospace", fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a39e98', marginBottom: 6 }}>견적 조건</div>
          <ul style={{ margin: 0, paddingLeft: 14 }}>
            {terms.map((t) => <li key={t} style={{ fontSize: 10, color: '#615d59', lineHeight: 1.7 }}>{t}</li>)}
          </ul>
        </div>
      </section>

      {/* PAGE 3 · 시험 항목 상세 */}
      <section className="page page-break">
        <PageHeader title="시험 항목 상세" pageNum={3} quoteNo={quoteNo} />
        <div className="details-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {detailCards.map((d) => (
            <div key={d.no} style={{ border: '1px solid #e6e6e6', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: '#191919', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto Mono',monospace", fontSize: 11, fontWeight: 700 }}>{d.no}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#191919' }}>{d.title}</div>
                  <div style={{ fontSize: 10, color: '#a39e98' }}>{d.subtitle}</div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#191919', fontVariantNumeric: 'tabular-nums' }}>{d.price}</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>{d.blocks}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PageHeader({ title, pageNum, quoteNo }: { title: string; pageNum: number; quoteNo: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 9, marginBottom: 14, borderBottom: '1px solid #e6e6e6' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#191919' }}>{title}</div>
      <div style={{ fontFamily: "'Roboto Mono',monospace", fontSize: 9, color: '#a39e98' }}>{quoteNo} · p.{pageNum}</div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "'Roboto Mono',monospace", fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a39e98', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: '#31302e' }}>{children}</div>
    </div>
  );
}

function Spec({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 8 }}>
          <span style={{ width: 62, flexShrink: 0, color: '#a39e98' }}>{k}</span>
          <span style={{ flex: 1, color: '#31302e' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
