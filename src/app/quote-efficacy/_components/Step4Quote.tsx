'use client';

import PrintLayout, { type PrintData } from '@/app/quote/print/_components/PrintLayout';
import '@/app/quote/print/print.css';
import { DOSE_FREQ } from '@/lib/efficacy-engine/constants';
import type { CostItem } from '@/lib/efficacy-engine/engine';
import type { StudyModel } from '@/lib/efficacy-engine/models';
import { dosingWeeks, groupTotal, totalAnimalsOf, totalDaysOf, type EffState, type QuoteTotals } from '../_lib/state';

/** 상세 카드를 붙일 카테고리 — 시안의 catGroups. 각 카테고리의 첫 라인에 상세를 매단다. */
const CAT_DETAIL: Record<string, { title: string; desc: string }> = {
  질환유발모델: { title: '질환 유발 모델', desc: '질환 병태 재현을 위한 유발 처치' },
  조직병리: { title: '조직병리 분석', desc: 'H&E·특수염색·IHC 및 병리 판독' },
  행동평가: { title: '행동·기능 평가', desc: '행동학적 기능 지표 측정' },
  영상: { title: '영상 분석', desc: 'MRI/CT/초음파 등 영상 촬영·분석' },
  항암: { title: '항암 세포 실험', desc: '세포주 배양 및 종양 이식' },
};

/**
 * STEP 4 · 견적서 — 독성 모듈과 동일한 양식(PrintLayout + print.css)을 그대로 사용한다.
 * 효력 데이터(원가 라인·모델 프리셋)를 PrintData로 매핑해 넘긴다.
 */
export default function Step4Quote({ s, m, items, q, quoteNo, issueDate }: {
  s: EffState; m: StudyModel; items: CostItem[]; q: QuoteTotals; quoteNo: string; issueDate: Date;
}) {
  const totalWeeks = Math.ceil(totalDaysOf(s.schedule) / 7);
  const totalAnimals = totalAnimalsOf(s.groups);
  const modelTitle = m.title.replace(/^[IVX]+-\d+\.\s*/, '');
  const freqLabel = (DOSE_FREQ.find((f) => f.key === s.params.freq) ?? DOSE_FREQ[0]).label;
  const animalDesc = `${s.params.strain} ${s.params.ageWeeks}주령${s.params.vendor ? ` (${s.params.vendor})` : ''}`;
  const groupDesc = s.groups.map((g) => {
    const t = groupTotal(g);
    return g.subs.length > 1 ? `${g.tag} ${t}(${g.subs.map((x) => x.n).join('+')})` : `${g.tag} ${t}`;
  }).join(', ') + ` = 총 ${totalAnimals}마리`;
  const endpointList = s.endpoints.map((e) => e.name).join(', ') || '—';

  const lines: PrintData['lines'] = items.map((it, i) => ({
    kind: 'test',
    testItemKey: `EFF-${i}`,
    testName: it.name,
    adminRoute: it.category === '투여' ? s.params.route : null,
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    subtotal: it.subtotal,
    note: it.multiplier > 1 ? `${it.category} · ×${it.multiplier}` : it.category,
  }));

  // 상세 카드 — ① 모델 전체 개요(질환유발 라인에, 없으면 첫 라인) ② 카테고리별 첫 라인
  const details: PrintData['details'] = [];
  const seen = new Set<string>();
  const modelLineIdx = Math.max(0, items.findIndex((it) => it.category === '질환유발모델'));
  details.push({
    key: `EFF-${modelLineIdx}`,
    category: m.category,
    studyWeeks: totalWeeks,
    species: animalDesc,
    groupComposition: groupDesc,
    dosingPeriod: `${dosingWeeks(s.schedule)} · ${s.params.route} · ${freqLabel}`,
    purpose: `${modelTitle} 모델에서 시험물질의 효력을 평가한다. 유발대조군 대비 시험군의 개선 정도를 지표별로 비교하여 유효성을 검증한다.`,
    checklist: [
      { label: '유발방법', value: s.params.induction || 'N/A' },
      { label: '양성대조', value: m.positiveControl || 'N/A' },
      { label: '시험기간', value: `${totalWeeks}주 + 보고서 ${m.reportWeeks}주` },
      { label: '평가항목', value: endpointList },
    ],
  });
  seen.add(`EFF-${modelLineIdx}`);

  items.forEach((it, i) => {
    const cg = CAT_DETAIL[it.category];
    if (!cg || seen.has(it.category)) return;
    const key = `EFF-${i}`;
    if (seen.has(key)) { seen.add(it.category); return; }
    const rows = items.filter((x) => x.category === it.category);
    details.push({
      key,
      category: it.category,
      purpose: cg.desc,
      checklist: rows.map((x) => ({ label: x.name.length > 20 ? `${x.name.slice(0, 20)}…` : x.name, value: `₩${x.subtotal.toLocaleString()}` })),
    });
    seen.add(it.category);
    seen.add(key);
  });

  const data: PrintData = {
    meta: { quoteNo, issuedAt: issueDate, validUntilDays: 60 },
    project: {
      projectName: s.client.projectName || `${modelTitle} 효력시험`,
      substanceName: s.client.substanceName,
      modality: '비임상 효력시험',
      customerCompany: s.client.company,
      customerName: s.client.name,
      customerEmail: s.client.email,
    },
    settings: { priceStandard: 'MFDS', currency: 'KRW', discountRate: s.discount, excipientCount: 0 },
    lines,
    totals: {
      totalBeforeDiscount: q.wp,
      discountAmount: q.discAmt,
      totalAfterDiscount: q.disc,
      vatAmount: q.vatAmt,
      grandTotal: q.vat,
    },
    warnings: [],
    details,
    subtitle: `시험 유형 · 비임상 효력시험 (Efficacy Study)${s.client.indication ? ` · 적응증 ${s.client.indication}` : ''}`,
    metaBlocks: [
      { label: '고객사', value: s.client.company || '—' },
      { label: '담당자', value: [s.client.name, s.client.email].filter(Boolean).join(' · ') || '—' },
      { label: '시험계', value: animalDesc },
      { label: '군 구성', value: `${s.groups.length}군 · 총 ${totalAnimals}마리` },
      { label: '시험기간', value: `${totalWeeks}주 (보고 ${m.reportWeeks}주 별도)` },
      { label: '견적 발행일', value: issueDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) },
    ],
    terms: [
      '가격 기준 — 코아스템켐온 비임상 효력시험 표준 단가',
      `질환 모델 — ${modelTitle} (${m.categoryCode} · ${m.category})`,
      `동물 · 시험계 — ${animalDesc} / ${s.groups.length}군 · 총 ${totalAnimals}마리`,
      `투여 — ${s.params.route} · ${freqLabel}`,
      'VAT — 위 금액에 별도 10% 부가가치세 부과',
      '유효기간 — 발행일로부터 60일',
      '지급 조건 — 시험 착수 시 50% · 종료 시 50% (별도 합의 시 조정 가능)',
    ],
  };

  return <PrintLayout data={data} />;
}
