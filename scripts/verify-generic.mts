import { composeFromPlan } from '../src/lib/quote-engine/compose';
const show=(n:string,p:any)=>{const c=composeFromPlan(p);console.log(`[${n}] ${c.length}건: ${c.slice(0,6).map(x=>x.testName).join(' / ')}${c.length>6?' …':''}`);};
const base={standard:'MFDS' as const,route:'경구',durations:['SINGLE'],species:{rodent:true,nonRodent:true},addons:{}};
for(const m of ['화장품','의료기기','스크리닝','심혈관계스크리닝','in vitro metabolism','PK·분포']) show(m,{...base,modality:m});
