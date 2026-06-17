/**
 * 규제 지식(Knowledge) 데이터 레이어.
 *
 * 가이드라인 사전 / 모달리티별 가이드라인 / 시험설계 규칙을 로드한다.
 * 소스 파일(data/_guidelines.json 등)은 통합 마스터 xlsx 와 동일한 단일 진실원천 —
 * 사람이 검토·편집하고, 앱과 xlsx 가 모두 여기서 파생된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeBlob } from './blob-store';

export type Guideline = {
  code: string;
  title_ko: string;
  title_en?: string;
  category: string;
  version?: string;
  official_url?: string;
  confidence?: string;
  purpose?: string;
  checklist?: Record<string, unknown>;
  '함량분석_관련'?: string;
  related_tests?: string[];
};

export type ModalityGuideline = {
  '상위분류': string;
  '모달리티': string;
  '하위분류': string;
  '규제근거': string[];
  '필수시험구성': string;
  '출처': string;
  '상태': string;
};

export type DesignRule = {
  '시험': string;
  '별표': string;
  '시험동물': string;
  '투여경로': string;
  '투여기간_관찰': string;
  '용량단계': string;
  '선후행_조건부': string;
  'TK': string;
};

type KnowledgeCache = { guidelines: Guideline[]; modalities: ModalityGuideline[]; designRules: DesignRule[] };

let fileCache: KnowledgeCache | null = null;
let cache: KnowledgeCache | null = null;

/** 데이터셋 ↔ 소스 파일/래퍼키 매핑 (단일 진실원천: data/*.json) */
export const KNOWLEDGE_FILES = {
  guidelines:  { file: '_guidelines.json',          key: 'guidelines' },
  modalities:  { file: '_modality_guidelines.json', key: 'modalities' },
  designRules: { file: '_mfds_design_rules.json',   key: 'rules' },
} as const;

export type KnowledgeDataset = keyof typeof KNOWLEDGE_FILES;

function dataDir() { return path.resolve(process.cwd(), 'data'); }

function readFiles(): KnowledgeCache {
  if (fileCache) return fileCache;
  const dir = dataDir();
  const read = (f: string) => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
    catch { return null; }
  };
  const g = read(KNOWLEDGE_FILES.guidelines.file);
  const m = read(KNOWLEDGE_FILES.modalities.file);
  const d = read(KNOWLEDGE_FILES.designRules.file);
  fileCache = {
    guidelines: (g?.guidelines ?? []) as Guideline[],
    modalities: (m?.modalities ?? []) as ModalityGuideline[],
    designRules: (d?.rules ?? []) as DesignRule[],
  };
  return fileCache;
}

export function loadKnowledge(): KnowledgeCache { return cache ?? readFiles(); }

/** DB blob('knowledge:<dataset>')을 파일 seed 위에 overlay. ensureHydrated() 가 호출. */
export function hydrateKnowledge(blobs: Record<string, unknown>): void {
  const base = readFiles();
  const g = blobs['knowledge:guidelines'];
  const m = blobs['knowledge:modalities'];
  const d = blobs['knowledge:designRules'];
  cache = {
    guidelines:  Array.isArray(g) ? (g as Guideline[]) : base.guidelines,
    modalities:  Array.isArray(m) ? (m as ModalityGuideline[]) : base.modalities,
    designRules: Array.isArray(d) ? (d as DesignRule[]) : base.designRules,
  };
}

/** 인-프로세스 캐시 무효화 — 쓰기 후 다음 loadKnowledge/hydrate 가 다시 읽도록 한다. */
export function invalidateKnowledge() { cache = null; fileCache = null; }

/**
 * 한 데이터셋(가이드라인/모달리티/설계규칙)의 배열 전체를 다시 쓴다.
 * DB(blob 'knowledge:<dataset>')에 upsert 하여 서버리스에서도 영속. 로컬 파일에도
 * best-effort 로 _meta 래퍼 보존하며 쓴다(git diff 검토용). 검증은 호출부 zod.
 */
