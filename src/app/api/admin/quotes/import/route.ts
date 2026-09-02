import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/admin/guard';
import { currentUserId } from '@/lib/current-user';
import { importQuoteRows, rowsFromWorksheet } from '@/lib/admin/quote-import';
import { MAX_UPLOAD_BYTES, isDryRun, runImport } from '@/lib/admin/import-run';

import { withErrorHandling } from '@/lib/api-handler';
export const runtime = 'nodejs';

/**
 * 견적 현황 엑셀 업로드 — 관리자 뷰 전용. multipart: file. '견적서' 시트 파싱→Quote upsert.
 * ?dryRun=1 이면 쓰지 않고 신규/갱신/건너뜀/오류 건수만 계산해 반환(미리보기).
 */
async function _POST(req: Request) {
  const denied = await requireAdmin(); if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '파일 없음' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `파일이 너무 큽니다(최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  // exceljs 타입은 구형 Buffer 시그니처 — 런타임은 정상, 캐스트로 해소
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return NextResponse.json({ error: '엑셀 파싱 실패' }, { status: 400 }); }
  const ws = wb.getWorksheet('견적서') ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: '시트 없음' }, { status: 400 });

  const rows = rowsFromWorksheet(ws);
  const importerId = await currentUserId();
  const dryRun = isDryRun(req);
  const result = await runImport(importQuoteRows, rows, importerId, dryRun);
  return NextResponse.json({ ok: true, dryRun, ...result, parsed: rows.length });
}

export const POST = withErrorHandling(_POST);
