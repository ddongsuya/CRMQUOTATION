/**
 * 요청 시작 시 1회 호출 — DB DataBlob 행을 읽어 각 마스터데이터 로더의 캐시에
 * overlay 한다. DB 미설정/빈 경우 아무것도 하지 않고 로더는 번들 JSON seed 로 폴백.
 *
 * 엔진(assemble·suggest·pricing)·검색·위저드가 모두 sync 로더(loadData 등)를 통하므로,
 * 비동기 진입점(API 라우트·서버 컴포넌트)에서 `await ensureHydrated()` 만 먼저 부르면
 * 이후 sync 코드는 DB 반영된 데이터를 본다.
 */
import { hydrateBlobs, blobDbEnabled } from './blob-store';
import { hydrateData } from './data';
import { hydrateKnowledge } from './knowledge';
import { hydrateModalityTemplates } from './modality-templates';
import { hydrateQuoteTemplates } from './quote-templates';

export async function ensureHydrated(): Promise<void> {
  if (!blobDbEnabled()) return;
  const blobs = await hydrateBlobs();
  hydrateData(blobs);
  hydrateKnowledge(blobs);
  hydrateModalityTemplates(blobs);
  hydrateQuoteTemplates(blobs);
}
