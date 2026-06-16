/**
 * Plan → Test suggestion engine.
 *
 * Now modality-aware: dispatches to per-modality suggestion logic based on
 * MODALITY_PLAN_CONFIG (mode = 'drug' | 'category') and the active addons /
 * categories in the plan.
 */
import type { TestItem } from './data';
import { loadData } from './data';
import type { Plan, Duration } from './store';
import { getModalityConfig } from './modality-config';
import { buildAdvisories, getModalityBasis, type Advisory, type ModalityBasis } from './advisories';

const DURATION_WEEKS: Record<Exclude<Duration, 'SINGLE'>, number> = {
  W4: 4, W13: 13, W26: 26, W39: 39, W52: 52,
};

// ───────────────────────── helpers ─────────────────────────

function matchSpecies(name: string, sp: { rodent: boolean; nonRodent: boolean }): boolean {
  const rod = /설치류|마우스|mouse|rat|랫/i.test(name);
  const non = /비설치류|개|dog|beagle|비글|원숭이|monkey|돼지|pig|미니피그|토끼|rabbit/i.test(name);
  if (!rod && !non) return true;
  if (rod && sp.rodent) return true;
  if (non && sp.nonRodent) return true;
  return false;
}

function matchRoute(item: TestItem, route: string): boolean {
  if (!item.adminRoute) return false;
  return item.adminRoute === route;
}

function matchModality(item: TestItem, modality: string): boolean {
  return item.modalityPool.includes(modality);
}

function matchSource(item: TestItem, sourcePrefix: string): boolean {
  return item.key.startsWith(sourcePrefix);
}

type Hit = { item: TestItem; priority: '필수' | '권장' | '옵션'; tag: string };

function pickPricedCandidate(cands: TestItem[], route: string | null, priceStandard: 'MFDS' | 'OECD'): TestItem | undefined {
  if (cands.length === 0) return undefined;
  const priceOf = (it: TestItem) => priceStandard === 'MFDS' ? it.priceMfds : it.priceOecd;
  const hasPrice = (it: TestItem) => { const v = priceOf(it); return v != null && Number.isFinite(v) && Number(v) > 0; };
  return (
    (route ? cands.find(it => it.adminRoute === route && hasPrice(it)) : undefined) ??
    cands.find(hasPrice) ??
    (route ? cands.find(it => it.adminRoute === route) : undefined) ??
    cands[0]
  );
}

function uniq(arr: Hit[], priceStandard: 'MFDS' | 'OECD', excipientCount: number | undefined): Hit[] {
  const groups = new Map<string, Hit[]>();
  for (const h of arr) {
    const k = `${h.item.testName}|${h.item.adminRoute ?? ''}`;
    const list = groups.get(k);
    if (list) list.push(h); else groups.set(k, [h]);
  }
  const hasPrice = (h: Hit) => {
    const v = priceStandard === 'MFDS' ? h.item.priceMfds : h.item.priceOecd;
    return v != null && Number.isFinite(v) && Number(v) > 0;
  };
  const preferTiers = typeof excipientCount === 'number' && excipientCount >= 2;
  const out: Hit[] = [];
  const seenKey = new Set<string>();
  for (const list of groups.values()) {
    const tiered = preferTiers ? list.find(h => h.item.priceTiers) : undefined;
    const priced = list.find(hasPrice);
    const winner = tiered ?? priced ?? list[0];
    if (seenKey.has(winner.item.key)) continue;
    seenKey.add(winner.item.key);
    out.push(winner);
  }
  return out;
}

function resolveUnitPrice(item: TestItem, std: 'MFDS' | 'OECD', excipientCount: number | undefined): number {
  const tiers = item.priceTiers;
  if (tiers && typeof excipientCount === 'number') {
    const want = excipientCount <= 2 ? '2' : excipientCount === 3 ? '3' : '4';
    const v = tiers[want] ?? tiers['3'] ?? tiers['2'] ?? tiers['4'];
    if (v != null && Number.isFinite(v)) return Number(v);
  }
  const v = std === 'MFDS' ? item.priceMfds : item.priceOecd;
  return v != null && Number.isFinite(v) ? Number(v) : 0;
}

