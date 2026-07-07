import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';
import { prospectRowsFromWorksheet, importProspects } from '@/lib/admin/prospect-import';

export const runtime = 'nodejs';

/** 잠재 고객 엑셀 업로드 — '기업명' 헤더가 있는 시트 자동 탐지 → Prospect upsert. */
export async function POST(req: Request) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '파일 없음' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return NextResponse.json({ error: '엑셀 파싱 실패' }, { status: 400 }); }

  // '기업명' 헤더가 있는 시트 중 가장 많은 행을 뽑는 시트 사용
  let best: ReturnType<typeof prospectRowsFromWorksheet> = [];
  for (const ws of wb.worksheets) {
    const rows = prospectRowsFromWorksheet(ws);
    if (rows.length > best.length) best = rows;
  }
  if (!best.length) return NextResponse.json({ error: '기업명 헤더가 있는 시트를 찾지 못했습니다' }, { status: 400 });

  const importerId = await currentUserId();
  const result = await importProspects(prisma, best, importerId);
  return NextResponse.json({ ok: true, ...result, parsed: best.length });
}
