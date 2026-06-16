/**
 * 시험항목·가격 마스터 ↔ 엑셀 변환 (서버 전용, exceljs).
 *
 * export/import 가 같은 컬럼 스펙을 공유 → 라운드트립 무손실.
 * 전체 필드를 컬럼으로 내보내므로 가져오기 = 전체 교체(시트가 진실원천, 누락 행=삭제).
 *   - number  : 숫자 셀 (빈 셀 → null)
 *   - array   : 셀 안 줄바꿈 구분 (modalityPool)
 *   - json    : JSON 문자열 (priceTiers)
 *   - bool    : Y/N
 *   - string  : nullable 기본(빈 셀→null); key·testName·masterId 는 비-nullable
 */
import ExcelJS from 'exceljs';

type ColType = 'string' | 'number' | 'array' | 'json' | 'bool';
type Col = { header: string; field: string; type: ColType; nullable?: boolean; width?: number };

export const SHEET = '시험항목 마스터';

export const COLUMNS: Col[] = [
  { header: 'key(식별자·수정금지)', field: 'key', type: 'string', nullable: false, width: 40 },
  { header: 'masterId', field: 'masterId', type: 'string', nullable: false, width: 14 },
  { header: 'testName(시험명)', field: 'testName', type: 'string', nullable: false, width: 30 },
  { header: 'category', field: 'category', type: 'string', width: 16 },
  { header: 'status', field: 'status', type: 'string', width: 10 },
  { header: 'modalityPool(줄바꿈)', field: 'modalityPool', type: 'array', width: 28 },
  { header: 'adminRoute', field: 'adminRoute', type: 'string', width: 10 },
  { header: 'routeGroup', field: 'routeGroup', type: 'string', width: 10 },
  { header: 'adminDuration', field: 'adminDuration', type: 'string', width: 12 },
  { header: 'studyWeeks', field: 'studyWeeks', type: 'number', width: 10 },
  { header: 'priceMfds', field: 'priceMfds', type: 'number', width: 14 },
  { header: 'priceOecd', field: 'priceOecd', type: 'number', width: 14 },
  { header: 'priceTiers(JSON)', field: 'priceTiers', type: 'json', width: 24 },
  { header: 'hamryangApply', field: 'hamryangApply', type: 'string', width: 12 },
  { header: 'hamryangCount', field: 'hamryangCount', type: 'string', width: 12 },
  { header: 'hamryangUnit', field: 'hamryangUnit', type: 'number', width: 12 },
  { header: 'hamryangRule', field: 'hamryangRule', type: 'string', width: 14 },
  { header: 'excipientBranch', field: 'excipientBranch', type: 'string', width: 14 },
  { header: 'linkRelation', field: 'linkRelation', type: 'string', width: 12 },
  { header: 'parentTest', field: 'parentTest', type: 'string', width: 20 },
  { header: 'isPrerequisite', field: 'isPrerequisite', type: 'bool', width: 12 },
  { header: 'optionality', field: 'optionality', type: 'string', width: 12 },
  { header: 'linkBasis', field: 'linkBasis', type: 'string', width: 20 },
  { header: 'quoteWeeks', field: 'quoteWeeks', type: 'number', width: 10 },
  { header: 'detail', field: 'detail', type: 'string', width: 40 },
  { header: 'quoteText', field: 'quoteText', type: 'string', width: 40 },
  { header: 'guideline', field: 'guideline', type: 'string', width: 30 },
  { header: 'notice', field: 'notice', type: 'string', width: 30 },
  { header: 'sourceFile', field: 'sourceFile', type: 'string', width: 24 },
  { header: 'sourceSheet', field: 'sourceSheet', type: 'string', width: 18 },
  { header: 'sourceRow', field: 'sourceRow', type: 'number', width: 10 },
];

function serialize(col: Col, value: unknown): string | number | boolean | null {
  if (col.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (col.type === 'bool') return value === true ? 'Y' : 'N';
  if (col.type === 'array') return Array.isArray(value) ? value.join('\n') : (value == null ? '' : String(value));
  if (col.type === 'json') return value == null ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  // string
  return value == null ? '' : String(value);
}

/** ExcelJS 셀 값을 평문 문자열로 정규화 */
function cellToString(cell: unknown): string {
  if (cell == null) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (typeof cell === 'object') {
    const o = cell as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (Array.isArray(o.richText)) return o.richText.map(r => (r as { text?: string }).text ?? '').join('');
    if (o.result != null) return String(o.result);
    if (o.hyperlink != null) return String(o.hyperlink);
  }
  return String(cell);
}

function deserialize(col: Col, cell: unknown): unknown {
  const s = cellToString(cell).trim();
  if (col.type === 'number') {
    if (s === '') return null;
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (col.type === 'bool') return /^(y|true|1|예|o)$/i.test(s);
  if (col.type === 'array') return s ? s.split(/\r?\n/).map(x => x.trim()).filter(Boolean) : [];
  if (col.type === 'json') {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }
  // string
  if (s === '') return col.nullable === false ? '' : null;
  return s;
}

export async function buildTestItemsWorkbook(items: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '코아스템켐온 견적 시스템';
  const ws = wb.addWorksheet(SHEET);
  ws.columns = COLUMNS.map(c => ({ header: c.header, key: c.field, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  for (const rec of items) {
    const row: Record<string, string | number | boolean | null> = {};
    for (const c of COLUMNS) row[c.field] = serialize(c, rec[c.field]);
    const added = ws.addRow(row);
    added.alignment = { vertical: 'top', wrapText: true };
  }
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

export async function parseTestItemsWorkbook(buf: Buffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet(SHEET) ?? wb.worksheets[0];
  if (!ws) return [];
  const headerRow = ws.getRow(1);
  const headerToCol = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => headerToCol.set(String(cell.value ?? '').trim(), colNumber));

  const recs: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rec: Record<string, unknown> = {};
    const colNum = headerToCol.get(COLUMNS[0].header);
    const keyVal = colNum ? cellToString(row.getCell(colNum).value).trim() : '';
    if (!keyVal) return; // key 없는 행은 건너뜀 (빈 행 보호)
    for (const c of COLUMNS) {
      const cn = headerToCol.get(c.header);
      rec[c.field] = deserialize(c, cn ? row.getCell(cn).value : '');
    }
    recs.push(rec);
  });
  return recs;
}
