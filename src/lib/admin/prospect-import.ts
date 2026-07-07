/**
 * 잠재 고객 임포트 — 임정모 Sheet3(타겟 기업 리스트)를 Prospect upsert(기업명 기준).
 * 헤더 행(기업명 포함) 자동 탐지 후 열 매핑. 프로필 블록(개요/설립시점 등)은 파이프라인 없어 자동 제외.
 */
import type { PrismaClient } from '@prisma/client';

export type ProspectRaw = {
  name: string; pipeline: string | null; platform: string | null;
  stage: string | null; indTarget: string | null; croOutlook: string | null;
};
export type ProspectImportResult = { created: number; updated: number; skipped: number; errors: string[] };

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

export function prospectRowsFromWorksheet(ws: import('exceljs').Worksheet): ProspectRaw[] {
  // 1) 헤더 행 탐지(기업명 포함)
  let headerRow = 0;
  const colOf: Record<string, number> = {};
  ws.eachRow((row, rn) => {
    if (headerRow) return;
    const map: Record<string, number> = {};
    row.eachCell((cell, c) => { const h = s(cell.value); if (h) map[h] = c; });
    if (Object.keys(map).some((h) => h.includes('기업명'))) { headerRow = rn; Object.assign(colOf, map); }
  });
  if (!headerRow) return [];

  const find = (kw: string): number | null => {
    for (const [h, c] of Object.entries(colOf)) if (h.includes(kw)) return c;
    return null;
  };
  const cName = find('기업명'), cPipe = find('파이프라인'), cPlat = find('플랫폼'),
    cStage = find('개발단계'), cInd = find('IND'), cCro = find('CRO');
  if (!cName) return [];

  const out: ProspectRaw[] = [];
  ws.eachRow((row, rn) => {
    if (rn <= headerRow) return;
    const name = s(row.getCell(cName).value);
    if (!name || name.includes('기업명')) return;
    const pipeline = cPipe ? s(row.getCell(cPipe).value) : '';
    const platform = cPlat ? s(row.getCell(cPlat).value) : '';
    const stage = cStage ? s(row.getCell(cStage).value) : '';
    const indTarget = cInd ? s(row.getCell(cInd).value) : '';
    const croOutlook = cCro ? s(row.getCell(cCro).value) : '';
    // 회사 행만(파이프라인/플랫폼/단계 중 하나라도 있어야) — 프로필 블록 제외
    if (!pipeline && !platform && !stage && !indTarget && !croOutlook) return;
    out.push({ name, pipeline: pipeline || null, platform: platform || null, stage: stage || null, indTarget: indTarget || null, croOutlook: croOutlook || null });
  });
  return out;
}

export async function importProspects(prisma: PrismaClient, rows: ProspectRaw[], importerUserId: number): Promise<ProspectImportResult> {
  const res: ProspectImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  for (const r of rows) {
    if (!r.name) { res.skipped++; continue; }
    try {
      const existing = await prisma.prospect.findFirst({ where: { name: r.name }, select: { id: true } });
      const data = { pipeline: r.pipeline, platform: r.platform, stage: r.stage, indTarget: r.indTarget, croOutlook: r.croOutlook };
      if (existing) { await prisma.prospect.update({ where: { id: existing.id }, data }); res.updated++; }
      else { await prisma.prospect.create({ data: { name: r.name, ownerId: importerUserId, ...data } }); res.created++; }
    } catch (e) {
      res.errors.push(`${r.name}: ${(e as Error).message}`);
      res.skipped++;
    }
  }
  return res;
}