export async function writeKnowledgeDataset(dataset: KnowledgeDataset, items: unknown[]): Promise<void> {
  const { file, key } = KNOWLEDGE_FILES[dataset];
  try {
    const full = path.join(dataDir(), file);
    let wrapper: Record<string, unknown> = {};
    try { wrapper = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { wrapper = {}; }
    const meta = (wrapper._meta && typeof wrapper._meta === 'object') ? { ...wrapper._meta as object } : {};
    (meta as Record<string, unknown>).count = items.length;
    fs.writeFileSync(full, JSON.stringify({ _meta: meta, [key]: items }, null, 2) + '\n', 'utf8');
  } catch { /* 읽기전용 FS(Vercel) — DB 로만 영속 */ }
  await writeBlob(`knowledge:${dataset}`, items);
  invalidateKnowledge();
}

export function getGuidelineByCode(code: string): Guideline | undefined {
  return loadKnowledge().guidelines.find(g => g.code === code);
}

/**
 * 시험명 → 근거 가이드라인 코드 매핑 (build-unified-master.js 와 동일 로직).
 * 견적 미리보기에서 각 시험 옆에 "근거: OECD TG 408" 을 붙이는 데 사용.
 */
export function matchGuidelineCodes(testName: string, category?: string): string[] {
  const n = String(testName || '');
  const codes = new Set<string>();
  const has = (c: string) => loadKnowledge().guidelines.some(g => g.code === c);
  const add = (c: string) => { if (has(c)) codes.add(c); };

  // 유전독성
  if (/Ames|TG471|복귀돌연변이|에임스/i.test(n)) add('OECD TG 471');
  if (/염색체이상|TG473/i.test(n)) add('OECD TG 473');
  if (/소핵|TG474/i.test(n)) { add('OECD TG 474'); if (/in vitro/i.test(n)) add('OECD TG 487'); }
  if (/MLA|TG490|thymidine/i.test(n)) add('OECD TG 490');
  if (/Comet|코멧|TG489/i.test(n)) add('OECD TG 489');
  if (/Pig-a|TG470/i.test(n)) add('OECD TG 470');
  if (/유전독성/i.test(n)) add('ICH S2(R1)');

  // 일반독성 (기간)
  if (/4주|28일/i.test(n) && /반복/i.test(n)) add('OECD TG 407');
  if (/13주|90일/i.test(n) && /반복/i.test(n)) { if (/비설치류|개|비글|dog/i.test(n)) add('OECD TG 409'); else add('OECD TG 408'); }
  if (/단회|급성/i.test(n) && !/등급/i.test(n)) add('OECD TG 420');
  if (/등급법/i.test(n)) add('OECD TG 423');
  if (/반복|단회|DRF|회복|TK/i.test(n)) add('ICH M3(R2)');
  if (/26주|39주|만성/i.test(n)) add('ICH S4');

  // 생식발생
  if (/배태자|prenatal/i.test(n)) add('OECD TG 414');
  if (/수태능|생식.*스크리닝/i.test(n)) add('OECD TG 421');
  if (/발달신경/i.test(n)) add('OECD TG 426');
  if (/생식|배태자|수태능|출생|태반이행/i.test(n)) add('ICH S5(R3)');

  // 발암성
  if (/발암성|carcinogen/i.test(n)) { add('OECD TG 451'); add('ICH S1A'); add('ICH S1C(R2)'); }
  if (/52주|만성/i.test(n)) add('OECD TG 452');

  // 안전성약리·TK
  if (/중추신경|호흡기|심혈관|텔레메|Telemetry|안전성약리/i.test(n)) add('ICH S7A');
  if (/hERG|QT|IKr/i.test(n)) add('ICH S7B');
  if (/\bTK\b|독성동태|채혈/i.test(n)) add('ICH S3A');
  if (/면역독성/i.test(n)) add('ICH S8');

  // 국소·감작·대체법
  if (/피부자극/i.test(n)) { add('OECD TG 404'); if (/RhE|대체/i.test(n)) add('OECD TG 439'); }
  if (/안자극|안점막/i.test(n)) { add('OECD TG 405'); if (/RhCE|대체/i.test(n)) add('OECD TG 492'); }
  if (/감작/i.test(n)) { add('OECD TG 406'); if (/LLNA|림프절|BrdU/i.test(n)) add('OECD TG 442B'); }
  if (/광독성/i.test(n)) { add('OECD TG 432'); add('ICH S10'); }
  if (/광감작/i.test(n)) add('ICH S10');

  // 모달리티별
  if (/종양원성/i.test(n)) add('MFDS 줄기세포 종양원성');
  if (/체내분포|QPCR/i.test(n)) add('MFDS 줄기세포 체내분포');
  if (/면역원성/i.test(n) && /동종/i.test(n)) add('MFDS 동종세포 면역원성');
  if (/세포독성|감작성|이식시험|혈액적합/i.test(n)) add('MFDS 의료기기 생물학적평가');
  if (category === '생물의약품' || /항체|재조합/i.test(n)) add('MFDS 생물의약품 비임상');

  return [...codes];
}
