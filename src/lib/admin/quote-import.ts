/**
 * 견적 현황 엑셀 임포트 — 임정모 견적서 시트(한 줄=견적 1건)를 Quote(+Company/Contact)로 upsert.
 * 앱 업로드 API·일회성 시드 스크립트 공용. 헤더명은 시트 그대로 사용.
 */
import type { PrismaClient } from '@prisma/client';

export const QUOTE_SHEET_HEADERS = [
  '견적 송부 날짜', '견적서 번호', '계약번호', '시험기준', '견적명', '의뢰기관', '의뢰자',
  '의뢰자 연락처', '의뢰자 e-mail', '제출용도', '물질종류', '담당자', '견적금액', '할인율', '계약금액', '결론',
] as const;

export type RawRow = Record<string, unknown>;
export type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };

const s = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s₩%]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const toDate = (v: unknown): Date | null => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

/** 물질종류 → modality(필수 필드) 매핑. */
function toModality(substanceType: string): string {
  const t = substanceType;
  if (/백신/.test(t)) return '백신';
  if (/화장품/.test(t)) return '화장품';
  if (/의료기기/.test(t)) return '의료기기';
  if (/미생물|건기식|건강/.test(t)) return '건강기능식품';
  if (/세포|줄기|유전자/.test(t)) return '세포치료제';
  return '의약품';
}

/**
 * 행 배열을 upsert. importerUserId = 담당자 미매칭 시 소유자 폴백.
 * quoteNumber 기준 upsert(있으면 갱신). 의뢰기관→Company, 의뢰자→Contact upsert.
 */
export async function importQuoteRows(prisma: PrismaClient, rows: RawRow[], importerUserId: number): Promise<ImportResult> {
  const res: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  // 담당자 이름 → userId 매핑(1회 로드)
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const byName = new Map(users.map((u) => [(u.name ?? '').trim(), u.id] as const));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const quoteNumber = s(r['견적서 번호']);
    const company = s(r['의뢰기관']);
    const projectName = s(r['견적명']) || (company ? `${company} 견적` : '');
    // 필수: 견적번호 + (견적명 또는 의뢰기관)
    if (!quoteNumber || (!projectName && !company)) { res.skipped++; continue; }

    try {
      const ownerName = s(r['담당자']);
      const ownerId = byName.get(ownerName) ?? importerUserId;
      const substanceType = s(r['물질종류']) && s(r['물질종류']) !== '-' ? s(r['물질종류']) : null;
      const submissionPurpose = s(r['제출용도']) && s(r['제출용도']) !== '-' ? s(r['제출용도']) : null;
      const total = num(r['견적금액']);
      const discount = num(r['할인율']) ?? 0;
      const contactName = s(r['의뢰자']) || null;
      const email = s(r['의뢰자 e-mail']).replace(/^mailto:/, '') || null;
      const phone = s(r['의뢰자 연락처']) || null;

      // 1) 고객사 upsert (이름 매칭, 없으면 생성 — 소유=담당자)
      let companyId: number | null = null;
      let contactId: number | null = null;
      if (company) {
        let co = await prisma.company.findFirst({ where: { name: company }, select: { id: true } });
        if (!co) co = await prisma.company.create({ data: { name: company, ownerId, industry: substanceType ?? undefined }, select: { id: true } });
        companyId = co.id;
        // 2) 연락처 upsert (이름 기준)
        if (contactName) {
          let ct = await prisma.contact.findFirst({ where: { companyId, name: contactName }, select: { id: true } });
          if (!ct) ct = await prisma.contact.create({ data: { companyId, name: contactName, email: email ?? undefined, phone: phone ?? undefined } , select: { id: true } });
          else await prisma.contact.update({ where: { id: ct.id }, data: { email: email ?? undefined, phone: phone ?? undefined } });
          contactId = ct.id;
        }
      }

      // 3) 견적 upsert (quoteNumber 기준). createdAt=송부일(실제 견적 시점) — 기간 집계 정합.
      const sentDate = toDate(r['견적 송부 날짜']);
      const grand = total != null ? Math.round(total * (1 - discount) * 1.1) : null;
      const data = {
        userId: ownerId,
        createdAt: sentDate ?? undefined,
        customerCompany: company || null,
        customerName: contactName,
        customerEmail: email,
        customerPhone: phone,
        projectName,
        substanceType,
        modality: toModality(substanceType ?? ''),
        testStandard: s(r['시험기준']) || null,
        submissionPurpose,
        contractNo: s(r['계약번호']) || null,
        contractAmount: num(r['계약금액']),
        trackingNote: s(r['결론']) || null,
        discountRate: discount,
        totalBeforeDiscount: total,
        totalAfterDiscount: total != null ? total * (1 - discount) : null,
        grandTotal: grand,
        sentAt: sentDate,
        status: 'SENT',
      };
      const existing = await prisma.quote.findUnique({ where: { quoteNumber }, select: { id: true } });
      if (existing) { await prisma.quote.update({ where: { id: existing.id }, data }); res.updated++; }
      else { await prisma.quote.create({ data: { quoteNumber, ...data } }); res.created++; }
    } catch (e) {
      res.errors.push(`행 ${i + 2} (${quoteNumber}): ${(e as Error).message}`);
      res.skipped++;
    }
  }
  return res;
}

/** exceljs 워크시트 → 행 객체 배열(헤더명 키). 1행=헤더 가정. */
export function rowsFromWorksheet(ws: import('exceljs').Worksheet): RawRow[] {
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => { headers[col] = s(cell.value); });
  const out: RawRow[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj: RawRow = {};
    let any = false;
    row.eachCell((cell, col) => {
      const h = headers[col];
      if (!h) return;
      let v: unknown = cell.value;
      if (v && typeof v === 'object' && 'text' in (v as object)) v = (v as { text: string }).text; // hyperlink cell
      if (v && typeof v === 'object' && 'result' in (v as object)) v = (v as { result: unknown }).result; // formula
      obj[h] = v;
      if (s(v)) any = true;
    });
    if (any) out.push(obj);
  });
  return out;
}
