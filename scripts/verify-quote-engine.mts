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

console.log(`\n결과: ${pass} pass / ${fail} fail`);
if (byId('med-14')) console.log('med-14:', byId('med-14')!.testName);
process.exit(fail ? 1 : 0);
