/**
 * 규칙 스테이지 — 33룰을 8단계 파이프라인에 적용.
 *  WV(면제) → SB(대체) → CG(조건부군) → PR(선행·문서) → AD(추가옵션) → PF(가격공식·외삽)
 * 매칭: docs/quote-engine-binding.md §1~4. 규칙 구조에 없는 필드는 관대하게 통과.
 */
import type { MasterItem, QuoteInput, LineItem, MissingInfo, WaivedItem, Addon, DocRequirement } from './types';
import { loadRules, loadMaster } from './master';
import { resolvePrice } from './pricing';

const FILE_TYPE_CAT: Record<string, string> = {
  pharmaceutical_toxicology: '의약품', combination_drug: '복합제', toxicity_screening: '스크리닝',
  medical_device_biosafety: '의료기기', send_ctd_translation: 'SEND·CTD·번역',
  health_food_individual: '건강기능식품', health_food_temporary: '건강기능식품', health_food_probiotics: '건강기능식품',
};
type Crit = Record<string, unknown>;
const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const inc = (hay: string | null | undefined, needle: unknown) => !!hay && typeof needle === 'string' && hay.includes(needle);
// 규칙(613 시험명)과 마스터(426 단축명)의 표기차 흡수: 시험/투여/공백/구분기호 제거 후 부분일치
const norm = (x: string) => x.replace(/시험|투여|반복|\s|[:·()]/g, '');
// 동의어 그룹 — 규칙 표기 ↔ 마스터 표기 (유전독성 등). 한 그룹의 어느 표기든 같은 시험.
const SYN_GROUPS = [
  ['복귀돌연변이', 'Ames', 'TG471'],
  ['염색체이상', 'TG473'],
  ['소핵', 'TG474'],
  ['유전자돌연변이', 'MLA', 'TG490'],
];
function synExpand(needle: string): string[] {
  const n = norm(needle);
  for (const g of SYN_GROUPS) if (g.some(x => n.includes(norm(x)) || norm(x).includes(n))) return g;
  return [needle];
}
const looseInc = (hay: string | null | undefined, needle: unknown): boolean => {
  if (!hay || typeof needle !== 'string') return false;
  return synExpand(needle).some(alt => inc(hay, alt) || (norm(hay).includes(norm(alt)) && norm(alt).length >= 2));
};

function matchFileType(ft: unknown, category: string): boolean {
  if (ft == null) return true;
  return arr(ft).some(f => f === '*' || FILE_TYPE_CAT[f as string] === category || f === category);
}

/** applies_to / trigger 조건을 항목+입력에 대해 평가 */
function itemMatches(item: MasterItem, crit: Crit, input: QuoteInput): boolean {
  if ('file_type' in crit && !matchFileType(crit.file_type, item.category)) return false;
  if ('test_name' in crit && !looseInc(item.testName, crit.test_name)) return false;
  if ('test_name_contains' in crit && !looseInc(item.testName, crit.test_name_contains)) return false;
  if ('test_subcategory_contains' in crit) {
    const v = crit.test_subcategory_contains;
    if (!(inc(item.species, v) || looseInc(item.testName, v) || inc(item.testClass, v))) return false;
  }
  if ('animal_grade' in crit && !inc(item.species, crit.animal_grade)) return false;
  if ('category' in crit && !inc(item.testClass, crit.category)) return false;
  if ('sub_category' in crit && !arr(crit.sub_category).some(s => looseInc(item.testName, s) || inc(item.testClass, s))) return false;
  if ('sub_category_contains' in crit && !(looseInc(item.testName, crit.sub_category_contains) || inc(item.testClass, crit.sub_category_contains))) return false;
  if (crit.sub_type === 'delivery_only' && item.tkMode !== '채혈만') return false;
  if ('route' in crit && !inc(input.route, crit.route)) return false;
  return true;
}
const condOn = (input: QuoteInput, key: unknown) =>
  typeof key === 'string' && !!input.customerConditions?.[key];

export type RuleState = {
  input: QuoteInput;
  lineItems: LineItem[];
  waivedItems: WaivedItem[];
  addons: Addon[];
  prerequisitesAdded: LineItem[];
  documentRequirements: DocRequirement[];
  missingInfo: MissingInfo[];
  ruleLog: { step: string; msg: string }[];
};

