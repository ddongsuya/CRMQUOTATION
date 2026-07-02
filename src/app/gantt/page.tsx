'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { GanttChartSquare, Loader2, FlaskConical, Building2, User, FileText, ChevronRight } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Study = { id: number; itemName: string | null; studyNumber: string | null; director: string | null; requestSentAt: string | null; intakeCompletedAt: string | null; reportDraftDueAt: string | null; reportDraftIssuedAt: string | null; createdAt: string };
type Project = {
  id: number; title: string; modality: string | null; stage: string; status: string;
  companyId: number; companyName: string; contactName: string;
  contractStatus: string | null; contractNumber: string | null; signedAt: string | null;
  quoteId: number | null; quoteNumber: string | null; amount: number | null;
  studyCount: number; studies: Study[];
};

const STAGE: Record<string, { label: string; cls: string }> = {
  INQUIRY: { label: '문의', cls: 'bg-slate-200 text-ink-muted' },
  QUOTE: { label: '견적', cls: 'bg-brand-100 text-brand-700' },
  INTAKE: { label: '접수', cls: 'bg-[#e5f3f2] text-[#207a76]' },
  CONTRACT: { label: '계약', cls: 'bg-[#eaf0f8] text-[#3f6098]' },
  STUDY: { label: '시험진행', cls: 'bg-slate-900 text-white' },
  INVOICE: { label: '정산', cls: 'bg-emerald-100 text-emerald-700' },
  DONE: { label: '완료', cls: 'bg-emerald-100 text-emerald-700' },
};
const won = (n: number | null) => (n == null ? '—' : n >= 1e8 ? `₩${Math.round(n / 1e6).toLocaleString()}M` : `₩${(n / 1e6).toFixed(1)}M`);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '—');

const DAY = 86400_000;
const d = (s: string | null) => (s ? new Date(s) : null);
const studyStart = (s: Study) => d(s.intakeCompletedAt) ?? d(s.requestSentAt) ?? d(s.createdAt)!;
const studyEnd = (s: Study) => d(s.reportDraftIssuedAt) ?? d(s.reportDraftDueAt) ?? new Date(studyStart(s).getTime() + 84 * DAY);
const studyPhase = (s: Study): 'done' | 'active' | 'planned' =>
  s.reportDraftIssuedAt ? 'done' : s.intakeCompletedAt ? 'active' : 'planned';

const projectDone = (p: Project) => p.stage === 'DONE' || (p.studyCount > 0 && p.studies.every(s => s.reportDraftIssuedAt));

