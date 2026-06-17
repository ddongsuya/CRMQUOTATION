import { Suspense } from 'react';
import { loadModalityTemplates } from '@/lib/modality-templates';
import SplitView from './_components/SplitView';
import QuoteLoader from './_components/QuoteLoader';

export default function NewQuotePage() {
  const modalityTree = loadModalityTemplates();   // 마스터데이터에서 모달리티 구성 로드
  return (
    <>
      <Suspense fallback={null}>
        <QuoteLoader />
      </Suspense>
      <SplitView modalityTree={modalityTree} />
    </>
  );
}
