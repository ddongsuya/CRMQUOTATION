/**
 * File-backed data layer. Loads the seed JSON produced by `scripts/extract_mapping.js`
 * and `scripts/build_presets.js`. Will be replaced by Prisma queries once DB wiring lands.
 */
import fs from 'node:fs';
import path from 'node:path';

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

let cache: {
  testItems: TestItem[];
  blocks: GuidelineBlock[];
  presets: ModalityPreset[];
} | null = null;

function dataDir() { return path.resolve(process.cwd(), 'data'); }

export function loadData() {
  if (cache) return cache;
  const dir = dataDir();
  const testItems = JSON.parse(fs.readFileSync(path.join(dir, 'test_items.json'), 'utf8')) as TestItem[];
  const blocks = JSON.parse(fs.readFileSync(path.join(dir, 'guideline_blocks.json'), 'utf8')) as GuidelineBlock[];
  const presets = JSON.parse(fs.readFileSync(path.join(dir, 'modality_presets.json'), 'utf8')) as ModalityPreset[];
  cache = { testItems, blocks, presets };
  return cache;
}

/** 인-프로세스 캐시 무효화 — 쓰기 후 다음 loadData 가 디스크에서 다시 읽도록 한다.
 *  엔진(assemble·suggest)·검색이 모두 loadData 를 통하므로 편집 즉시 반영된다. */
export function invalidateData() { cache = null; }

/**
 * test_items.json(시험항목·가격 마스터) 전체를 다시 쓴다 — flat array 형식 유지.
 * 검증은 호출부(API)에서 zod 로 끝낸 뒤 호출할 것. 쓰기 후 캐시 무효화.
 */
export function writeTestItems(items: TestItem[]): void {
  const full = path.join(dataDir(), 'test_items.json');
  fs.writeFileSync(full, JSON.stringify(items, null, 2) + '\n', 'utf8');
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
