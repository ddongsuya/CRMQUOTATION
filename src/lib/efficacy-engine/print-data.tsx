/**
 * 효력 견적 → PrintData 빌더 (위저드 STEP4 · 저장된 견적 재출력 공용).
 * 두 경로가 반드시 같은 문서를 만들도록 한 곳에서만 조립한다.
 */
import type { PrintData } from '@/app/quote/print/_components/PrintLayout';
import type { EffState } from '@/app/quote-efficacy/_lib/state';
import { dosingWeeks, findModel, groupTotal, totalAnimalsOf, totalDaysOf } from '@/app/quote-efficacy/_lib/state';
import { DesignEndpoints, DesignGroups, DesignLegend, DesignTimeline } from './DesignSection';
import { DOSE_FREQ } from './constants';

/** 견적 라인 — 위저드는 엔진 산출 CostItem, 재출력은 저장된 QuoteItem 스냅샷에서 만든다. */
export type EffLine = { category: string; name: string; unitPrice: number; quantity: number; multiplier: number; subtotal: number };

/** 저장된 QuoteItem → EffLine. multiplier는 소계에서 역산(스키마에 별도 컬럼이 없음). */
export function linesFromQuoteItems(
  items: { category: string | null; testNameSnapshot: string; unitPrice: number; quantity: number; subtotal: number }[],
): EffLine[] {
  return items.map((it) => {
    const base = it.unitPrice * it.quantity;
    const mult = base > 0 ? Math.round(it.subtotal / base) : 1;
    return {
      category: it.category ?? '기타',
      name: it.testNameSnapshot,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      multiplier: Math.max(1, mult),
      subtotal: it.subtotal,
    };
  });
}

/** 상세 카드를 붙일 카테고리 — 핸드오프 DC의 catGroups. */
const CAT_DETAIL: Record<string, { title: string; desc: string }> = {
  질환유발모델: { title: '질환 유발 모델', desc: '질환 병태 재현을 위한 유발 처치' },
  조직병리: { title: '조직병리 분석', desc: 'H&E·특수염색·IHC 및 병리 판독' },
  행동평가: { title: '행동·기능 평가', desc: '행동학적 기능 지표 측정' },
  영상: { title: '영상 분석', desc: 'MRI/CT/초음파 등 영상 촬영·분석' },
  항암: { title: '항암 세포 실험', desc: '세포주 배양 및 종양 이식' },
};

export type EffTotals = {
  totalBeforeDiscount: number; discountAmount: number; totalAfterDiscount: number; vatAmount: number; grandTotal: number;
};

export function buildEfficacyPrintData({
  state, lines, totals, quoteNo, issuedAt,
}: {
  state: EffState; lines: EffLine[]; totals: EffTotals; quoteNo: string; issuedAt: Date;
}): PrintData {
  const s = state;
  const m = findModel(s.modelId);
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

  const printLines: PrintData['lines'] = lines.map((it, i) => ({
    kind: 'test',
    testItemKey: `EFF-${i}`,
    testName: it.name,
    adminRoute: it.category === '투여' ? s.params.route : null,
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    subtotal: it.subtotal,
    note: it.multiplier > 1 ? `${it.category} · ×${it.multiplier}` : it.category,
  }));

  // 상세 카드 — ① 모델 전체 개요(질환유발 라인에, 없으면 첫 라인) ② 카테고리별 대표 라인
  const details: PrintData['details'] = [];
  const usedCats = new Set<string>();
  const usedKeys = new Set<string>();
  const modelIdx = Math.max(0, lines.findIndex((it) => it.category === '질환유발모델'));
  details.push({
    key: `EFF-${modelIdx}`,
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
  usedKeys.add(`EFF-${modelIdx}`);
  usedCats.add(lines[modelIdx]?.category ?? '');

  lines.forEach((it, i) => {
    const cg = CAT_DETAIL[it.category];
    const key = `EFF-${i}`;
    if (!cg || usedCats.has(it.category) || usedKeys.has(key)) return;
    const rows = lines.filter((x) => x.category === it.category);
    details.push({
      key,
      category: it.category,
      purpose: cg.desc,
      checklist: rows.map((x) => ({
        label: x.name.length > 20 ? `${x.name.slice(0, 20)}…` : x.name,
        value: `₩${x.subtotal.toLocaleString()}`,
      })),
    });
    usedCats.add(it.category);
    usedKeys.add(key);
  });

  // 시험 설계 페이지 — 명세(p.2) 뒤에 배치. 엔드포인트가 많으면 잘리지 않도록 2페이지로 분리.
  const manyEndpoints = s.endpoints.length > 8;
  const designPages: PrintData['designPages'] = [
    {
      title: manyEndpoints ? '시험 설계 (1/2) · 타임라인 · 군 구성' : '시험 설계 · 타임라인 · 군 구성 · 엔드포인트',
      content: (
        <>
          <DesignTimeline s={s} />
          <DesignLegend s={s} />
          <DesignGroups s={s} />
          {!manyEndpoints && <DesignEndpoints s={s} m={m} />}
        </>
      ),
    },
  ];
  if (manyEndpoints) {
    designPages.push({
      title: '시험 설계 (2/2) · 엔드포인트 · 평가 스케줄',
      content: <DesignEndpoints s={s} m={m} />,
    });
  }

  return {
    meta: { quoteNo, issuedAt, validUntilDays: 60 },
    designPages,
    project: {
      projectName: s.client.projectName || `${modelTitle} 효력시험`,
      substanceName: s.client.substanceName,
      modality: '비임상 효력시험',
      customerCompany: s.client.company,
      customerName: s.client.name,
      customerEmail: s.client.email,
    },
    settings: { priceStandard: 'MFDS', currency: 'KRW', discountRate: s.discount, excipientCount: 0 },
    lines: printLines,
    totals,
    warnings: [],
    details,
    subtitle: `시험 유형 · 비임상 효력시험 (Efficacy Study)${s.client.indication ? ` · 적응증 ${s.client.indication}` : ''}`,
    metaBlocks: [
      { label: '고객사', value: s.client.company || '—' },
      { label: '담당자', value: [s.client.name, s.client.email].filter(Boolean).join(' · ') || '—' },
      { label: '시험계', value: animalDesc },
      { label: '군 구성', value: `${s.groups.length}군 · 총 ${totalAnimals}마리` },
      { label: '시험기간', value: `${totalWeeks}주 (보고 ${m.reportWeeks}주 별도)` },
      { label: '견적 발행일', value: issuedAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) },
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
}
