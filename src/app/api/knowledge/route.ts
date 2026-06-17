import { NextResponse } from 'next/server';
import { loadKnowledge } from '@/lib/knowledge';
import { getAdmin } from '@/lib/admin';
import { ensureHydrated } from '@/lib/hydrate';

// 런타임 DB(DataBlob) 오버레이를 매 요청 반영하려면 정적 프리렌더를 막아야 한다.
export const dynamic = 'force-dynamic';

/** GET /api/knowledge — 가이드라인 사전 + 모달리티 + 설계규칙 전체 (+ 편집 권한 여부). */
export async function GET() {
  await ensureHydrated();
  const k = loadKnowledge();
  const admin = await getAdmin();
  return NextResponse.json({
    guidelines: k.guidelines,
    modalities: k.modalities,
    designRules: k.designRules,
    counts: {
      guidelines: k.guidelines.length,
      modalities: k.modalities.length,
      designRules: k.designRules.length,
    },
    isAdmin: !!admin,
  });
}
