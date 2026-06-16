/**
 * Seed script: 마스터_가이드라인_매핑 JSON → DB
 * Usage: npx prisma db seed
 */
import { PrismaClient, RouteGroup, LinkRelation } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DATA = path.resolve(__dirname, '../data');

type ItemJson = {
  key: string;
  masterId: string;
  sourceFile: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  testName: string | null;
  category: string | null;
  status: string | null;
  modalityPool: string[];
  adminRoute: string | null;
  routeGroup: keyof typeof RouteGroup;
  adminDuration: string | null;
  studyWeeks: number | null;
  priceMfds: number | null;
  priceOecd: number | null;
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

type BlockJson = {
  blockId: string;
  testName: string | null;
  modality: string | null;
  category: string | null;
  weeks: number | null;
};

type MappingJson = {
  itemKey: string;
  blockId: string;
  confidence: string | null;
  reason: string | null;
  needsReview: boolean;
};

const LINK_MAP: Record<string, LinkRelation> = {
  DRF: 'DRF',
  '회복군': 'RECOVERY',
  RECOVERY: 'RECOVERY',
  'GLP_분석': 'GLP_ANALYSIS',
  GLP_ANALYSIS: 'GLP_ANALYSIS',
  조제물분석: 'GLP_ANALYSIS',
  함량분석: 'GLP_ANALYSIS',
  TK: 'TK',
  독성동태: 'TK',
};

async function main() {
  const items: ItemJson[] = JSON.parse(fs.readFileSync(path.join(DATA, 'test_items.json'), 'utf8'));
  const blocks: BlockJson[] = JSON.parse(fs.readFileSync(path.join(DATA, 'guideline_blocks.json'), 'utf8'));
  const mappings: MappingJson[] = JSON.parse(fs.readFileSync(path.join(DATA, 'test_mappings.json'), 'utf8'));

  console.log(`seeding: ${items.length} items / ${blocks.length} blocks / ${mappings.length} mappings`);

  // wipe
  await prisma.testGuidelineMapping.deleteMany();
  await prisma.guidelineBlock.deleteMany();
  await prisma.testItem.deleteMany();

  // guideline blocks
  await prisma.guidelineBlock.createMany({
    data: blocks.map(b => ({
      blockId: b.blockId,
      testName: b.testName ?? '(unknown)',
      modality: b.modality,
      category: b.category,
      weeks: b.weeks,
    })),
    skipDuplicates: true,
  });

  // test items (batched)
  const CHUNK = 100;
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    await prisma.testItem.createMany({
      data: slice.map(it => ({
        key: it.key,
        masterId: it.masterId,
        sourceFile: it.sourceFile,
        sourceSheet: it.sourceSheet,
        sourceRow: it.sourceRow,
        testName: it.testName ?? '(unknown)',
        category: it.category,
        status: it.status,
        modalityPool: it.modalityPool,
        adminRoute: it.adminRoute,
        routeGroup: it.routeGroup as RouteGroup,
        adminDuration: it.adminDuration,
        studyWeeks: it.studyWeeks,
        priceMfds: it.priceMfds,
        priceOecd: it.priceOecd,
        hamryangApply: it.hamryangApply,
        hamryangCount: it.hamryangCount,
        hamryangUnit: it.hamryangUnit,
        hamryangRule: it.hamryangRule,
        excipientBranch: it.excipientBranch,
        linkRelation: it.linkRelation ? (LINK_MAP[it.linkRelation] ?? null) : null,
        parentTest: it.parentTest,
        isPrerequisite: it.isPrerequisite,
        optionality: it.optionality,
        linkBasis: it.linkBasis,
      })),
      skipDuplicates: true,
    });
  }

  // mappings — only where both sides exist
  const validItemKeys = new Set((await prisma.testItem.findMany({ select: { key: true } })).map(x => x.key));
  const validBlockIds = new Set((await prisma.guidelineBlock.findMany({ select: { blockId: true } })).map(x => x.blockId));
  const validMappings = mappings.filter(m => validItemKeys.has(m.itemKey) && validBlockIds.has(m.blockId));

  // dedupe on (itemKey, blockId)
  const seen = new Set<string>();
  const unique = validMappings.filter(m => {
    const k = `${m.itemKey}||${m.blockId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (let i = 0; i < unique.length; i += CHUNK) {
    await prisma.testGuidelineMapping.createMany({
      data: unique.slice(i, i + CHUNK).map(m => ({
        testItemKey: m.itemKey,
        blockId: m.blockId,
        confidence: m.confidence,
        reason: m.reason,
        needsReview: m.needsReview,
      })),
      skipDuplicates: true,
    });
  }

  // modality presets
  const presetsPath = path.join(DATA, 'modality_presets.json');
  if (fs.existsSync(presetsPath)) {
    const presets: Array<{
      modality: string;
      presetName: string;
      scenario: string | null;
      notes: string | null;
      defaultTests: Array<{ key: string; testName: string; adminRoute: string | null; priority: string }>;
    }> = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));

    await prisma.modalityPreset.deleteMany();
    for (const p of presets) {
      await prisma.modalityPreset.create({
        data: {
          modality: p.modality,
          presetName: p.presetName,
          scenario: p.scenario,
          notes: p.notes,
          defaultTests: p.defaultTests as any,
          isActive: true,
        },
      });
    }
    console.log(`seeded ${presets.length} modality presets`);
  }

  console.log('done.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
