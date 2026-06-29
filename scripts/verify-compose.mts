import { composeFromPlan } from '../src/lib/quote-engine/compose';
import { evaluateQuote } from '../src/lib/quote-engine/engine';

const plan = {
  modality: '의약품', standard: 'MFDS' as const, route: '경구',
  durations: ['SINGLE', 'W13'], species: { rodent: true, nonRodent: true },
  addons: { drf: true, recovery: true, tk: true, genotox: true, safetyPharm: true },
  tk: { points: 8, sampleOnly: false },
};
const composed = composeFromPlan(plan);
console.log(`구성된 시험 ${composed.length}건:`);
for (const c of composed) console.log('  -', c.testName);

const q = evaluateQuote({ ...plan, selectedItems: composed.map(c => ({ id: c.id })) });
console.log('\n라인:', q.lineItems.length, '| 선행추가:', q.prerequisitesAdded.length, '| 자료요구:', q.documentRequirements.length);
console.log('합계: ₩' + q.totals.subtotalKrw.toLocaleString());

// 복합제 3종 동시
const c2 = composeFromPlan({ modality:'복합제', standard:'MFDS', route:'경구', durations:[], species:{rodent:true,nonRodent:false}, addons:{}, componentCount:3, comboAnalysis:'동시' });
console.log('\n복합제 3종 동시 구성:', c2.length, '건');
