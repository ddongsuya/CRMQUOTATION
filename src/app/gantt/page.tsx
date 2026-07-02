'use client';

import { useEffect, useMemo, useState } from 'react';
import { GanttChartSquare, Plus, Trash2, Loader2 } from 'lucide-react';
import { schedule, totalWeeks, classifyRole, defaultDurations, ROLE_LABEL, type GanttTask, type GanttRole } from '@/lib/gantt-schedule';
import { toast } from '@/lib/toast';

const ROLES: GanttRole[] = ['PREP', 'SINGLE', 'DRF', 'REPEAT', 'TK', 'GENOTOX', 'SAFETY', 'OTHER'];
const MODALITIES = ['합성신약', '복합제', '백신', '세포치료제', '건강기능식품', '의료기기(ISO10993)', '화장품', '스크리닝', '심혈관계스크리닝', 'in vitro 대사·PK'];

let _id = 0;
const nid = () => `t${++_id}`;
const PX = 15; // 주당 픽셀

function addWeeks(base: string, w: number): string {
  const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + w * 7);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function GanttPage() {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const set = (id: string, p: Partial<GanttTask>) => setTasks(ts => ts.map(t => t.id === id ? { ...t, ...p } : t));
  const remove = (id: string) => setTasks(ts => ts.filter(t => t.id !== id));
  const add = () => setTasks(ts => [...ts, { id: nid(), name: '새 시험', role: 'OTHER', animalWeeks: 4, reportWeeks: 4 }]);

  // 프리셋(모달리티 표준) 불러오기
  const loadPreset = async (modality: string) => {
    setLoading(true);
    try {
      const tpl = (await (await fetch(`/api/quote-templates?modality=${encodeURIComponent(modality)}`)).json()).templates?.[0];
      if (!tpl) { toast.error('해당 모달리티 템플릿이 없습니다.'); return; }
      const items = (await (await fetch('/api/items/by-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keys: tpl.tests.map((t: { key: string }) => t.key) }) })).json()).items as { testName: string; quoteWeeks: number | null }[];
      const next: GanttTask[] = items.filter(it => it.testName).map(it => {
        const role = classifyRole(it.testName);
        const d = defaultDurations(role, it.quoteWeeks);
        return { id: nid(), name: it.testName, role, ...d };
      });
      // 조제물분석(PREP) 없으면 맨 앞에 추가 — 레이아웃 기준점
      if (!next.some(t => t.role === 'PREP')) next.unshift({ id: nid(), name: '투여물질의 조제물 분석', role: 'PREP', animalWeeks: 4, reportWeeks: 4 });
      setTasks(next);
      toast.success(`${modality} 표준 ${next.length}개 시험을 불러왔습니다.`);
    } catch (e) { toast.error(`불러오기 실패: ${e instanceof Error ? e.message : '오류'}`); } finally { setLoading(false); }
  };

  const bars = useMemo(() => {
    const s = schedule(tasks);
    return s.slice().sort((a, b) => a.startWeek - b.startWeek || ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  }, [tasks]);
  const total = useMemo(() => Math.max(totalWeeks(schedule(tasks)), 8), [tasks]);
  const todayWeek = Math.round((Date.now() - new Date(startDate + 'T00:00:00').getTime()) / (7 * 86400_000));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><GanttChartSquare className="w-6 h-6 text-brand-500" /> 시험 일정 간트차트</h1>
          <p className="text-sm text-ink-muted mt-0.5">시험 구성·기간을 입력하면 동물실험 일정을 자동 배치합니다. 프리셋에서 시작해 직접 편집하세요.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <select className="input text-sm w-full sm:w-auto" defaultValue="" onChange={e => { if (e.target.value) loadPreset(e.target.value); e.target.value = ''; }}>
            <option value="">프리셋 불러오기…</option>
            {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-subtle text-xs shrink-0">시작일</span>
            <input type="date" className="input text-sm flex-1 sm:flex-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 편집 테이블 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-ink">시험 구성 ({tasks.length})</h2>
          <button onClick={add} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 시험 추가</button>
        </div>
        {tasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-subtle">{loading ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : '프리셋을 불러오거나 시험을 추가하세요.'}</div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[460px] text-sm">
              <thead><tr className="text-[11px] text-ink-subtle text-left border-b border-slate-100 whitespace-nowrap">
                <th className="py-1.5 pr-2 font-medium">시험명</th><th className="py-1.5 px-2 font-medium w-28">역할</th>
                <th className="py-1.5 px-2 font-medium w-24">동물기간(주)</th><th className="py-1.5 px-2 font-medium w-24">보고서(주)</th><th className="w-8"></th>
              </tr></thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="py-1 pr-2"><input className="input text-sm w-full" value={t.name} onChange={e => set(t.id, { name: e.target.value })} /></td>
                    <td className="py-1 px-2"><select className="input text-sm w-full" value={t.role} onChange={e => set(t.id, { role: e.target.value as GanttRole })}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                    <td className="py-1 px-2"><input type="number" min={0} className="input text-sm w-full" value={t.animalWeeks} onChange={e => set(t.id, { animalWeeks: Math.max(0, Number(e.target.value)) })} /></td>
                    <td className="py-1 px-2"><input type="number" min={0} className="input text-sm w-full" value={t.reportWeeks} onChange={e => set(t.id, { reportWeeks: Math.max(0, Number(e.target.value)) })} /></td>
                    <td className="py-1"><button onClick={() => remove(t.id)} className="p-1.5 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 간트 차트 */}
      {bars.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink mb-3">일정 (총 {total}주 · 약 {Math.round(total / 4.33)}개월)</h2>
          <div className="overflow-x-auto">
            <div style={{ width: total * PX + 200 }}>
              {/* 헤더: 4주(약 1개월) 눈금 */}
              <div className="flex border-b border-slate-200 pb-1 mb-1" style={{ marginLeft: 200 }}>
                {Array.from({ length: Math.ceil(total / 4) }, (_, i) => (
                  <div key={i} className="text-[10px] text-ink-subtle border-l border-slate-100 pl-1" style={{ width: 4 * PX }}>{addWeeks(startDate, i * 4)}</div>
                ))}
              </div>
              {/* 행 */}
              <div className="relative">
                {/* 오늘 선 */}
                {todayWeek >= 0 && todayWeek <= total && (
                  <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: 200 + todayWeek * PX }} title="오늘">
                    <span className="absolute -top-0.5 -translate-x-1/2 text-[9px] text-red-500 bg-white px-0.5">오늘</span>
                  </div>
                )}
                {bars.map(b => (
                  <div key={b.id} className="flex items-center h-7">
                    <div className="text-xs text-ink truncate pr-2" style={{ width: 200 }} title={b.name}>{b.name}</div>
                    <div className="relative flex-1 h-5">
                      {/* 분석(TK validation) — 오렌지 */}
                      {b.validationStart != null && (
                        <div className="absolute h-5 rounded bg-brand-300 border border-brand-400" style={{ left: b.validationStart * PX, width: 4 * PX }} title="생체시료분석(TK validation) 4주" />
                      )}
                      {/* 본시험(동물실험) 바 — ink(polarity) */}
                      <div className="absolute h-5 rounded bg-slate-900 text-white text-[10px] flex items-center px-1 overflow-hidden" style={{ left: b.startWeek * PX, width: Math.max(b.animalWeeks * PX, 8) }} title={`${b.name} — 동물 ${b.animalWeeks}주`}>{b.animalWeeks}주</div>
                      {/* 보고서 꼬리 — 예정(회색) */}
                      {b.reportWeeks > 0 && (
                        <div className="absolute h-5 rounded bg-slate-200 border border-slate-300" style={{ left: b.endWeek * PX, width: b.reportWeeks * PX }} title={`보고서 ${b.reportWeeks}주`} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* 범례 */}
          <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-900" />본시험 진행</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-300 border border-brand-400" />분석·평가</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-300" />예정·보고서</span>
          </div>
        </div>
      )}
    </div>
  );
}
