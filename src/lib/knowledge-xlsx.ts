/**
 * 지식·근거 데이터 ↔ 엑셀 변환 (서버 전용, exceljs).
 *
 * export 와 import 가 같은 컬럼 스펙을 공유 → 라운드트립(내보내기→수정→가져오기) 무손실.
 *   - array 필드(related_tests·규제근거) : 셀 안에서 줄바꿈으로 구분
 *   - object 필드(checklist)            : JSON 문자열로 저장 (고급 편집)
 */
import ExcelJS from 'exceljs';
import type { KnowledgeDataset } from './knowledge';

type ColType = 'string' | 'array' | 'json';
type Col = { header: string; field: string; type: ColType; width?: number };

export const SHEET_NAME: Record<KnowledgeDataset, string> = {
  guidelines: '가이드라인 사전',
  designRules: '시험설계 규칙',
  modalities: '모달리티별 가이드라인',
};

export const COLUMNS: Record<KnowledgeDataset, Col[]> = {
  guidelines: [
    { header: 'code', field: 'code', type: 'string', width: 18 },
    { header: 'title_ko', field: 'title_ko', type: 'string', width: 30 },
    { header: 'title_en', field: 'title_en', type: 'string', width: 30 },
    { header: 'category', field: 'category', type: 'string', width: 14 },
    { header: 'version', field: 'version', type: 'string', width: 12 },
    { header: 'official_url', field: 'official_url', type: 'string', width: 30 },
    { header: 'confidence', field: 'confidence', type: 'string', width: 12 },
    { header: 'purpose', field: 'purpose', type: 'string', width: 40 },
    { header: 'checklist(JSON)', field: 'checklist', type: 'json', width: 50 },
    { header: '함량분석_관련', field: '함량분석_관련', type: 'string', width: 30 },
    { header: 'related_tests(줄바꿈)', field: 'related_tests', type: 'array', width: 30 },
  ],
  designRules: [
    { header: '시험', field: '시험', type: 'string', width: 22 },
    { header: '별표', field: '별표', type: 'string', width: 12 },
    { header: '시험동물', field: '시험동물', type: 'string', width: 40 },
    { header: '투여경로', field: '투여경로', type: 'string', width: 40 },
    { header: '투여기간_관찰', field: '투여기간_관찰', type: 'string', width: 40 },
    { header: '용량단계', field: '용량단계', type: 'string', width: 40 },
    { header: '선후행_조건부', field: '선후행_조건부', type: 'string', width: 40 },
    { header: 'TK', field: 'TK', type: 'string', width: 30 },
  ],
  modalities: [
    { header: '상위분류', field: '상위분류', type: 'string', width: 24 },
    { header: '모달리티', field: '모달리티', type: 'string', width: 18 },
    { header: '하위분류', field: '하위분류', type: 'string', width: 18 },
    { header: '규제근거(줄바꿈)', field: '규제근거', type: 'array', width: 50 },
    { header: '필수시험구성', field: '필수시험구성', type: 'string', width: 50 },
    { header: '출처', field: '출처', type: 'string', width: 24 },
    { header: '상태', field: '상태', type: 'string', width: 10 },
  ],
};

const DATASETS: KnowledgeDataset[] = ['guidelines', 'designRules', 'modalities'];

function serialize(col: Col, value: unknown): string {
  if (value == null) return '';
  if (col.type === 'array') return Array.isArray(value) ? value.join('\n') : String(value);
  if (col.type === 'json') {
    if (typeof value === 'object') return JSON.stringify(value, null, 0);
    return String(value);
  }
  return String(value);
}

/** ExcelJS 셀 값(문자열·숫자·하이퍼링크·richText·수식결과)을 평문 문자열로 정규화 */
function cellToString(cell: unknown): string {
  if (cell == null) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (typeof cell === 'object') {
    const o = cell as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;                       // hyperlink
    if (Array.isArray(o.richText)) return o.richText.map((r) => (r as { text?: string }).text ?? '').join('');
    if (o.result != null) return String(o.result);                      // formula
    if (o.hyperlink != null) return String(o.hyperlink);
  }
  return String(cell);
}

function deserialize(col: Col, cell: unknown): unknown {
  const s = cellToString(cell).trim();
  if (col.type === 'array') {
    if (!s) return [];
    return s.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  }
  if (col.type === 'json') {
    if (!s) return undefined;
    try { return JSON.parse(s); } catch { return undefined; }
  }
  return s;
}

export type KnowledgeBundle = {
  guidelines: Record<string, unknown>[];
  designRules: Record<string, unknown>[];
  modalities: Record<string, unknown>[];
};

/** 현재 지식 데이터 → 3시트 워크북 buffer */
export async function buildKnowledgeWorkbook(bundle: KnowledgeBundle): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '코아스템켐온 견적 시스템';

  for (const ds of DATASETS) {
    const cols = COLUMNS[ds];
    const ws = wb.addWorksheet(SHEET_NAME[ds]);
    ws.columns = cols.map(c => ({ header: c.header, key: c.field, width: c.width ?? 20 }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const rows = bundle[ds] ?? [];
    for (const rec of rows) {
      const row: Record<string, string> = {};
      for (const c of cols) row[c.field] = serialize(c, rec[c.field]);
      const added = ws.addRow(row);
      added.alignment = { vertical: 'top', wrapText: true };
    }
  }

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

/** 업로드된 워크북 buffer → 3 데이터셋 레코드 배열 (역직렬화). 시트 누락은 빈 배열. */
export async function parseKnowledgeWorkbook(buf: Buffer): Promise<KnowledgeBundle> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const out: KnowledgeBundle = { guidelines: [], designRules: [], modalities: [] };

  for (const ds of DATASETS) {
    const cols = COLUMNS[ds];
    const ws = wb.getWorksheet(SHEET_NAME[ds]);
    if (!ws) continue;
    // 헤더 행 → 컬럼 인덱스 매핑 (헤더 텍스트 기준, 순서 바뀌어도 안전)
    const headerRow = ws.getRow(1);
    const headerToCol = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      headerToCol.set(String(cell.value ?? '').trim(), colNumber);
    });
    const recs: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rec: Record<string, unknown> = {};
      let hasAny = false;
      for (const c of cols) {
        const colNum = headerToCol.get(c.header);
        const raw = colNum ? row.getCell(colNum).value : '';
        const val = deserialize(c, raw);
        if (val !== undefined && !(c.type === 'array' && Array.isArray(val) && val.length === 0)) {
          if (typeof val === 'string' ? val !== '' : true) hasAny = true;
        }
        if (val !== undefined) rec[c.field] = val;
      }
      if (hasAny) recs.push(rec);
    });
    out[ds] = recs;
  }

  return out;
}
