/**
 * GET /api/test-items/export — 시험항목·가격 마스터를 엑셀로 내보내기 (관리자 전용)
 * 내보낸 파일을 수정한 뒤 /api/test-items/import 로 되돌릴 수 있다 (무손실 라운드트립).
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadData } from '@/lib/data';
import { buildTestItemsWorkbook } from '@/lib/test-items-xlsx';
import { ensureHydrated } from '@/lib/hydrate';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureHydrated();
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 내보낼 수 있습니다.' }, { status: 403 });

  const items = loadData().testItems as unknown as Record<string, unknown>[];
  const buf = await buildTestItemsWorkbook(items);
  const fname = `시험항목_가격마스터_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
    },
  });
}
