/**
 * 모달리티 템플릿 마스터 데이터 (서버 전용).
 *
 * 새 견적 위저드의 모달리티 선택 구성(대분류 → 모달리티)을 data/_modality_templates.json 에서
 * 읽는다. 코드에 하드코딩하지 않으므로 관리자 화면에서 분류·모달리티를 직접 편집할 수 있다.
 * 각 모달리티 key 는 suggest.ts / modality-config.ts 의 key 와 일치해야 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeBlob } from './blob-store';

export type TemplateModality = { key: string; label: string; desc?: string; source?: string };
export type TemplateCategory = { id: string; label: string; modalities: TemplateModality[] };

const FILE = '_modality_templates.json';
const BLOB_KEY = 'modality_templates';
function full() { return path.join(path.resolve(process.cwd(), 'data'), FILE); }

let fileCache: TemplateCategory[] | null = null;
let cache: TemplateCategory[] | null = null;

function readFile(): TemplateCategory[] {
  if (fileCache) return fileCache;
  try {
    const j = JSON.parse(fs.readFileSync(full(), 'utf8'));
    fileCache = (Array.isArray(j?.categories) ? j.categories : []) as TemplateCategory[];
  } catch {
    fileCache = [];
  }
  return fileCache;
}

export function loadModalityTemplates(): TemplateCategory[] { return cache ?? readFile(); }

/** DB blob('modality_templates')을 파일 seed 위에 overlay. ensureHydrated() 가 호출. */
export function hydrateModalityTemplates(blobs: Record<string, unknown>): void {
  const b = blobs[BLOB_KEY];
  cache = Array.isArray(b) ? (b as TemplateCategory[]) : readFile();
}

export function invalidateModalityTemplates() { cache = null; fileCache = null; }

/** 전체 categories 를 다시 쓴다 — DB(blob) upsert + 로컬 파일 best-effort(_meta 보존). 검증은 호출부. */
export async function writeModalityTemplates(categories: TemplateCategory[]): Promise<void> {
  try {
    let wrapper: Record<string, unknown> = {};
    try { wrapper = JSON.parse(fs.readFileSync(full(), 'utf8')); } catch { wrapper = {}; }
    const meta = (wrapper._meta && typeof wrapper._meta === 'object') ? { ...wrapper._meta as object } : {};
    fs.writeFileSync(full(), JSON.stringify({ _meta: meta, categories }, null, 2) + '\n', 'utf8');
  } catch { /* 읽기전용 FS(Vercel) — DB 로만 영속 */ }
  await writeBlob(BLOB_KEY, categories);
  invalidateModalityTemplates();
}

/** 위저드/엔진이 공유할 평면 모달리티 키 목록 */
export function templateModalityKeys(): string[] {
  return loadModalityTemplates().flatMap(c => c.modalities.map(m => m.key));
}