function rulesOf(section: string): Crit[] {
  const R = loadRules();
  const main = (R[section] as Crit[]) ?? [];
  const audit = (R[`${section}_v1_1_audit`] as Crit[]) ?? [];
  return [...main, ...audit];
}
const item = (id: string) => loadMaster().find(i => i.id === id);

// ── WV: 면제 (고객조건 ON + 항목 매칭 → 제외) ──
export function applyWaivers(s: RuleState) {
  for (const r of rulesOf('waiver_rules')) {
    const ap = (r.applies_to ?? {}) as Crit;
    if (!matchFileType(ap.file_type, s.input.category)) continue;
    if (!condOn(s.input, r.waiver_condition_key)) continue;
    for (const li of [...s.lineItems]) {
      const it = item(li.id); if (!it || !itemMatches(it, ap, s.input)) continue;
      s.lineItems = s.lineItems.filter(x => x !== li);
      s.waivedItems.push({ id: li.id, testName: li.testName, ruleId: r.id as string, reason: r.waiver_condition_ko as string });
      s.ruleLog.push({ step: 'WV', msg: `${r.id}: 면제 — ${li.testName}` });
    }
  }
}

// ── SB: 대체 (조건 충족 → 정맥경피 가격으로 + 동반시험) ──
export function applySubstitutions(s: RuleState) {
  for (const r of rulesOf('substitution_rules')) {
    const tr = (r.trigger ?? {}) as Crit;
    if (!matchFileType(tr.file_type, s.input.category)) continue;
    if ('sub_condition_key' in tr && !condOn(s.input, tr.sub_condition_key)) continue;
    if ('route' in tr && !inc(s.input.route, tr.route)) continue;
    for (const li of s.lineItems) {
      const it = item(li.id); if (!it || !itemMatches(it, tr, s.input)) continue;
      const sub = (r.substitution ?? {}) as Crit;
      const useFrom = String((sub.use_price_from as Crit)?.sheet ?? '');
      if (useFrom.includes('정맥경피')) {
        const np = it.prices['정맥경피'][s.input.standard] ?? it.prices['경구피하근육'][s.input.standard];
        if (np != null) { li.unitPrice = np; li.amount = np * li.quantity; }
      }
      li.appliedRules.push(r.id as string);
      li.notes.push(String((r.substitution as Crit)?.rationale_ko ?? r.description_ko ?? ''));
      s.ruleLog.push({ step: 'SB', msg: `${r.id}: 대체 — ${li.testName}` });
      for (const comp of arr<Crit>(r.required_companions as Crit[])) {
        const found = loadMaster().find(x => x.category === it.category && inc(x.testName, comp.test_name_contains));
        if (found && !s.lineItems.some(x => x.id === found.id) && !s.prerequisitesAdded.some(x => x.id === found.id)) {
          s.prerequisitesAdded.push(makeLine(found, s.input, [r.id as string], ['동반시험(SB)']));
        }
      }
    }
  }
}

// ── CG: 조건부 군 구성 (조건 ON → 군 변경 노트 + 가격 재산정 플래그) ──
export function applyConditionalGroups(s: RuleState) {
  for (const r of rulesOf('conditional_groups')) {
    const ap = (r.applies_to ?? {}) as Crit;
    if (!matchFileType(ap.file_type, s.input.category)) continue;
    for (const li of s.lineItems) {
      const it = item(li.id); if (!it || !itemMatches(it, ap, s.input)) continue;
      for (const cg of arr<Crit>(r.conditional_groups as Crit[])) {
        if (!condOn(s.input, cg.condition_key)) continue;
        const dg = r.default_groups as Crit, ng = cg.groups as Crit;
        li.notes.push(`군 구성 변경(시험군 ${(dg?.test)}→${(ng?.test)})`);
        li.appliedRules.push(r.id as string);
        if (cg.price_adjustment_required) s.missingInfo.push({ id: li.id, level: 'warning', message: `${li.testName}: ${cg.adjustment_note_ko}` });
        s.ruleLog.push({ step: 'CG', msg: `${r.id}: ${cg.condition_ko}` });
      }
    }
  }
}

