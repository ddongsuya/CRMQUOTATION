/* 견적 엔진 v2 코어 검증 — S01·단일가폴백·OECD빈칸. 실행: npx tsx scripts/verify-quote-engine.mts */
import { evaluateQuote } from '../src/lib/quote-engine/engine';
import { loadMaster } from '../src/lib/quote-engine/master';

const M = loadMaster();
const byId = (id: string) => M.find(i => i.id === id);
const find = (p: (i: any) => boolean) => M.find(p);

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  cond ? pass++ : fail++;
}

// 1) S01: 설치류 단회(4.6M) + 설치류 13주 반복(112M) = 116.6M (경구·MFDS)
const single = find(i => i.category === '의약품' && /설치류 단회/.test(i.testName ?? '') && i.prices['경구피하근육'].MFDS === 4600000);
const rep13 = find(i => i.category === '의약품' && i.testName === '설치류 13주 반복투여 독성');
const q1 = evaluateQuote({ category: '의약품', standard: 'MFDS', route: '경구',
  selectedItems: [{ id: single!.id }, { id: rep13!.id }] });
check('S01 합계 116,600,000', q1.totals.subtotalKrw === 116600000, q1.totals.subtotalKrw.toLocaleString());

// 2) 단일가 폴백: 복합제 13주독성 2종 개별(165M) — 정맥 선택 → 가격은 165M, 라벨은 '정맥'
const combo = find(i => i.category === '복합제' && /13주 반복투여 독성/.test(i.testName ?? '') && i.componentCount === '2종' && i.analysisMethod === '개별');
const q2 = evaluateQuote({ category: '복합제', standard: 'MFDS', route: '정맥', selectedItems: [{ id: combo!.id }] });
check('복합제 정맥=165M (단일가 폴백)', q2.lineItems[0].unitPrice === 165000000, String(q2.lineItems[0].unitPrice));
check('복합제 라벨=정맥(선택경로 표시)', q2.lineItems[0].route === '정맥');
check('복합제 폴백 노트', q2.lineItems[0].notes.some(n => n.includes('단일가')));

// 3) OECD 빈칸: med-14(생식 배태자 DRF Rabbit) OECD 선택 → missing_info, 가격 null
const q3 = evaluateQuote({ category: '의약품', standard: 'OECD', route: '경구', selectedItems: [{ id: 'med-14' }] });
check('OECD빈칸 → 가격 null', q3.lineItems[0].unitPrice === null);
check('OECD빈칸 → missing_info 사용자확인', q3.missingInfo.some(mi => mi.message.includes('OECD 가격 미정')));


// ── ②-2 규칙 스테이지 ──
// 4) WV: 광독성 + no_uv 조건 → 면제
const photo = find(i => i.category === '의약품' && /광독성/.test(i.testName ?? ''));
const q4 = evaluateQuote({ category:'의약품', standard:'MFDS', route:'경구', selectedItems:[{id:photo!.id}], customerConditions:{ no_uv_absorption_280_480nm:true } });
check('WV 광독성 면제(고객조건 ON)', q4.waivedItems.length===1 && q4.lineItems.length===0, `waived=${q4.waivedItems.length}`);
const q4off = evaluateQuote({ category:'의약품', standard:'MFDS', route:'경구', selectedItems:[{id:photo!.id}] });
check('WV 조건 OFF면 면제 안함', q4off.waivedItems.length===0 && q4off.lineItems.length===1);

// 5) AD: 복귀돌연변이 + 재현시험 요청 → +2,000,000
const ames = find(i => i.category === '의약품' && /복귀\s*돌연변이|Ames/i.test(i.testName ?? ''));
const q5 = evaluateQuote({ category:'의약품', standard:'MFDS', route:'경구', selectedItems:[{id:ames!.id}], requestedAddons:{ reproducibility_recheck:true } });
check('AD 재현시험 +2M', q5.addons.some(a => a.price===2000000), `addons=${JSON.stringify(q5.addons.map(a=>a.price))}`);

// 6) PR: 마우스 발암성 → PR 트리거(루즈매칭)
const mouseCarc = find(i => i.category === '의약품' && i.testName === '발암성 : 마우스');
const q6 = evaluateQuote({ category:'의약품', standard:'MFDS', route:'경구', selectedItems:[{id:mouseCarc!.id}] });
check('PR 마우스발암성 트리거', q6.ruleLog.some(l => l.step==='PR'), `prereq추가=${q6.prerequisitesAdded.length}`);

// 7) SB: 비설치류 13주 + 카테터 → 정맥경피 가격으로 대체
const nonrod = find(i => i.testName === '비설치류 13주 반복투여 독성');
const base7 = evaluateQuote({ category:'의약품', standard:'MFDS', route:'경구', selectedItems:[{id:nonrod!.id}] });
const q7 = evaluateQuote({ category:'의약품', standard:'MFDS', route:'경구', selectedItems:[{id:nonrod!.id}], customerConditions:{ catheter_oral_administration:true } });
const q7line = q7.lineItems.find((l:any)=>l.id===nonrod!.id); const b7line = base7.lineItems.find((l:any)=>l.id===nonrod!.id); check('SB 카테터→정맥가격', q7line.unitPrice===nonrod!.prices['정맥경피'].MFDS && q7line.unitPrice!==b7line.unitPrice, `경구=${b7line.unitPrice}→카테터=${q7line.unitPrice}`);

console.log(`
결과: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
