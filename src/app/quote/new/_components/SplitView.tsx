'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Printer, Save } from 'lucide-react';
import { useWizard } from '@/lib/store';
import type { TemplateCategory } from '@/lib/modality-templates';
import SectionProject from './SectionProject';
import SectionModality from './SectionModality';
import SectionPlan from './SectionPlan';
import SectionSelections from './SectionSelections';
import SectionPricing from './SectionPricing';
import LivePreview from './LivePreview';
import Stepper from './Stepper';

const STEP_META = [
  { n: 1, title: '프로젝트 정보', subtitle: '의뢰자·시험물질 정보를 입력하세요' },
  { n: 2, title: '모달리티 선택', subtitle: '대분류 → 중분류 순으로 선택하세요' },
  { n: 3, title: '임상 계획 · 자동 구성', subtitle: '시험 패키지를 자동으로 구성합니다' },
  { n: 4, title: '선택된 시험 · 부형제', subtitle: '항목과 부형제 종수를 확인·조정하세요' },
  { n: 5, title: '통화 · 할인', subtitle: '최종 견적 조건을 설정합니다' },
];

export default function SplitView({ modalityTree }: { modalityTree: TemplateCategory[] }) {
  const s = useWizard();
  const meta = STEP_META[s.step - 1];

  // Warn when user navigates away with unsaved work in progress.
  useEffect(() => {
    const dirty = s.projectName.trim().length > 0 || s.selections.length > 0;
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [s.projectName, s.selections.length]);

  const canGoNext = (): boolean => {
    if (s.step === 1) return s.customerCompany.trim().length > 0;
    if (s.step === 2) return !!s.modality;
    if (s.step === 3) return true;
    if (s.step === 4) return s.selections.length > 0;
    return false;
  };

  // 실시간 견적 표시 조건:
  //  - step 1·2: 항상 숨김 (입력·선택에만 집중)
  //  - step 3: "자동 구성" 실행(planApplied) 후부터 표시
  //  - step 4·5: 항상 표시
  const showPreview = s.step >= 4 || (s.step === 3 && s.planApplied);

  return (
    <div className="space-y-6">
      {/* Title row */}
      <div className="flex items-end justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">새 견적 작성</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            5단계로 손쉽게 견적을 구성하고 PDF로 출력합니다.
          </p>
        </div>
        <div className="text-[11px] text-ink-subtle inline-flex items-center gap-1.5">
          <Save className="w-3 h-3" />
          <span>자동 저장됨 · 브라우저에 보관</span>
        </div>
      </div>

      {/* Stepper */}
      <div className="card p-6 no-print">
        <Stepper />
      </div>

      <div className={showPreview
        ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_1.05fr)] gap-6'
        : 'max-w-3xl mx-auto'}>
        {/* LEFT — current step */}
        <div className="no-print">
          <section className="card overflow-hidden animate-fade-in" key={s.step}>
            <header className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-sm font-bold shadow-sm">
                  {s.step}
                </span>
                <div className="leading-tight">
                  <h2 className="font-semibold text-ink">{meta.title}</h2>
                  <p className="text-xs text-ink-muted mt-0.5">{meta.subtitle}</p>
                </div>
              </div>
            </header>

            <div className="p-6 animate-slide-up">
              {s.step === 1 && <SectionProject />}
              {s.step === 2 && <SectionModality tree={modalityTree} />}
              {s.step === 3 && <SectionPlan />}
              {s.step === 4 && <SectionSelections />}
              {s.step === 5 && <SectionPricing />}
            </div>

            <footer className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
              <button
                onClick={s.prevStep}
                disabled={s.step === 1}
                className="btn-outline"
              >
                <ChevronLeft className="w-4 h-4" />
                이전
              </button>
              <span className="text-[11px] text-ink-subtle font-medium tabular-nums">
                {s.step} / {STEP_META.length}
              </span>
              {s.step < STEP_META.length ? (
                <button
                  onClick={s.nextStep}
                  disabled={!canGoNext()}
                  className="btn-primary"
                >
                  다음
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => window.open('/quote/print', '_blank')}
                  className="btn-primary"
                >
                  <Printer className="w-4 h-4" />
                  견적서 PDF 출력
                </button>
              )}
            </footer>
          </section>
        </div>

        {/* RIGHT — preview (자동 구성 이후부터 표시) */}
        {showPreview && (
          <div className="lg:sticky lg:top-20 self-start">
            <LivePreview />
          </div>
        )}
      </div>
    </div>
  );
}
