import { Suspense } from 'react';
import { listModalities } from '@/lib/data';
import SplitView from './_components/SplitView';
import QuoteLoader from './_components/QuoteLoader';

export default function NewQuotePage() {
  const modalities = listModalities();
  return (
    <>
      <Suspense fallback={null}>
        <QuoteLoader />
      </Suspense>
      <SplitView modalities={modalities} />
    </>
  );
}
