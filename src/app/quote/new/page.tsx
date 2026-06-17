import { Suspense } from 'react';
import { loadModalityTemplates } from '@/lib/modality-templates';
import { ensureHydrated } from '@/lib/hydrate';
import SplitView from './_components/SplitView';
import QuoteLoader from './_components/QuoteLoader';

// 모달리티 구성을 런타임 DB 에서 매 요청 읽으려면 정적 프리렌더를 막는다.
export const dynamic = 'force-dynamic';

export default async function NewQuotePage() {
  await ensureHydrated();
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
