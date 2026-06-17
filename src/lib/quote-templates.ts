/**
 * 견적 템플릿(프리셋) 마스터 데이터 (서버 전용).
 *
 * 모달리티별로 미리 짜둔 시험 구성. 새 견적 작성 시 모달리티 선택 → 템플릿 선택 → tests 가 채워진다.
 * data/_quote_templates.json 에서 읽으며, 관리자 편집기에서 직접 구성한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeBlob } from './blob-store';

export type TemplateTest = { key: string; quantity?: number };
export type QuoteTemplate = {
  id: string;
  name: string;
  modality: string;        // 어느 모달리티의 템플릿인지 (modality key)
  scenario?: string;       // 한 줄 설명
  tests: TemplateTest[];   // 구성 시험 (test_items key)
};

const FILE = '_quote_templates.json';
const BLOB_KEY = 'quote_templates';
function full() { return path.join(path.resolve(process.cwd(), 'data'), FILE); }

let fileCache: QuoteTemplate[] | null = null;
let cache: QuoteTemplate[] | null = null;

function readFile(): QuoteTemplate[] {
  if (fileCache) return fileCache;
  try {
    const j = JSON.parse(fs.readFileSync(full(), 'utf8'));
    fileCache = (Array.isArray(j?.templates) ? j.templates : []) as QuoteTemplate[];
  } catch { fileCache = []; }
  return fileCache;
}

export function loadQuoteTemplates(): QuoteTemplate[] { return cache ?? readFile(); }

/** DB blob('quote_templates')을 파일 seed 위에 overlay. ensureHydrated() 가 호출. */
export function hydrateQuoteTemplates(blobs: Record<string, unknown>): void {
  const b = blobs[BLOB_KEY];
  cache = Array.isArray(b) ? (b as QuoteTemplate[]) : readFile();
}

export function invalidateQuoteTemplates() { cache = null; fileCache = null; }

export function templatesForModality(modality: string): QuoteTemplate[] {
  const m = String(modality ?? '').trim().normalize('NFC');
  return loadQuoteTemplates().filter(t => String(t.modality ?? '').trim().normalize('NFC') === m);
}

/** 전체 templates 를 다시 쓴다 — DB(blob) upsert + 로컬 파일 best-effort(_meta 보존). 검증은 호출부. */
export async function writeQuoteTemplates(templates: QuoteTemplate[]): Promise<void> {
  try {
    let wrapper: Record<string, unknown> = {};
    try { wrapper = JSON.parse(fs.readFileSync(full(), 'utf8')); } catch { wrapper = {}; }
    const meta = (wrapper._meta && typeof wrapper._meta === 'object') ? { ...wrapper._meta as object } : {};
    fs.writeFileSync(full(), JSON.stringify({ _meta: meta, templates }, null, 2) + '\n', 'utf8');
  } catch { /* 읽기전용 FS(Vercel) — DB 로만 영속 */ }
  await writeBlob(BLOB_KEY, templates);
  invalidateQuoteTemplates();
}
