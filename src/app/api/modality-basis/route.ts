/**
 * GET /api/modality-basis?modality=X
 * 모달리티 선택 즉시(자동구성 전) 규제근거 + 필수시험구성을 가져오기 위한 경량 엔드포인트.
 * 지식베이스(_modality_guidelines.json / DataBlob overlay)에서 읽으므로 force-dynamic + hydrate.
 */
import { NextResponse } from 'next/server';
import { getModalityBasis } from '@/lib/advisories';
import { ensureHydrated } from '@/lib/hydrate';

import { withErrorHandling } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';

async function _GET(req: Request) {
  await ensureHydrated();
  const { searchParams } = new URL(req.url);
  const modality = searchParams.get('modality') ?? '';
  return NextResponse.json({ basis: getModalityBasis(modality) });
}

export const GET = withErrorHandling(_GET);