// ───────── 신약군 finders (기존 로직) ──────────

function findRepeatMain(items: TestItem[], modality: string, route: string, weeks: number, sp: Plan['species']): Hit[] {
  const rx = new RegExp(`${weeks}\\s*주\\s*반복`);
  return items
    .filter(it =>
      matchModality(it, modality) && matchRoute(it, route) &&
      (it.studyWeeks === weeks || rx.test(it.testName)) &&
      /반복/.test(it.testName) && !/회복|TK|독성동태/.test(it.testName) &&
      matchSpecies(it.testName, sp),
    )
    .map(it => ({ item: it, priority: '필수' as const, tag: `${weeks}주 본시험` }));
}

function findSingleDose(items: TestItem[], modality: string, route: string, sp: Plan['species']): Hit[] {
  return items
    .filter(it =>
      matchModality(it, modality) && matchRoute(it, route) &&
      /단회|일회|급성/.test(it.testName) && !/회복|DRF/.test(it.testName) &&
      matchSpecies(it.testName, sp),
    )
    .map(it => ({ item: it, priority: '필수' as const, tag: '단회투여' }));
}

function findDRF(items: TestItem[], modality: string, route: string, weeks: number, sp: Plan['species']): Hit[] {
  const drfWeeks = weeks === 4 ? [1, 2] : [4];
  return items
    .filter(it =>
      matchModality(it, modality) && matchRoute(it, route) &&
      /DRF|예비|용량결정/i.test(it.testName) &&
      ((it.studyWeeks != null && drfWeeks.includes(it.studyWeeks)) ||
        drfWeeks.some(w => new RegExp(`${w}\\s*주`).test(it.testName))) &&
      matchSpecies(it.testName, sp),
    )
    .map(it => ({ item: it, priority: '필수' as const, tag: `DRF (${weeks}주용)` }));
}

function findRecovery(items: TestItem[], modality: string, route: string, weeks: number, sp: Plan['species']): Hit[] {
  const recWeeks = weeks === 4 ? 2 : 4;
  const rxBody = new RegExp(`${weeks}\\s*주\\s*반복`);
  const rxRec = new RegExp(`${recWeeks}\\s*주\\s*회복`);
  return items
    .filter(it =>
      matchModality(it, modality) && matchRoute(it, route) &&
      rxBody.test(it.testName) && rxRec.test(it.testName) &&
      matchSpecies(it.testName, sp),
    )
    .map(it => ({ item: it, priority: '권장' as const, tag: `${weeks}주 + ${recWeeks}주 회복군` }));
}

function findTK(items: TestItem[], modality: string, route: string, weeks: number, sp: Plan['species'], tkOpt: Plan['tk']): Hit[] {
  const base = items.filter(it =>
    matchModality(it, modality) && matchRoute(it, route) &&
    /\bTK\b|독성동태|PK\/TK/i.test(it.testName) &&
    (it.studyWeeks === weeks || new RegExp(`${weeks}\\s*주`).test(it.testName)) &&
    matchSpecies(it.testName, sp),
  );
  const filtered = base.filter(it => {
    const name = it.testName;
    const mSess = name.match(/\((\d+)\s*회\)/);
    const mPts = name.match(/(\d+)\s*pt/i);
    const hasSampleOnly = /채혈만/.test(name);
    if (mSess && Number(mSess[1]) !== tkOpt.sessions) return false;
    if (mPts && Number(mPts[1]) !== tkOpt.points) return false;
    if (tkOpt.sampleOnly !== hasSampleOnly) return false;
    return true;
  });
  const chosen: TestItem[] = [];
  if (sp.rodent) {
    const f = filtered.find(it => /설치류|rat|마우스/i.test(it.testName) && !/비설치류/.test(it.testName));
    if (f) chosen.push(f);
  }
  if (sp.nonRodent) {
    const f = filtered.find(it => /비설치류|개|dog|beagle|비글|원숭이|monkey/i.test(it.testName));
    if (f) chosen.push(f);
  }
  if (chosen.length === 0 && filtered.length > 0) chosen.push(filtered[0]);
  return chosen.map(it => ({ item: it, priority: '권장' as const, tag: `${weeks}주 TK · ${tkOpt.sessions}회 ${tkOpt.points}pt${tkOpt.sampleOnly ? ' 채혈만' : ''}` }));
}

