import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';
import { importQuoteRows, rowsFromWorksheet } from '@/lib/admin/quote-import';

export const runtime = 'nodejs';

/** 견적 현황 엑셀 업로드 — 관리자 뷰 전용. multipart: file. '견적서' 시트 파싱→Quote upsert. */
export async function POST(req: Request) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '파일 없음' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  // exceljs 타입은 구형 Buffer 시그니처 — 런타임은 정상, 캐스트로 해소
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return NextResponse.json({ error: '엑셀 파싱 실패' }, { status: 400 }); }
  const ws = wb.getWorksheet('견적서') ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: '시트 없음' }, { status: 400 });

  const rows = rowsFromWorksheet(ws);
  const importerId = await currentUserId();
  const result = await importQuoteRows(prisma, rows, importerId);
  return NextResponse.json({ ok: true, ...result, parsed: rows.length });
}