// ── PR: 선행 시험·자료·검수 ──
export function applyPrerequisites(s: RuleState) {
  for (const r of rulesOf('prerequisite_rules')) {
    const tr = (r.trigger ?? {}) as Crit;
    const scope = (r.applies_to as Crit)?.scope ?? (tr as Crit)?.scope;
    const triggered = scope === 'all_quotes'
      ? matchFileType((r.applies_to as Crit)?.file_type ?? tr.file_type, s.input.category)
      : s.lineItems.some(li => { const it = item(li.id); return it && Object.keys(tr).length && itemMatches(it, tr, s.input); });
    if (!triggered) continue;
    s.ruleLog.push({ step: 'PR', msg: `${r.id}: ${r.description_ko}` });
    for (const p of arr<Crit>(r.prerequisites as Crit[])) {
      if (p.document_ko) { s.documentRequirements.push({ ruleId: r.id as string, document: p.document_ko as string, mandatory: !!p.mandatory }); continue; }
      if (p.inspection_ko) { s.ruleLog.push({ step: 'PR', msg: `검수: ${p.inspection_ko}` }); continue; }
      if (p.test_name_pattern) {
        const found = loadMaster().find(x => inc(x.testName, String(p.test_name_pattern).replace(/시험|투여/g, '').trim()) && (!p.species_filter || inc(x.species, p.species_filter) || inc(x.testName, p.species_filter)));
        if (found && !s.lineItems.some(x => x.id === found.id) && !s.prerequisitesAdded.some(x => x.id === found.id)) {
          s.prerequisitesAdded.push(makeLine(found, s.input, [r.id as string], [`선행(${p.rationale_ko ?? ''})`]));
        } else if (!found) {
          s.missingInfo.push({ level: 'warning', message: `선행시험 미발견: ${p.test_name_pattern} (${r.id})` });
        }
      }
    }
  }
}

// ── AD: 추가 옵션 (optional은 requestedAddons에서 채택 시만) ──
export function applyAddons(s: RuleState) {
  for (const r of rulesOf('addons')) {
    const ap = (r.applies_to ?? {}) as Crit;
    if (!matchFileType(ap.file_type, s.input.category)) continue;
    const matched = s.lineItems.some(li => { const it = item(li.id); return it && itemMatches(it, ap, s.input); });
    if (!matched) continue;
    const optional = !!r.optional;
    const requested = !!s.input.requestedAddons?.[r.addon_name as string];
    if (optional && !requested) {
      s.ruleLog.push({ step: 'AD', msg: `${r.id}: 추가옵션 가능(미채택) — ${r.addon_name_ko}` });
      continue;
    }
    s.addons.push({ ruleId: r.id as string, name: r.addon_name_ko as string, price: Number(r.price_krw ?? 0), optional, note: r.trigger_ko as string });
    s.ruleLog.push({ step: 'AD', msg: `${r.id}: 추가 — ${r.addon_name_ko} (${Number(r.price_krw ?? 0).toLocaleString()})` });
  }
}

// ── PF: 가격 공식 (PF-001 채혈공식) ──
export function applyPricingFormulas(s: RuleState) {
  for (const r of rulesOf('pricing_formulas')) {
    const ap = (r.applies_to ?? {}) as Crit;
    if (!('formula' in r) || !String(r.formula).includes('bleeding_total_points')) continue;
    for (const li of s.lineItems) {
      const it = item(li.id); if (!it || !itemMatches(it, ap, s.input)) continue;
      const pts = parseInt(String(it.tkPoints ?? '').replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(pts)) continue;
      const price = pts * 30000 + 5000000;
      li.unitPrice = price; li.amount = price * li.quantity;
      li.appliedRules.push(r.id as string);
      li.notes.push(`PF 산출: ${pts}pt × 30,000 + 5,000,000`);
      s.ruleLog.push({ step: 'PF', msg: `${r.id}: ${li.testName} = ${price.toLocaleString()}` });
    }
  }
}

export function makeLine(it: MasterItem, input: QuoteInput, rules: string[] = [], notes: string[] = []): LineItem {
  const pr = resolvePrice(it, input.route, input.standard);
  return {
    id: it.id, testName: it.testName ?? '(이름 없음)', route: input.route,
    unitPrice: pr.ok ? pr.price : null, quantity: 1, amount: pr.ok ? pr.price : null,
    appliedRules: rules, notes: [...notes, ...(pr.ok && pr.fallbackGroup ? ['단일가(경로 무관) 적용'] : [])],
  };
}

export function runRuleStages(s: RuleState) {
  applyWaivers(s);
  applySubstitutions(s);
  applyConditionalGroups(s);
  applyPrerequisites(s);
  applyAddons(s);
  applyPricingFormulas(s);
}