function findGenotoxStandard(items: TestItem[], modality: string, route: string, priceStandard: 'MFDS' | 'OECD'): Hit[] {
  const patterns = [
    { rx: /복귀돌연변이|Ames|에임스/, lbl: 'Ames' },
    { rx: /염색체이상/, lbl: '염색체이상' },
    { rx: /소핵/, lbl: '소핵시험' },
  ];
  const hits: Hit[] = [];
  for (const p of patterns) {
    const cands = items.filter(it => matchModality(it, modality) && p.rx.test(it.testName) && !/광|peroxide/i.test(it.testName));
    const cand = pickPricedCandidate(cands, route, priceStandard);
    if (cand) hits.push({ item: cand, priority: '필수' as const, tag: `유전독성·${p.lbl}` });
  }
  return hits;
}

/**
 * 조제물분석(Validation) — 본시험·DRF가 패키지에 들어가면 자동으로 1건 포함.
 * 모달리티별 마스터에 있는 "투여물질의 조제물 분석" 항목을 찾아서 끼워 넣는다.
 */
function findValidation(items: TestItem[], modality: string, route: string, priceStandard: 'MFDS' | 'OECD', sourcePrefix?: string): Hit[] {
  const cands = items.filter(it => {
    if (sourcePrefix) {
      if (!matchSource(it, sourcePrefix)) return false;
    } else if (!matchModality(it, modality)) {
      return false;
    }
    return /조제물\s*분석|함량\s*분석.*Validation|투여물질.*분석/.test(it.testName);
  });
  // Prefer 조제물 분석 (Full Validation 포함) testName 우선
  const validation = cands.find(it => /조제물\s*분석/.test(it.testName)) ?? cands[0];
  if (!validation) return [];
  // Route 일치 우선
  const finalPick = pickPricedCandidate(validation ? cands : [], route, priceStandard) ?? validation;
  return [{ item: finalPick, priority: '필수', tag: '조제물분석 (Validation)' }];
}

function findSafetyPharmStandard(items: TestItem[], modality: string, route: string, priceStandard: 'MFDS' | 'OECD'): Hit[] {
  const patterns = [
    { rx: /hERG|허그/i, lbl: 'hERG' },
    { rx: /중추|CNS|Irwin/i, lbl: 'CNS(중추)' },
    { rx: /호흡/i, lbl: '호흡' },
    { rx: /텔레메|심혈관/i, lbl: '심혈관' },
  ];
  const hits: Hit[] = [];
  for (const p of patterns) {
    const cands = items.filter(it => matchModality(it, modality) && p.rx.test(it.testName));
    const cand = pickPricedCandidate(cands, route, priceStandard);
    if (cand) hits.push({ item: cand, priority: '필수' as const, tag: `안전성약리·${p.lbl}` });
  }
  return hits;
}

// ─────────── 모달리티 전용 finders ─────────────

