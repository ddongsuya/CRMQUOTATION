import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';
import { dailyRowsFromWorksheet, importDailyReports } from '@/lib/admin/daily-import';
import { MAX_UPLOAD_BYTES, isDryRun, runImport } from '@/lib/admin/import-run';

export const runtime = 'nodejs';

/**
 * 일일업무보고 엑셀 업로드 — 관리자 뷰 전용. '일일업무보고' 시트 파싱→DailyReport upsert.
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
  const ws = wb.getWorksheet('일일업무보고') ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: '시트 없음' }, { status: 400 });

  const rows = dailyRowsFromWorksheet(ws);
  const importerId = await currentUserId();
  const dryRun = isDryRun(req);
  const result = await runImport(importDailyReports, rows, importerId, dryRun);
  return NextResponse.json({ ok: true, dryRun, ...result, parsed: rows.length });
}
