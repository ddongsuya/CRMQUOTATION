import { composeFromPlan } from '../src/lib/quote-engine/compose';
const tkLines=(c:any[])=>c.filter(x=>/TK|독성동태/i.test(x.testName||''));
const show=(n:string,p:any)=>{const c=composeFromPlan(p);const tk=tkLines(c);console.log(`[${n}] 전체 ${c.length}건 / TK ${tk.length}건: ${tk.map(x=>x.testName).join(' | ')||'없음'}`);};
const cb=(o:any)=>({modality:'복합제',standard:'MFDS' as const,route:'경구',durations:[],species:{rodent:true,nonRodent:false},addons:{tk:true},componentCount:2,comboAnalysis:'개별' as const,...o});
show('복합제 2종개별 8pt 채혈+분석', cb({tk:{points:8,sampleOnly:false}}));
show('복합제 2종개별 6pt 채혈만', cb({tk:{points:6,sampleOnly:true}}));
show('복합제 3종동시 8pt 채혈만', cb({componentCount:3,comboAnalysis:'동시',tk:{points:8,sampleOnly:true}}));
show('복합제 2종개별 TK 미포함', cb({addons:{tk:false},tk:{points:8,sampleOnly:false}}));
show('의약품 13주 8pt 채혈+분석', {modality:'의약품',standard:'MFDS',route:'경구',durations:['W13'],species:{rodent:true,nonRodent:false},addons:{tk:true},tk:{points:8,sampleOnly:false,sessions:2}});