function findVaccineCore(items: TestItem[], plan: Plan): Hit[] {
  const out: Hit[] = [];
  // 군 구성(2~5군) — 선택 군의 가격 항목을 고른다. 항목명 끝에 "(N군)" 표기.
  const groups = Math.min(5, Math.max(2, Math.round(plan.vaccineGroups ?? 2)));
  const groupRx = new RegExp(`\\(${groups}군\\)`);
  // 해당 군 항목 우선, 없으면(데이터 미복원) 군 표기 없는 기본 항목
  const pickGroup = (cands: TestItem[]) => cands.find(it => groupRx.test(it.testName)) ?? cands.find(it => !/\(\d군\)/.test(it.testName)) ?? cands[0];

  // 백신은 고정 패키지(근육 항목)이므로 경로 필터를 걸지 않는다 (회복·항체와 동일).
  const mains = items.filter(it => matchSource(it, '백신_') && /4주\(3회\) 반복투여/.test(it.testName));
  const main = pickGroup(mains);
  if (main) {
    out.push({ item: main, priority: '필수', tag: `백신 4주(3회) 반복 · ${groups}군` });
  }
  if (plan.addons.recovery) {
    const rec = pickGroup(items.filter(it => matchSource(it, '백신_') && /4주\(3회\).*4주 회복/.test(it.testName)));
    if (rec) out.push({ item: rec, priority: '권장', tag: `백신 4주 회복 · ${groups}군` });
  }
  if (plan.addons.immunogenicity) {
    const imm = pickGroup(items.filter(it => matchSource(it, '백신_') && /항체형성/.test(it.testName)));
    if (imm) out.push({ item: imm, priority: '필수', tag: `면역원성 · ${groups}군` });
  }
  return out;
}

/**
 * 복합제 패키지 — 설치류 13주 기준. 성분 종수(excipientCount)는 priceTiers 로,
 * 분석방식(개별/동시)은 조제물·함량·TK분석 항목명으로 가른다.
 */
function findComboPackage(items: TestItem[], plan: Plan): Hit[] {
  const out: Hit[] = [];
  const analysis = plan.comboAnalysis === '동시' ? '동시' : '개별';
  const combo = items.filter(it => matchSource(it, '복합제_'));
  const pick = (rx: RegExp, priority: Hit['priority'], tag: string) => {
    const it = combo.find(c => rx.test(c.testName));
    if (it) out.push({ item: it, priority, tag });
  };
  // 본시험
  pick(/13주 반복투여 독성/, '필수', '복합제 13주 반복');
  if (plan.addons.drf) pick(/4주 DRF/, '필수', '복합제 4주 DRF');
  if (plan.addons.recovery) pick(/13주 반복 4주 회복/, '권장', '복합제 회복군');
  // TK — 채혈포인트(6/8) × 채혈범위(채혈만/채혈+분석) × 분석방식
  if (plan.addons.tk) {
    const p = plan.tk.points === 6 ? 6 : 8;
    if (plan.tk.sampleOnly) pick(new RegExp(`TK ${p}pt \\(채혈만\\)`), '권장', `복합제 TK ${p}pt 채혈만`);
    else pick(new RegExp(`TK ${p}pt \\(채혈\\+분석·${analysis}\\)`), '권장', `복합제 TK ${p}pt 분석·${analysis}`);
  }
  // 분석 (분석방식에 따라 단가 상이)
  pick(new RegExp(`조제물분석 \\(${analysis}분석\\)`), '필수', `조제물분석·${analysis}`);
  pick(new RegExp(`함량분석 \\(${analysis}분석\\)`), '필수', `함량분석·${analysis}`);
  return out;
}

function findCellTherapyExtras(items: TestItem[], plan: Plan): Hit[] {
  const out: Hit[] = [];
  const isCT = (it: TestItem) => matchSource(it, 'SEND_CTD');
  if (plan.addons.tumorigenicity) {
    items.filter(it => isCT(it) && /종양원성/.test(it.testName))
      .slice(0, 3)
      .forEach(it => out.push({ item: it, priority: '필수', tag: '종양원성' }));
  }
  if (plan.addons.biodistribution) {
    items.filter(it => isCT(it) && /체내분포|체내 분포|조직내 분포|QPCR/.test(it.testName))
      .forEach(it => out.push({ item: it, priority: '필수', tag: '체내분포' }));
  }
  if (plan.addons.reproTox) {
    items.filter(it => isCT(it) && /(생식|배태자|수태능|출생)/.test(it.testName))
      .forEach(it => out.push({ item: it, priority: '권장', tag: '생식독성' }));
  }
  if (plan.addons.carcinogenicity) {
    items.filter(it => isCT(it) && /발암/.test(it.testName))
      .forEach(it => out.push({ item: it, priority: '권장', tag: '발암성' }));
  }
  return out;
}

