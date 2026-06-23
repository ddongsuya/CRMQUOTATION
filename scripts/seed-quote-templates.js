/**
 * 10개 활성 모달리티의 표준 견적 템플릿을 *깨끗하게* 재시드.
 *
 * 각 모달리티의 modality-config 기본 설계값(권장 기본구성)으로 suggest 엔진(/api/plan/suggest)을
 * 돌려, 파라메트릭 자동구성과 동일한 집중 시험세트를 템플릿 tests 로 저장한다.
 * (이전엔 modality_presets.json 의 58개짜리 경로변형 중복 덤프를 그대로 써서 견적이 엉망이었음)
 *
 * 선행: dev 서버 실행(localhost:3000). 실행: node scripts/seed-quote-templates.js
 */
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.SEED_BASE || 'http://localhost:3000';
const dataDir = path.resolve(__dirname, '..', 'data');

// 모달리티별 표준 plan = modality-config 의 기본구성(defaultDurations + default-on addon/category)
const on = (...keys) => Object.fromEntries(keys.map(k => [k, true]));
const PLAN = [
  { key: '합성신약', name: 'IND 1상 표준', scenario: '단회·DRF·13주 반복·회복군·TK·유전독성·안전성약리 (가이드라인 표준)',
    plan: { route: '경구', durations: ['SINGLE', 'W13'], species: { rodent: true, nonRodent: true }, addons: on('drf','recovery','tk','genotox','safetyPharm') } },
  { key: '복합제', name: '복합제 13주 표준', scenario: '설치류 13주 · 2성분 · 개별분석',
    plan: { route: '경구', durations: ['W13'], addons: on('drf','recovery','tk'), comboAnalysis: '개별' }, excipientCount: 2 },
  { key: '백신', name: '백신 표준', scenario: '4주(3회) 반복 + 회복군 + 면역원성 · 2군',
    plan: { route: '근육', durations: [], addons: on('recovery','immunogenicity'), vaccineGroups: 2 } },
  { key: '세포치료제', name: 'IND 1상 (첨단바이오)', scenario: '단회 + 26주 종양원성 + 생체분포 + 유전독성 + 안전성약리',
    plan: { route: '정맥', durations: ['SINGLE','W26'], species: { rodent: true, nonRodent: true }, addons: on('tumorigenicity','biodistribution','genotox','safetyPharm','tk') } },
  { key: '건강기능식품', name: '기능성 원료 표준', scenario: '단회 + 13주 반복 + 회복 + 유전독성 3종',
    plan: { route: '경구', durations: ['SINGLE','W13'], addons: on('drf','recovery','genotox') } },
  // category 모달리티 — categories 기본 ON
  { key: '의료기기(ISO10993)', name: '표면 접촉기기 표준', scenario: 'ISO 10993 — 세포독성·감작·자극·전신독성·유전독성',
    plan: { categories: on('cytotoxicity','sensitization','irritation','systemicToxicity','genotox') } },
  { key: '화장품', name: '기능성화장품 표준 (대체법)', scenario: '단회 + 유전독성 + 피부자극·감작 + 안점막자극',
    plan: { categories: on('singleDose','genotox','skinIrritation','skinSensitization','eyeIrritation') } },
  { key: '스크리닝', name: '1차 스크리닝 표준', scenario: '단회 + 유전독성 스크리닝 3종',
    plan: { categories: on('singleDoseScreen','genotoxScreen') } },
  { key: '심혈관계스크리닝', name: '심혈관 스크리닝', scenario: 'hERG screening',
    plan: { categories: on('hergCh') } },
  { key: 'in vitro 대사·PK', name: 'DMPK 표준 패널', scenario: '대사안정성 + CYP 저해 9종',
    plan: { categories: on('metstab','cyp') } },
];

const PLAN_DEFAULTS = { route: '경구', phase: 'IND1', species: { rodent: true, nonRodent: true }, addons: {}, categories: {}, durations: [], tk: { sessions: 2, points: 8, sampleOnly: false }, vaccineGroups: 2, comboAnalysis: '개별' };

(async () => {
  const templates = [];
  for (const m of PLAN) {
    const plan = { ...PLAN_DEFAULTS, ...m.plan, addons: { ...m.plan.addons }, categories: { ...m.plan.categories } };
    const res = await fetch(`${BASE}/api/plan/suggest`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modality: m.key, plan, priceStandard: 'MFDS', excipientCount: m.excipientCount ?? 0 }),
    });
    if (!res.ok) { console.error(`✖ ${m.key}: suggest HTTP ${res.status}`); continue; }
    const d = await res.json();
    // 중복 key 제거(혹시 모를) + 깨끗한 tests
    const seen = new Set();
    const tests = [];
    for (const h of d.hits) { if (seen.has(h.key)) continue; seen.add(h.key); tests.push({ key: h.key, quantity: 1 }); }
    templates.push({ id: `tpl-${m.key}-std`, name: m.name, modality: m.key, scenario: m.scenario, tests });
    console.log(`• ${m.key} / ${m.name} — 시험 ${tests.length}개`);
  }

  // 파일(seed) 저장
  const file = path.join(dataDir, '_quote_templates.json');
  let wrapper = {};
  try { wrapper = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const meta = (wrapper._meta && typeof wrapper._meta === 'object') ? { ...wrapper._meta } : {};
  meta.updated = '2026-06-19';
  meta.count = templates.length;
  meta.note = '각 모달리티 기본 설계값으로 suggest 엔진을 돌려 만든 깨끗한 표준 구성(파라메트릭과 동일). modality_presets.json(58개 덤프)은 더 이상 사용 안 함.';
  fs.writeFileSync(file, JSON.stringify({ _meta: meta, templates }, null, 2) + '\n', 'utf8');
  console.log(`\n✅ data/_quote_templates.json — ${templates.length}개`);

  // DataBlob upsert (Neon)
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.dataBlob.upsert({ where: { key: 'quote_templates' }, create: { key: 'quote_templates', json: templates }, update: { json: templates } });
    await prisma.$disconnect();
    console.log('✅ DataBlob "quote_templates" upsert (Neon) — 라이브 반영');
  } catch (e) { console.error('⚠ DB upsert 실패(파일은 저장됨):', e.message); }
})();
