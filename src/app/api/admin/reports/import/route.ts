import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';
import { dailyRowsFromWorksheet, importDailyReports } from '@/lib/admin/daily-import';

export const runtime = 'nodejs';

/** 일일업무보고 엑셀 업로드 — 관리자 뷰 전용. '일일업무보고' 시트 파싱→DailyReport upsert. */
export async function POST(req: Request) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '파일 없음' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return NextResponse.json({ error: '엑셀 파싱 실패' }, { status: 400 }); }
  const ws = wb.getWorksheet('일일업무보고') ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: '시트 없음' }, { status: 400 });

  const rows = dailyRowsFromWorksheet(ws);
  const importerId = await currentUserId();
  const result = await importDailyReports(prisma, rows, importerId);
  return NextResponse.json({ ok: true, ...result, parsed: rows.length });
}