export default function GanttPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const [seg, setSeg] = useState<'all' | 'active' | 'done'>('all');
  const [companyId, setCompanyId] = useState<number | null>(null);

  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    const pre = url.get('deal') || url.get('project');
    const co = url.get('company');
    if (co) setCompanyId(Number(co));
    fetch('/api/crm/projects').then(r => r.json()).then(d => {
      const ps: Project[] = d.projects ?? [];
      setProjects(ps);
      const scoped = co ? ps.filter(p => p.companyId === Number(co)) : ps;
      setSel(pre ? Number(pre) : (scoped[0]?.id ?? ps[0]?.id ?? null));
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => projects
    .filter(p => companyId == null || p.companyId === companyId)
    .filter(p => seg === 'all' || (seg === 'done' ? projectDone(p) : !projectDone(p))), [projects, seg, companyId]);
  const current = projects.find(p => p.id === sel) ?? null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><GanttChartSquare className="w-6 h-6 text-brand-500" /> 시험 일정</h1>
          <p className="text-sm text-ink-muted mt-0.5">프로젝트별 비임상 시험 타임라인 — 좌측 프로젝트를 선택하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          {companyId != null && (
            <button onClick={() => setCompanyId(null)} className="pill bg-brand-100 text-brand-700 inline-flex items-center gap-1">
              {projects.find(p => p.companyId === companyId)?.companyName ?? '회사'} 필터 <span className="text-brand-500">✕</span>
            </button>
          )}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {([['all', '전체'], ['active', '진행'], ['done', '완료']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSeg(k)} className={clsx('px-3 py-1.5 rounded-md font-medium transition-colors', seg === k ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}>{l}</button>
          ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>
      ) : projects.length === 0 ? (
        <div className="card p-12 text-center text-sm text-ink-subtle">진행 중인 프로젝트(안건)가 없습니다. 고객 관리에서 안건을 추가하세요.</div>
      ) : (
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-4">
          {/* 좌: 프로젝트 리스트 */}
          <div className="card p-2 self-start max-h-[calc(100vh-180px)] overflow-auto">
            {filtered.map(p => (
              <button key={p.id} onClick={() => setSel(p.id)} className={clsx('w-full text-left rounded-lg px-3 py-2.5 transition-colors', sel === p.id ? 'bg-slate-100' : 'hover:bg-slate-50')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-ink-subtle inline-flex items-center gap-1 min-w-0"><Building2 className="w-3 h-3 shrink-0" /><span className="truncate">{p.companyName}</span></span>
                  <span className={clsx('pill shrink-0', STAGE[p.stage]?.cls ?? 'bg-slate-100')}>{STAGE[p.stage]?.label ?? p.stage}</span>
                </div>
                <div className="text-sm font-semibold text-ink mt-0.5 truncate">{p.title}</div>
                <div className="text-[11px] text-ink-subtle mt-0.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{p.contactName}</span>
                  <span className="inline-flex items-center gap-1"><FlaskConical className="w-3 h-3" />{p.studyCount}건</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="p-6 text-center text-xs text-ink-subtle">해당 상태의 프로젝트가 없습니다.</div>}
          </div>

          {/* 우: 프로젝트 헤더 + 간트 */}
          {current ? (
            <div className="space-y-4 min-w-0">
              <ProjectHeader p={current} />
              <StudyGantt studies={current.studies} />
            </div>
          ) : <div className="card p-12 text-center text-sm text-ink-subtle">프로젝트를 선택하세요.</div>}
        </div>
      )}
    </div>
  );
}

function ProjectHeader({ p }: { p: Project }) {
  const period = p.signedAt ? `${fmtDate(p.signedAt)} ~` : '기간 미정';
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-ink tracking-tight">{p.title}</h2>
            <span className={clsx('pill', STAGE[p.stage]?.cls ?? 'bg-slate-100')}>{STAGE[p.stage]?.label ?? p.stage}</span>
          </div>
          <div className="text-xs text-ink-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            <Link href={`/customers/${p.companyId}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Building2 className="w-3 h-3" />{p.companyName}</Link>
            <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{p.contactName}</span>
            {p.modality && <span>{p.modality}</span>}
            <span>{period}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-ink tabular-nums tracking-tight">{won(p.amount)}</div>
          {p.quoteNumber && <Link href={`/quote/print?id=${p.quoteId}`} className="text-[11px] font-mono text-brand-600 hover:underline inline-flex items-center gap-0.5">{p.quoteNumber} <FileText className="w-3 h-3" /></Link>}
        </div>
      </div>
    </div>
  );
}

const MONTH_W = 104; // px per month
function StudyGantt({ studies }: { studies: Study[] }) {
  const rows = studies.filter(s => s.itemName);
  if (rows.length === 0) return <div className="card p-10 text-center text-sm text-ink-subtle">등록된 시험이 없습니다. 딜 상세에서 시험을 추가하세요.</div>;

  // 타임라인 범위 = 월 단위 (최소 4개월)
  const starts = rows.map(studyStart);
  const ends = rows.map(studyEnd);
  let min = new Date(Math.min(...starts.map(x => +x)));
  let max = new Date(Math.max(...ends.map(x => +x)));
  min = new Date(min.getFullYear(), min.getMonth(), 1);
  max = new Date(max.getFullYear(), max.getMonth() + 1, 0);
  let months = (max.getFullYear() - min.getFullYear()) * 12 + (max.getMonth() - min.getMonth()) + 1;
  if (months < 4) { max = new Date(min.getFullYear(), min.getMonth() + 4, 0); months = 4; }
  const totalDays = (max.getTime() - min.getTime()) / DAY;
  const width = months * MONTH_W;
  const xOf = (dt: Date) => ((dt.getTime() - min.getTime()) / DAY / totalDays) * width;
  const monthCols = Array.from({ length: months }, (_, i) => new Date(min.getFullYear(), min.getMonth() + i, 1));
  const now = new Date();
  const showToday = now >= min && now <= max;

  const PHASE = {
    done: { bar: 'bg-slate-200 border border-slate-300', text: 'text-ink-muted' },
    active: { bar: 'bg-slate-900', text: 'text-white' },
    planned: { bar: 'bg-brand-200 border border-brand-300', text: 'text-brand-800' },
  } as const;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-900" />진행(In-life)</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-200 border border-brand-300" />예정</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-300" />완료</span>
      </div>
      <div className="overflow-x-auto -mx-1 px-1">
        <div style={{ width: width + 220, minWidth: '100%' }}>
          {/* 월 헤더 */}
          <div className="flex border-b border-slate-200 pb-1 mb-1">
            <div style={{ width: 220 }} className="shrink-0" />
            <div className="relative" style={{ width }}>
              {monthCols.map((m, i) => (
                <div key={i} className="absolute top-0 text-[10px] text-ink-subtle border-l border-slate-100 pl-1 tabular-nums" style={{ left: i * MONTH_W, width: MONTH_W }}>
                  {m.getFullYear() % 100}.{String(m.getMonth() + 1).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
          {/* 행 */}
          <div className="relative">
            {showToday && (
              <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: 220 + xOf(now) }}>
                <span className="absolute -top-3 -translate-x-1/2 text-[9px] text-red-500 bg-white px-0.5">오늘</span>
              </div>
            )}
            {rows.map(s => {
              const st = studyStart(s), en = studyEnd(s);
              const ph = studyPhase(s);
              const left = xOf(st), w = Math.max(xOf(en) - left, 10);
              return (
                <div key={s.id} className="flex items-center h-[52px] border-b border-slate-50 last:border-0">
                  <div style={{ width: 220 }} className="shrink-0 pr-3 min-w-0">
                    <div className="text-xs font-medium text-ink truncate">{s.itemName}</div>
                    <div className="text-[10px] text-ink-subtle truncate">{s.studyNumber || '시험번호 미정'}{s.director ? ` · ${s.director}` : ''}</div>
                  </div>
                  <div className="relative h-full flex-1" style={{ width }}>
                    <div className={clsx('absolute top-1/2 -translate-y-1/2 h-7 rounded-md flex items-center px-2 overflow-hidden', PHASE[ph].bar)} style={{ left, width: w }}
                      title={`${s.itemName} · ${fmtDate(st.toISOString())}~${fmtDate(en.toISOString())}`}>
                      <span className={clsx('text-[10px] font-medium truncate', PHASE[ph].text)}>{ph === 'done' ? '완료' : ph === 'active' ? '진행' : '예정'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
