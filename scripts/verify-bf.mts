import { composeFromPlan } from '../src/lib/quote-engine/compose';
const show=(n:string,p:any)=>{const c=composeFromPlan(p);console.log(`\n[${n}] ${c.length}건`);c.forEach(x=>console.log('  -',x.testName));};
show('백신 3군', { modality:'백신', standard:'MFDS', route:'근육', durations:['W4'], species:{rodent:true,nonRodent:false}, addons:{recovery:true}, vaccineGroups:3 });
show('백신 5군', { modality:'백신', standard:'MFDS', route:'근육', durations:['W4'], species:{rodent:true,nonRodent:false}, addons:{recovery:true}, vaccineGroups:5 });
show('건기식 프로바이오틱스', { modality:'건강기능식품', standard:'MFDS', route:'경구', durations:['SINGLE','W13'], species:{rodent:true,nonRodent:false}, addons:{drf:true,recovery:true,genotox:true}, subtype:'프로바이오틱스' });