function findByCategories(items: TestItem[], modality: string, sourcePrefix: string, plan: Plan, mapping: Record<string, RegExp | RegExp[]>): Hit[] {
  const out: Hit[] = [];
  for (const [catId, on] of Object.entries(plan.categories)) {
    if (!on) continue;
    const matchRx = mapping[catId];
    if (!matchRx) continue;
    const rxs = Array.isArray(matchRx) ? matchRx : [matchRx];
    const matched = items.filter(it =>
      matchSource(it, sourcePrefix) &&
      rxs.some(r => r.test(it.testName)),
    );
    matched.forEach(it => out.push({ item: it, priority: '필수', tag: `${modality}·${catId}` }));
  }
  return out;
}

const COSMETIC_CAT_MAP: Record<string, RegExp | RegExp[]> = {
  singleDose: /단회투여|급성/,
  genotox: /Ames|TG471|염색체이상|TG473|소핵|TG474/,
  skinIrritation: /피부자극.*(RhE)|피부자극$/,
  skinSensitization: /피부감작|LLNA/,
  eyeIrritation: /안점막자극|RhCE/,
  phototox: /광독성|3T3 NRU/,
  photosensitization: /광감작|Harber/,
  repeatDermal: /(4주 DRF|13주 반복|13주 회복).*(경피)|(경피).*(4주 DRF|13주 반복|13주 회복)/,
};

const MEDDEV_CAT_MAP: Record<string, RegExp | RegExp[]> = {
  cytotoxicity: /세포독성/,
  sensitization: /감작성|GPMT/,
  irritation: [/피내반응|피부자극|안자극|구강점막 자극/],
  systemicToxicity: /급성전신독성/,
  subAcute: /아급성|4주(?!.*회복)/,
  subChronic: /아만성|13주(?!.*회복)/,
  genotox: /Ames|TG471|복귀돌연변이|염색체이상|TG473|소핵|TG474|MLA|TG490/,
  implantation: /이식시험/,
  pyrogen: /발열성|엔도톡신/,
  hemocompat: /혈액적합성/,
};

const SCREEN_CAT_MAP: Record<string, RegExp | RegExp[]> = {
  singleDoseScreen: /단회투여 독성 스크리닝/,
  repeat2wkScreen: /2주 반복독성 스크리닝/,
  genotoxScreen: /(복귀돌연변이|염색체이상|소핵).*스크리닝/,
  cytotoxScreen: /세포독성 스크리닝/,
  hergScreen: /hERG 스크리닝/,
};

const DMPK_CAT_MAP: Record<string, RegExp | RegExp[]> = {
  metstab: /대사안정성|Metabolic stability/i,
  cyp: /CYP 저해 시험 9종/,
  cyptdi: /CYP 저해 시험 TDI/,
  ppb: /혈장단백결합|Plasma protein binding/i,
  caco2: /Caco-2/i,
  metid: /대사체 확인|Metabolite ID/i,
  lcmsms: /LC-MS\/MS/i,
};

const CV_SCREEN_CAT_MAP: Record<string, RegExp | RegExp[]> = {
  hergCh: /hERG screening/,
  cav12: /Cav1\.2/,
  nav15: /Nav1\.5/,
  mea: /MEA/,
  beaglePilot: /비글 예비/,
  telemetry: /Telemetry/,
};

// ───────────────────── public API ─────────────────────

export type SuggestInput = {
  modality: string;
  plan: Plan;
  priceStandard: 'MFDS' | 'OECD';
  excipientCount?: number;
};

export type SuggestOutput = {
  hits: Array<{
    key: string; testName: string; adminRoute: string | null; studyWeeks: number | null;
    unitPrice: number; priority: '필수' | '권장' | '옵션'; tag: string;
  }>;
  notes: string[];
  /** 계획 기반 자동 경고/안내 (근거 포함) — advisories.ts */
  advisories: Advisory[];
  /** 선택 모달리티의 규제근거(법적 근거 + 필수 시험구성) */
  modalityBasis: ModalityBasis | null;
};

