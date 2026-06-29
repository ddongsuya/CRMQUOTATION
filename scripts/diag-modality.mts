import { composeFromPlan } from '../src/lib/quote-engine/compose';
import { itemsByCategory } from '../src/lib/quote-engine/master';
const base={standard:'MFDS' as const,route:'정맥',durations:['SINGLE'],species:{rodent:true,nonRodent:true},addons:{tk:true,genotox:true,recovery:true,drf:true,biodistribution:true}};
for(const m of ['세포치료제','화장품','의료기기']){
  const all=itemsByCategory(m);
  const comp=composeFromPlan({...base,modality:m,cellType:'esc_ipsc'} as any);
  const ids=new Set(comp.map(c=>c.id));
  console.log(`\n===== ${m} : 전체 ${all.length} / 자동구성 ${comp.length} =====`);
  for(const it of all) console.log(`  ${ids.has(it.id)?'✔':' '} ${it.testName} | cls=${it.testClass} sp=${it.species} wk=${it.studyWeeks} price=${it.prices['경구피하근육'].MFDS}`);
}
