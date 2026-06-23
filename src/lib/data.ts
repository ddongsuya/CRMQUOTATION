/**
 * File-backed data layer. Loads the seed JSON produced by `scripts/extract_mapping.js`
 * and `scripts/build_presets.js`. Will be replaced by Prisma queries once DB wiring lands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeBlob } from './blob-store';

export type TestItem = {
  key: string;
  masterId: string;
  sourceFile: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  testName: string;
  category: string | null;
  status: string | null;
  modalityPool: string[];
  adminRoute: string | null;
  routeGroup: 'A' | 'B' | 'SPECIAL' | 'NONE';
  adminDuration: string | null;
  studyWeeks: number | null;
  quoteWeeks?: number | null;      // 견적 기간(순화+동물+보고서) — 간트 스케줄용
  priceMfds: number | null;
  priceOecd: number | null;
  /** Tiered prices for combo-drug masters (e.g. 복합제: { '2': 20M, '3': 30M, '4': 40M }).
   *  When present, callers should pick a tier based on excipient/component count;
   *  priceMfds remains a sane single-value fallback (= mid tier '3'). */
  priceTiers?: Record<string, number> | null;
  /** Long-form descriptive fields extracted from the raw master xlsx (used by the
   *  PDF "상세 안내" section). All optional and may be absent on legacy rows. */
  detail?: string | null;          // "상세 설명"
  notice?: string | null;          // "주의사항" — may contain [🤝 협의필요] / [✏️ 견적수정] markers
  quoteText?: string | null;       // "원문(견적서)" — the canonical wording used in printed quotes
  guideline?: string | null;       // "가이드라인 핵심내용" / "ICH" / "MFDS" / "OECD TG"
  hamryangApply: string | null;
  hamryangCount: string | null;
  hamryangUnit: number | null;
  hamryangRule: string | null;
  excipientBranch: string | null;
  linkRelation: string | null;
  parentTest: string | null;
  isPrerequisite: boolean;
  optionality: string | null;
  linkBasis: string | null;
};

export type GuidelineBlock = {
  blockId: string;
  testName: string | null;
  modality: string | null;
  category: string | null;
  weeks: number | null;
};

export type PresetTest = {
  key: string;
  testName: string;
  adminRoute: string | null;
  priority: '필수' | '권장' | '옵션';
};

export type ModalityPreset = {
  modality: string;
  presetName: string;
  scenario: string | null;
  notes: string | null;
  defaultTests: PresetTest[];
};

type DataCache = { testItems: TestItem[]; blocks: GuidelineBlock[]; presets: ModalityPreset[] };

// fileCache: 번들 JSON seed (런타임 불변, 1회 읽고 유지).
// cache: 유효 데이터 = fileCache 에 DB blob overlay 적용한 결과. hydrate() 가 갱신.
let fileCache: DataCache | null = null;
let cache: DataCache | null = null;

function dataDir() { return path.resolve(process.cwd(), 'data'); }

function readFiles(): DataCache {
  if (fileCache) return fileCache;
  const dir = dataDir();
  const testItems = JSON.parse(fs.readFileSync(path.join(dir, 'test_items.json'), 'utf8')) as TestItem[];
  const blocks = JSON.parse(fs.readFileSync(path.join(dir, 'guideline_blocks.json'), 'utf8')) as GuidelineBlock[];
  const presets = JSON.parse(fs.readFileSync(path.join(dir, 'modality_presets.json'), 'utf8')) as ModalityPreset[];
  fileCache = { testItems, blocks, presets };
  return fileCache;
}

export function loadData(): DataCache { return cache ?? readFiles(); }

/** DB blob 을 파일 seed 위에 overlay 한다. ensureHydrated() 가 요청 시작 시 호출.
 *  blob 이 없는 데이터셋은 파일값을 유지한다. */
export function hydrateData(blobs: Record<string, unknown>): void {
  const base = readFiles();
  const ti = blobs['test_items'];
  const gb = blobs['guideline_blocks'];
  const mp = blobs['modality_presets'];
  cache = {
    testItems: Array.isArray(ti) ? (ti as TestItem[]) : base.testItems,
    blocks:    Array.isArray(gb) ? (gb as GuidelineBlock[]) : base.blocks,
    presets:   Array.isArray(mp) ? (mp as ModalityPreset[]) : base.presets,
  };
}

/** 인-프로세스 캐시 무효화 — 쓰기 후 다음 loadData/hydrate 가 다시 읽도록 한다. */
export function invalidateData() { cache = null; fileCache = null; }

/**
 * test_items.json(시험항목·가격 마스터) 전체를 다시 쓴다 — flat array 형식 유지.
 * DB(blob)에 upsert 하여 서버리스에서도 영속. 로컬에선 파일에도 best-effort 로 써서
 * git diff 검토 워크플로를 유지한다. 검증은 호출부(API)에서 zod 로 끝낸 뒤 호출할 것.
 */
export async function writeTestItems(items: TestItem[]): Promise<void> {
  try { fs.writeFileSync(path.join(dataDir(), 'test_items.json'), JSON.stringify(items, null, 2) + '\n', 'utf8'); }
  catch { /* 읽기전용 FS(Vercel) — DB 로만 영속 */ }
  await writeBlob('test_items', items);
  invalidateData();
}

export function getItemByKey(key: string): TestItem | undefined {
  return loadData().testItems.find(it => it.key === key);
}

export function listModalities(): string[] {
  const s = new Set<string>();
  for (const it of loadData().testItems) for (const m of it.modalityPool) s.add(m);
  // Ensure modalities that exist as standalone master files but don't tag themselves
  // in modalityPool (e.g. 화장품/복합제/스크리닝/심혈관계스크리닝) still appear in the picker.
  for (const m of ['화장품', '복합제', '스크리닝', '심혈관계스크리닝', 'in vitro 대사·PK']) s.add(m);
  return [...s].sort();
}

export function presetsForModality(modality: string): ModalityPreset[] {
  return loadData().presets.filter(p => p.modality === modality);
}

export function itemsForModality(modality: string): TestItem[] {
  return loadData().testItems.filter(it => it.modalityPool.includes(modality));
}
