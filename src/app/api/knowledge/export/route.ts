/**
 * GET /api/knowledge/export — 현재 지식·근거 데이터를 3시트 엑셀로 내보내기 (관리자 전용)
 * 내보낸 파일을 수정한 뒤 /api/knowledge/import 로 되돌릴 수 있다 (무손실 라운드트립).
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadKnowledge } from '@/lib/knowledge';
import { buildKnowledgeWorkbook } from '@/lib/knowledge-xlsx';

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 내보낼 수 있습니다.' }, { status: 403 });

  const k = loadKnowledge();
  const buf = await buildKnowledgeWorkbook({
    guidelines: k.guidelines as unknown as Record<string, unknown>[],
    designRules: k.designRules as unknown as Record<string, unknown>[],
    modalities: k.modalities as unknown as Record<string, unknown>[],
  });

  const fname = `지식근거_마스터_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
    },
  });
}