export function suggestFromPlan({ modality, plan, priceStandard, excipientCount }: SuggestInput): SuggestOutput {
  const { testItems } = loadData();
  const notes: string[] = [];
  const out: Hit[] = [];

  if (!modality) { notes.push('모달리티를 선택하세요.'); return { hits: [], notes, advisories: [], modalityBasis: null }; }
  const cfg = getModalityConfig(modality);

  if (cfg.mode === 'category') {
    // category-style modalities: dispatch by modality
    let map: Record<string, RegExp | RegExp[]> | null = null;
    let prefix = '';
    if (modality === '화장품') { map = COSMETIC_CAT_MAP; prefix = '화장품_'; }
    else if (modality === '의료기기(ISO10993)') { map = MEDDEV_CAT_MAP; prefix = '의료기기_'; }
    else if (modality === '스크리닝') { map = SCREEN_CAT_MAP; prefix = '스크리닝_'; }
    else if (modality === '심혈관계스크리닝') { map = CV_SCREEN_CAT_MAP; prefix = '심혈관계스크리닝_'; }
    else if (modality === 'in vitro 대사·PK') { map = DMPK_CAT_MAP; prefix = '대사PK_'; }
    if (map) out.push(...findByCategories(testItems, modality, prefix, plan, map));
    if (!Object.values(plan.categories).some(Boolean)) notes.push('하나 이상의 카테고리를 선택하세요.');
  } else if (modality === '복합제') {
    // 복합제 — 13주 기준 고정 패키지. 종수(excipientCount)·분석방식으로 단가 결정.
    out.push(...findComboPackage(testItems, plan));
    if (!excipientCount || excipientCount < 2) notes.push('성분 종수(2/3/4)를 선택하면 종수별 단가가 적용됩니다. (미선택 시 2종)');
  } else if (modality === '백신') {
    if (!plan.route) notes.push('투여 경로를 선택하세요.');
    out.push(...findVaccineCore(testItems, plan));
    out.push(...findValidation(testItems, modality, plan.route, priceStandard, '백신_'));
  } else if (modality === '건강기능식품') {
    if (!plan.route) notes.push('투여 경로를 선택하세요.');
    if (plan.durations.length === 0) notes.push('본시험 기간을 1개 이상 선택하세요.');
    const sp = { rodent: true, nonRodent: false };
    if (plan.durations.includes('SINGLE')) out.push(...findSingleDose(testItems, modality, plan.route, sp));
    for (const d of plan.durations) {
      if (d === 'SINGLE') continue;
      const w = DURATION_WEEKS[d];
      out.push(...findRepeatMain(testItems, modality, plan.route, w, sp));
      if (plan.addons.drf) out.push(...findDRF(testItems, modality, plan.route, w, sp));
      if (plan.addons.recovery) out.push(...findRecovery(testItems, modality, plan.route, w, sp));
    }
    if (plan.addons.genotox) out.push(...findGenotoxStandard(testItems, modality, plan.route, priceStandard));
    out.push(...findValidation(testItems, modality, plan.route, priceStandard, '건기식_'));
  } else if (modality === '세포치료제') {
    if (!plan.route) notes.push('투여 경로를 선택하세요.');
    if (plan.durations.length === 0) notes.push('본시험/관찰 기간을 1개 이상 선택하세요.');
    if (plan.durations.includes('SINGLE')) out.push(...findSingleDose(testItems, modality, plan.route, plan.species));
    for (const d of plan.durations) {
      if (d === 'SINGLE') continue;
      const w = DURATION_WEEKS[d];
      out.push(...findRepeatMain(testItems, modality, plan.route, w, plan.species));
      if (plan.addons.recovery) out.push(...findRecovery(testItems, modality, plan.route, w, plan.species));
      if (plan.addons.tk) out.push(...findTK(testItems, modality, plan.route, w, plan.species, plan.tk));
    }
    if (plan.addons.genotox) out.push(...findGenotoxStandard(testItems, modality, plan.route, priceStandard));
    if (plan.addons.safetyPharm) out.push(...findSafetyPharmStandard(testItems, modality, plan.route, priceStandard));
    out.push(...findCellTherapyExtras(testItems, plan));
    out.push(...findValidation(testItems, modality, plan.route, priceStandard, 'SEND_CTD'));
  } else {
    // 신약 풀패키지 (합성신약, 생물의약품, 항암제, 펩타이드, 바이오시밀러, ADC, 이중특이항체, 방사성, 유전자, 핵산)
    if (!plan.route) notes.push('투여 경로를 선택하세요.');
    if (plan.durations.length === 0) notes.push('본시험 기간을 1개 이상 선택하세요.');
    if (plan.durations.includes('SINGLE')) out.push(...findSingleDose(testItems, modality, plan.route, plan.species));
    for (const d of plan.durations) {
      if (d === 'SINGLE') continue;
      const w = DURATION_WEEKS[d];
      out.push(...findRepeatMain(testItems, modality, plan.route, w, plan.species));
      if (plan.addons.drf) out.push(...findDRF(testItems, modality, plan.route, w, plan.species));
      if (plan.addons.recovery) out.push(...findRecovery(testItems, modality, plan.route, w, plan.species));
      if (plan.addons.tk) out.push(...findTK(testItems, modality, plan.route, w, plan.species, plan.tk));
    }
    if (plan.addons.genotox) out.push(...findGenotoxStandard(testItems, modality, plan.route, priceStandard));
    if (plan.addons.safetyPharm) out.push(...findSafetyPharmStandard(testItems, modality, plan.route, priceStandard));
    // 신약군: 복합제 마스터(부형제 2종 이상) 또는 독성시험 마스터에서 Validation 1건
    out.push(...findValidation(testItems, modality, plan.route, priceStandard,
      typeof excipientCount === 'number' && excipientCount >= 2 ? '복합제_' : undefined));
  }

  // sort
  const rank = (tag: string): number => {
    if (tag.startsWith('조제물분석') || /Validation/i.test(tag)) return 0;
    if (tag.startsWith('단회')) return 1;
    if (tag.startsWith('DRF')) return 2;
    if (/본시험/.test(tag)) return 3;
    if (/회복군/.test(tag) || tag.includes('회복')) return 3.5;
    if (tag.includes('TK') || tag.includes('PK/TK')) return 3.7;
    if (tag.startsWith('유전독성')) return 4;
    if (tag.startsWith('안전성약리')) return 5;
    if (tag === '면역원성' || tag === '종양원성' || tag === '체내분포') return 6;
    if (tag === '생식독성' || tag === '발암성') return 7;
    return 99;
  };
  const speciesRank = (name: string): number => {
    if (/설치류|rat|마우스|mouse/i.test(name) && !/비설치류/.test(name)) return 1;
    if (/비설치류|개|dog|beagle|비글|원숭이|monkey/i.test(name)) return 2;
    return 3;
  };
  const sorted = uniq(out, priceStandard, excipientCount).sort((a, b) => {
    const d = rank(a.tag) - rank(b.tag);
    if (d !== 0) return d;
    const sa = speciesRank(a.item.testName), sb = speciesRank(b.item.testName);
    if (sa !== sb) return sa - sb;
    const wa = a.item.studyWeeks ?? 0, wb = b.item.studyWeeks ?? 0;
    if (wa !== wb) return wa - wb;
    return a.item.testName.localeCompare(b.item.testName);
  });

  const hits = sorted.map(h => ({
    key: h.item.key,
    testName: h.item.testName,
    adminRoute: h.item.adminRoute,
    studyWeeks: h.item.studyWeeks,
    unitPrice: resolveUnitPrice(h.item, priceStandard, excipientCount),
    priority: h.priority,
    tag: h.tag,
  }));

  const advisories = buildAdvisories(modality, plan);
  const modalityBasis = getModalityBasis(modality);

  return { hits, notes, advisories, modalityBasis };
}
