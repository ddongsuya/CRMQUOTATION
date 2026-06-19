/**
 * 정해진 10개 활성 모달리티의 표준 견적 템플릿 복구.
 *
 * - 프리셋(modality_presets.json) 보유 모달리티 → 해당 프리셋 defaultTests
 * - 프리셋 없는 패널형 모달리티 → source key-prefix 로 묶은 소스 마스터 전체
 *
 * 산출: data/_quote_templates.json (seed) + DataBlob 'quote_templates' upsert(Neon, 라이브 즉시반영).
 * 실행: node scripts/seed-quote-templates.js
 */
const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.resolve(__dirname, '..', 'data');
const items = JSON.parse(fs.readFileSync(path.join(dataDir, 'test_items.json'), 'utf8'));
const presets = JSON.parse(fs.readFileSync(path.join(dataDir, 'modality_presets.json'), 'utf8'));
const keyset = new Set(items.map((it) => it.key));

/** 10개 활성 모달리티 정의 (준비중 4개 제외) */
const PLAN = [
  { key: '합성신약',           name: 'IND 1상 최소',              preset: 'IND 1상 최소' },
  { key: '복합제',             name: '복합제 표준 패키지',         src: '복합제_' },
  { key: '백신',               name: 'IND 1상 최소 (백신)',        preset: 'IND 1상 최소 (백신)' },
  { key: '세포치료제',         name: 'IND 1상 최소 (첨단바이오)',  preset: 'IND 1상 최소 (첨단바이오)' },
  { key: '의료기기(ISO10993)', name: '표면 접촉기기 (short-term)', preset: '표면 접촉기기 (short-term)' },
  { key: '화장품',             name: '화장품 표준 패키지',         src: '화장품_' },
  { key: '건강기능식품',       name: '기능성 원료 최소',           preset: '기능성 원료 최소' },
  { key: '스크리닝',           name: '스크리닝 표준 패키지',        src: '스크리닝_' },
  { key: '심혈관계스크리닝',    name: '심혈관계 스크리닝 패키지',    src: '심혈관계스크리닝_' },
  { key: 'in vitro 대사·PK',   name: 'DMPK 표준 패키지',           src: '대사PK_' },
];

const templates = PLAN.map((p) => {
  let tests, scenario;
  if (p.preset) {
    const pr = presets.find((x) => x.modality === p.key && x.presetName === p.preset);
    if (!pr) throw new Error(`프리셋 못찾음: ${p.key} / ${p.preset}`);
    tests = pr.defaultTests.filter((t) => keyset.has(t.key)).map((t) => ({ key: t.key, quantity: 1 }));
    scenario = pr.scenario || '';
  } else {
    // 소스 패널: source key-prefix 로 묶은 전체 (parent/조제물분석 self 행은 제외)
    tests = items
      .filter((it) => String(it.key).startsWith(p.src))
      .filter((it) => !/조제물\s*분석|함량\s*분석/.test(it.testName || ''))
      .map((it) => ({ key: it.key, quantity: 1 }));
    scenario = '소스 마스터 전 항목 — 필요에 맞게 가감하세요.';
  }
  return { id: `tpl-${p.key}-std`, name: p.name, modality: p.key, scenario, tests };
});

// 1) 파일(seed) 저장 — _meta 보존
const file = path.join(dataDir, '_quote_templates.json');
let wrapper = {};
try { wrapper = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
const meta = (wrapper._meta && typeof wrapper._meta === 'object') ? { ...wrapper._meta } : {};
meta.updated = '2026-06-19';
meta.count = templates.length;
fs.writeFileSync(file, JSON.stringify({ _meta: meta, templates }, null, 2) + '\n', 'utf8');

console.log('✅ data/_quote_templates.json 저장 — 템플릿 ' + templates.length + '개');
templates.forEach((t) => console.log('   • ' + t.modality + ' / ' + t.name + ' — 시험 ' + t.tests.length + '개'));

// 2) DataBlob upsert (Neon) — 라이브 즉시반영. DB 없으면 건너뜀.
(async () => {
  if (!process.env.DATABASE_URL) {
    try { require('dotenv').config(); } catch {}
  }
  if (!process.env.DATABASE_URL) { console.log('ℹ DATABASE_URL 없음 — DB upsert 건너뜀(파일만).'); return; }
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.dataBlob.upsert({
      where: { key: 'quote_templates' },
      create: { key: 'quote_templates', json: templates },
      update: { json: templates },
    });
    await prisma.$disconnect();
    console.log('✅ DataBlob "quote_templates" upsert 완료 (Neon) — 라이브 반영됨');
  } catch (e) {
    console.error('⚠ DB upsert 실패(파일은 저장됨):', e.message);
  }
})();
