import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';
import { prospectRowsFromWorksheet, importProspects } from '@/lib/admin/prospect-import';
import { MAX_UPLOAD_BYTES, isDryRun, runImport } from '@/lib/admin/import-run';

export const runtime = 'nodejs';

/**
 * 잠재 고객 엑셀 업로드 — '기업명' 헤더가 있는 시트 자동 탐지 → Prospect upsert.
 * ?dryRun=1 이면 쓰지 않고 건수만 계산(미리보기).
 */
export async function POST(req: Request) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '파일 없음' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `파일이 너무 큽니다(최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  }

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
  const dryRun = isDryRun(req);
  const result = await runImport(importProspects, best, importerId, dryRun);
  return NextResponse.json({ ok: true, dryRun, ...result, parsed: best.length });
}
