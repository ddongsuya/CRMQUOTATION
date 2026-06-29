import { composeFromPlan } from '../src/lib/quote-engine/compose';
const show = (name: string, plan: any) => { const c = composeFromPlan(plan); console.log(`\n[${name}] ${c.length}건`); c.forEach(x => console.log('  -', x.testName)); };
show('백신', { modality:'백신', standard:'MFDS', route:'근육', durations:['W4'], species:{rodent:true,nonRodent:false}, addons:{recovery:true} });
show('건기식 13주', { modality:'건강기능식품', standard:'MFDS', route:'경구', durations:['SINGLE','W13'], species:{rodent:true,nonRodent:false}, addons:{drf:true,recovery:true,genotox:true} });
show('세포 ESC/iPSC', { modality:'세포치료제', standard:'MFDS', route:'정맥', durations:['SINGLE'], species:{rodent:true,nonRodent:false}, addons:{biodistribution:true}, cellType:'esc_ipsc' });
show('세포 성체', { modality:'세포치료제', standard:'MFDS', route:'정맥', durations:[], species:{rodent:true,nonRodent:false}, addons:{}, cellType:'adult' });
show('의약품 안전성약리 국내', { modality:'의약품', standard:'MFDS', route:'경구', durations:['W13'], species:{rodent:true,nonRodent:false}, addons:{safetyPharm:true}, submissionTarget:'국내' });
show('의약품 안전성약리 USFDA', { modality:'의약품', standard:'MFDS', route:'경구', durations:['W13'], species:{rodent:true,nonRodent:false}, addons:{safetyPharm:true}, submissionTarget:'USFDA' });
