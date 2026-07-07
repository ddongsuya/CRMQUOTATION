/**
 * 일일업무보고 임포트 — 임정모 '일일업무보고' 시트(하루=한 행)를 DailyReport upsert.
 * 헤더 2줄·병합 셀 → 위치 기반 파싱(A=날짜 B=작성자 C=업무내용 D=계약예정 E=방문/기타 F=계약금액 G=기타).
 */
import type { PrismaClient } from '@prisma/client';

export type DailyRaw = {
  date: Date; author: string; workContent: string | null;
  contractPlan: string | null; activityNote: string | null; contractAmount: number | null;
};
export type DailyImportResult = { created: number; updated: number; skipped: number; errors: string[] };

const s = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('text' in o) return String(o.text).trim();
    if ('result' in o) return String(o.result).trim();
    if ('richText' in o && Array.isArray(o.richText)) return o.richText.map((t: { text?: string }) => t.text ?? '').join('').trim();
  }
  return String(v).trim();
};
const num = (v: unknown): number | null => {
  const t = s(v).replace(/[,\s₩원]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
/** 'YYYY.MM.DD' · 'YYYY-MM-DD' · Date 모두 처리. 실패 시 null. */
function parseDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const raw = s(v);
  const m = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(raw);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/** exceljs 워크시트 → 일일보고 행. 날짜(A열) 있는 행만. */
export function dailyRowsFromWorksheet(ws: import('exceljs').Worksheet): DailyRaw[] {
  const out: DailyRaw[] = [];
  ws.eachRow((row) => {
    const date = parseDate(row.getCell(1).value);
    if (!date) return;                                  // 제목·헤더·빈행 skip
    const activity = [s(row.getCell(5).value), s(row.getCell(7).value)].filter(Boolean).join('\n\n');
    out.push({
      date,
      author: s(row.getCell(2).value),
      workContent: s(row.getCell(3).value) || null,
      contractPlan: s(row.getCell(4).value) || null,
      activityNote: activity || null,
      contractAmount: num(row.getCell(6).value),
    });
  });
  return out;
}

/** 행 upsert (ownerId+date 유니크). author 이름 매칭, 미매칭 시 importer. */
export async function importDailyReports(prisma: PrismaClient, rows: DailyRaw[], importerUserId: number): Promise<DailyImportResult> {
  const res: DailyImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const byName = new Map(users.map((u) => [(u.name ?? '').trim(), u.id] as const));

  for (const r of rows) {
    // 내용이 전부 비면 skip(날짜만 있는 행)
    if (!r.workContent && !r.contractPlan && !r.activityNote && r.contractAmount == null) { res.skipped++; continue; }
    try {
      const ownerId = byName.get(r.author) ?? importerUserId;
      const data = {
        workContent: r.workContent, contractPlan: r.contractPlan,
        activityNote: r.activityNote, contractAmount: r.contractAmount,
      };
      const existing = await prisma.dailyReport.findUnique({ where: { ownerId_date: { ownerId, date: r.date } }, select: { id: true } });
      if (existing) { await prisma.dailyReport.update({ where: { id: existing.id }, data }); res.updated++; }
      else { await prisma.dailyReport.create({ data: { ownerId, date: r.date, ...data } }); res.created++; }
    } catch (e) {
      res.errors.push(`${r.date.toISOString().slice(0, 10)}: ${(e as Error).message}`);
      res.skipped++;
    }
  }
  return res;
}
