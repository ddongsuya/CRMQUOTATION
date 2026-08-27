'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { GanttChartSquare, Loader2, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { quoteStatus } from '@/lib/admin/status';

type Quote = { id: number; quoteNumber: string; grandTotal: number | null; totalAfterDiscount: number | null; currency: string; status: string; sentAt: string | null; accepted: boolean | null; createdAt: string };
type PaymentTerm = { id: number; seq: number; kind: string; ratio: number | null; amount: number | null; condition: string | null; dueAt: string | null; paidAt: string | null };
type Contract = { id: number; status: string; contractNumber: string | null; costEstimateSentAt: string | null; draftSentAt: string | null; approvedAt: string | null; signedAt: string | null; paymentTerms: PaymentTerm[] };
type Study = { id: number; itemName: string | null; studyNumber: string | null; department: string | null; director: string | null; requestSentAt: string | null; studyEndAt: string | null; intakeCompletedAt: string | null; reportDraftDueAt: string | null; reportDraftIssuedAt: string | null; invoiceRequestedAt: string | null; invoiceIssuedAt: string | null };
type ChangeQuote = { id: number; kind: string; amount: number; reason: string; createdAt: string };
type Note = { id: number; type: string; title: string | null; body: string; occurredAt: string };
type Deal = {
  id: number; title: string; modality: string | null; indication: string | null; clinicalDesign: string | null;
  submissionTarget: string | null; reportLanguage: string; translationRequested: boolean; stage: string; status: string; lostReason: string | null;
  contact: { id: number; name: string; position: string | null; company: { id: number; name: string; isNewClient: boolean } };
  quotes: Quote[]; contract: Contract | null; studies: Study[]; changeQuotes: ChangeQuote[]; notes: Note[];
};

const STAGES = [
  { k: 'INQUIRY', label: '문의접수' }, { k: 'QUOTE', label: '견적' }, { k: 'INTAKE', label: '시험접수' },
  { k: 'CONTRACT', label: '계약' }, { k: 'STUDY', label: '시험진행' }, { k: 'INVOICE', label: '세금계산서' }, { k: 'DONE', label: '완료' },
];
const won = (s: string) => STAGES.findIndex(x => x.k === s);
const fmtMoney = (n: number | null, cur = 'KRW') => n == null ? '-' : (cur === 'USD' ? '$' : '₩') + n.toLocaleString();
const fmtDate = (d: string | null) => d ? new Date(d).toISOString().slice(0, 10) : '';

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<Deal | null>(null);
  const load = useCallback(() => fetch(`/api/crm/deals/${id}`).then(r => r.json()).then(d => setDeal(d.deal ?? null)).catch(() => {}), [id]);
  useEffect(() => { load(); }, [load]);

  const patchDeal = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/crm/deals/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) load(); else toast.error('수정 실패');
  };

  if (!deal) return <div className="card p-12 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 불러오는 중…</div>;
  const curIdx = won(deal.stage);

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href={`/customers/${deal.contact.company.id}`} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"><Icon name="chevron-left" className="w-3.5 h-3.5" /> {deal.contact.company.name}</Link>

      {/* 헤더 */}
      <div className="card p-[22px]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">{deal.title}</h1>
            <div className="text-xs text-ink-muted mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
              <span>{deal.contact.company.name} · {deal.contact.name}{deal.contact.position ? ` (${deal.contact.position})` : ''}</span>
              {deal.modality && <span>{deal.modality}</span>}
              {deal.indication && <span>적응증: {deal.indication}</span>}
              {deal.submissionTarget && <span>{deal.submissionTarget}</span>}
              <span className={clsx('pill', deal.reportLanguage === 'EN' ? 'tone-blue' : 'bg-slate-100 text-ink-muted')}>{deal.reportLanguage === 'EN' ? '영문보고서' : '국문보고서'}</span>
            </div>
            {deal.clinicalDesign && <div className="text-xs text-ink-subtle mt-2 whitespace-pre-wrap">{deal.clinicalDesign}</div>}
          </div>
          <div className="flex items-center gap-1.5">
            {deal.status === 'ACTIVE' ? (
              <>
                <button onClick={() => patchDeal({ status: 'WON' })} className="btn-outline text-xs">수주</button>
                <button onClick={() => { const r = prompt('진행 불가 사유:'); if (r != null) patchDeal({ status: 'LOST', lostReason: r }); }} className="btn-ghost text-xs text-red-600">중단</button>
              </>
            ) : (
              <span className="pill bg-slate-100 text-ink-body">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: deal.status === 'WON' ? 'var(--success)' : 'var(--error)' }} />
                {deal.status === 'WON' ? '수주' : `중단${deal.lostReason ? ` · ${deal.lostReason}` : ''}`}
              </span>
            )}
          </div>
        </div>

        {/* 단계 스테퍼 (클릭 시 단계 설정) */}
        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => (
            <button key={s.k} onClick={() => patchDeal({ stage: s.k })}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                i < curIdx ? 'bg-brand-50 text-brand-600' : i === curIdx ? 'bg-brand-600 text-white' : 'text-ink-subtle hover:bg-slate-100')}>
              {i < curIdx ? <Icon name="check" className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}{s.label}
            </button>
          ))}
        </div>
      </div>

      <SectionQuotes deal={deal} />
      <SectionContract deal={deal} reload={load} />
      <SectionStudies deal={deal} reload={load} />
      <SectionChangeQuotes deal={deal} reload={load} />
      <SectionNotes deal={deal} reload={load} />
    </div>
  );
}

function SectionNotes({ deal, reload }: { deal: Deal; reload: () => void }) {
  const today = () => new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: 'MEETING', body: '', occurredAt: today() });
  const add = async () => {
    if (!f.body.trim()) { toast.error('내용을 입력하세요.'); return; }
    const res = await fetch('/api/crm/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, occurredAt: f.occurredAt || undefined, dealId: deal.id, contactId: deal.contact.id }) });
    if (res.ok) { setF({ type: 'MEETING', body: '', occurredAt: today() }); setOpen(false); reload(); } else toast.error('실패');
  };
  const del = async (id: number) => { const res = await fetch(`/api/crm/notes/${id}`, { method: 'DELETE' }); if (res.ok) reload(); };
  const TLABEL: Record<string, string> = { MEETING: '미팅', CALL: '통화', MEMO: '메모' };
  return (
    <Card title={`기록 ${deal.notes.length}건`}
      action={<button onClick={() => setOpen(v => !v)} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 기록 추가</button>}>
      {open && (
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {['MEETING', 'CALL', 'MEMO'].map(t => <button key={t} onClick={() => setF(p => ({ ...p, type: t }))} className={clsx('chip', f.type === t ? 'chip-active' : 'chip-inactive')}>{TLABEL[t]}</button>)}
            <input type="date" className="input text-sm ml-auto w-auto" title="대화·미팅 날짜" value={f.occurredAt} onChange={e => setF(p => ({ ...p, occurredAt: e.target.value }))} />
          </div>
          <textarea className="input w-full min-h-[70px]" value={f.body} onChange={e => setF(p => ({ ...p, body: e.target.value }))} placeholder="미팅·상담 내용…" autoFocus />
          <div className="flex justify-end"><button onClick={add} className="btn-primary text-sm">저장</button></div>
        </div>
      )}
      {deal.notes.length === 0 ? <div className="text-xs text-ink-subtle py-1">기록 없음.</div> : (
        <ul className="space-y-2">
          {deal.notes.map(n => (
            <li key={n.id} className="flex items-start gap-2 group">
              <span className="pill bg-slate-100 text-ink-muted flex-shrink-0 mt-0.5">{TLABEL[n.type] ?? '메모'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-muted whitespace-pre-wrap">{n.body}</div>
                <div className="text-[11px] text-ink-subtle mt-0.5">{n.occurredAt.slice(0, 10)}</div>
              </div>
              <button onClick={() => del(n.id)} className="p-1 rounded text-ink-subtle hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-[22px]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function SectionQuotes({ deal }: { deal: Deal }) {
  return (
    <Card title={`견적서 ${deal.quotes.length}건`}
      action={<Link href={`/quote-v2?dealId=${deal.id}`} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 이 안건으로 견적 작성</Link>}>
      {deal.quotes.length === 0 ? <div className="text-xs text-ink-subtle py-1">아직 견적이 없습니다.</div> : (
        <ul className="divide-y divide-slate-300">
          {deal.quotes.map(q => {
            const st = quoteStatus(q.status);
            const supply = q.totalAfterDiscount ?? (q.grandTotal != null ? Math.round(q.grandTotal / 1.1) : null);
            return (
            <li key={q.id}>
              <Link href={`/quote/print?id=${q.id}`} className="flex items-center gap-3 py-2 hover:bg-slate-50 -mx-1 px-1 rounded-lg">
                <span className="text-xs text-ink-subtle font-mono w-32 truncate">{q.quoteNumber}</span>
                <span className="flex-1 text-sm font-semibold text-ink tabular-nums">{fmtMoney(supply, q.currency)} <span className="text-[10px] font-normal text-ink-subtle">VAT 별도</span></span>
                <span className="pill bg-slate-100 text-ink-body"><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}</span>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const KIND_LABEL: Record<string, string> = { ADVANCE: '선금', INTERIM: '중도금', BALANCE: '잔금' };

function SectionContract({ deal, reload }: { deal: Deal; reload: () => void }) {
  const c = deal.contract;
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const res = await fetch('/api/crm/contracts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId: deal.id }) });
    setBusy(false);
    if (res.ok) { toast.success('계약 시작 — 기본 지급조건(선금50/잔금50) 생성'); reload(); } else toast.error('실패');
  };
  const patch = async (data: Record<string, unknown>) => {
    if (!c) return;
    const res = await fetch(`/api/crm/contracts/${c.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) reload(); else toast.error('수정 실패');
  };

  if (!c) return (
    <Card title="계약">
      <button onClick={start} disabled={busy} className="btn-ghost text-xs">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon name="plus" className="w-3.5 h-3.5" />} 계약 시작 (견적 기반)</button>
    </Card>
  );

  return (
    <Card title="계약">
      <div className="grid sm:grid-cols-2 gap-3">
        <Labeled label="상태">
          <select className="input w-full text-sm" value={c.status} onChange={e => patch({ status: e.target.value })}>
            {([['DRAFT', '초안'], ['SENT', '송부'], ['REVIEWED', '검토'], ['APPROVED', '승인'], ['SIGNED', '체결']] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Labeled>
        <Labeled label="계약번호"><input className="input w-full text-sm" defaultValue={c.contractNumber ?? ''} onBlur={e => e.target.value !== (c.contractNumber ?? '') && patch({ contractNumber: e.target.value })} placeholder="사업지원팀 부여" /></Labeled>
        <DateField label="예정원가·안분 송부" value={c.costEstimateSentAt} onChange={v => patch({ costEstimateSentAt: v })} />
        <DateField label="초안 송부" value={c.draftSentAt} onChange={v => patch({ draftSentAt: v })} />
        <DateField label="승인" value={c.approvedAt} onChange={v => patch({ approvedAt: v })} />
        <DateField label="최종 날인" value={c.signedAt} onChange={v => patch({ signedAt: v })} />
      </div>
      <PaymentTermsEditor key={JSON.stringify(c.paymentTerms.map(t => t.id))} contractId={c.id} terms={c.paymentTerms} reload={reload} />
    </Card>
  );
}

// ─── 지급 회차 편집 — 회차·비율·조건·기한·입금일 전체 편집 (PATCH paymentTerms 전체 교체) ───
function PaymentTermsEditor({ contractId, terms, reload }: { contractId: number; terms: PaymentTerm[]; reload: () => void }) {
  type Row = { kind: string; ratio: string; condition: string; dueAt: string; paidAt: string };
  const toRow = (t: PaymentTerm): Row => ({
    kind: t.kind, ratio: t.ratio != null ? String(Math.round(t.ratio * 100)) : '',
    condition: t.condition ?? '', dueAt: fmtDate(t.dueAt), paidAt: fmtDate(t.paidAt),
  });
  const [rows, setRows] = useState<Row[]>(terms.map(toRow));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (i: number, k: keyof Row, v: string) => { setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r)); setDirty(true); };
  const addRow = (preset?: Row[]) => { setRows(rs => preset ?? [...rs, { kind: 'INTERIM', ratio: '', condition: '', dueAt: '', paidAt: '' }]); setDirty(true); };
  const removeRow = (i: number) => { setRows(rs => rs.filter((_, j) => j !== i)); setDirty(true); };
  const DEFAULT_ROWS: Row[] = [
    { kind: 'ADVANCE', ratio: '50', condition: '계약 체결 시', dueAt: '', paidAt: '' },
    { kind: 'BALANCE', ratio: '50', condition: '최종보고서(안) 발행 + 30일', dueAt: '', paidAt: '' },
  ];
  const save = async () => {
    setBusy(true);
    const res = await fetch(`/api/crm/contracts/${contractId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        paymentTerms: rows.map((r, i) => ({
          seq: i + 1, kind: r.kind,
          ratio: r.ratio.trim() ? Number(r.ratio) / 100 : null, amount: null,
          condition: r.condition.trim() || null,
          dueAt: r.dueAt || null, paidAt: r.paidAt || null,
        })),
      }),
    });
    setBusy(false);
    if (res.ok) { toast.success('지급 회차 저장됨'); setDirty(false); reload(); } else toast.error('저장 실패');
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <div className="label">지급 회차</div>
        <div className="flex items-center gap-1.5">
          {rows.length === 0 && <button onClick={() => addRow(DEFAULT_ROWS)} className="btn-ghost text-xs">기본 회차 (선금50/잔금50)</button>}
          <button onClick={() => addRow()} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 회차 추가</button>
          {dirty && <button onClick={save} disabled={busy} className="btn-primary text-xs">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} 저장</button>}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-subtle py-1">지급 회차가 없습니다. 기본 회차를 생성하거나 직접 추가하세요.</p>
      ) : (
        <div className="space-y-1.5">
          {/* 헤더 (sm↑) */}
          <div className="hidden sm:grid grid-cols-[90px_70px_1fr_130px_130px_28px] gap-1.5 text-[10px] text-ink-subtle px-0.5">
            <span>회차</span><span>비율 %</span><span>조건</span><span>지급 기한</span><span>입금일</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[90px_70px_1fr_130px_130px_28px] gap-1.5 items-center rounded-lg border border-slate-100 sm:border-0 p-2 sm:p-0">
              <select className="input text-sm" value={r.kind} onChange={e => set(i, 'kind', e.target.value)}>
                {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input type="number" min={0} max={100} className="input text-sm" placeholder="%" value={r.ratio} onChange={e => set(i, 'ratio', e.target.value)} />
              <input className="input text-sm col-span-2 sm:col-span-1" placeholder="조건 (예: 계약 체결 시)" value={r.condition} onChange={e => set(i, 'condition', e.target.value)} />
              <input type="date" className="input text-sm" title="지급 기한" value={r.dueAt} onChange={e => set(i, 'dueAt', e.target.value)} />
              <div className="flex items-center gap-1">
                <input type="date" className="input text-sm flex-1" title="입금일" value={r.paidAt} onChange={e => set(i, 'paidAt', e.target.value)} />
                {r.paidAt && <span className="pill bg-emerald-100 text-emerald-700 shrink-0">입금</span>}
              </div>
              <button onClick={() => removeRow(i)} className="p-1 rounded text-ink-subtle hover:text-red-600 justify-self-end sm:justify-self-auto"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {dirty && <p className="text-[10px] text-ink-subtle">변경 사항이 있습니다 — 저장을 눌러 반영하세요.</p>}
        </div>
      )}
    </div>
  );
}

function SectionStudies({ deal, reload }: { deal: Deal; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [itemName, setItemName] = useState('');
  const add = async () => {
    const res = await fetch('/api/crm/studies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId: deal.id, itemName }) });
    if (res.ok) { setItemName(''); setAdding(false); reload(); } else toast.error('실패');
  };
  const patch = async (sid: number, data: Record<string, unknown>) => {
    const res = await fetch(`/api/crm/studies/${sid}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) reload(); else toast.error('수정 실패');
  };
  const del = async (sid: number) => { if (!confirm('이 시험을 삭제할까요?')) return; const res = await fetch(`/api/crm/studies/${sid}`, { method: 'DELETE' }); if (res.ok) reload(); };

  return (
    <Card title={`시험 추적 ${deal.studies.length}건`}
      action={<div className="flex items-center gap-1">
        <Link href={`/gantt?deal=${deal.id}`} className="btn-ghost text-xs"><GanttChartSquare className="w-3.5 h-3.5" /> 시험 일정 보기</Link>
        <button onClick={() => setAdding(v => !v)} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 시험 추가</button>
      </div>}>
      {adding && (
        <div className="flex gap-2 mb-3">
          <input className="input flex-1 text-sm" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="시험 항목명 (예: 설치류 13주 반복투여 독성)" autoFocus />
          <button onClick={add} className="btn-primary text-sm">추가</button>
        </div>
      )}
      {deal.studies.length === 0 ? <div className="text-xs text-ink-subtle py-1">등록된 시험이 없습니다. (시험관리팀 접수 후 시험번호별 추가)</div> : (
        <div className="space-y-3">
          {deal.studies.map(s => (
            <div key={s.id} className="rounded-[12px] border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <input className="input flex-1 text-sm font-medium" defaultValue={s.itemName ?? ''} onBlur={e => e.target.value !== (s.itemName ?? '') && patch(s.id, { itemName: e.target.value })} placeholder="시험 항목명" />
                <button onClick={() => del(s.id)} className="p-1.5 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid sm:grid-cols-3 gap-2.5 mb-2">
                <Labeled label="시험번호"><input className="input w-full text-sm" defaultValue={s.studyNumber ?? ''} onBlur={e => e.target.value !== (s.studyNumber ?? '') && patch(s.id, { studyNumber: e.target.value })} /></Labeled>
                <Labeled label="담당부서"><input className="input w-full text-sm" defaultValue={s.department ?? ''} onBlur={e => e.target.value !== (s.department ?? '') && patch(s.id, { department: e.target.value })} placeholder="예: 독성시험부" /></Labeled>
                <Labeled label="시험책임자"><input className="input w-full text-sm" defaultValue={s.director ?? ''} onBlur={e => e.target.value !== (s.director ?? '') && patch(s.id, { director: e.target.value })} /></Labeled>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <DateField label="시험 시작 예정" value={s.requestSentAt} onChange={v => patch(s.id, { requestSentAt: v })} hint="전환 시 자동 배치" />
                <DateField label="시험 종료 예정" value={s.studyEndAt} onChange={v => patch(s.id, { studyEndAt: v })} />
                <DateField label="보고서(안) 발행 예정" value={s.reportDraftDueAt} onChange={v => patch(s.id, { reportDraftDueAt: v })} hint="+30일=잔금 기한" />
                <DateField label="세금계산서 발행" value={s.invoiceIssuedAt} onChange={v => patch(s.id, { invoiceIssuedAt: v })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SectionChangeQuotes({ deal, reload }: { deal: Deal; reload: () => void }) {
  const [f, setF] = useState({ kind: 'ADD', amount: '', reason: '' });
  const [open, setOpen] = useState(false);
  const add = async () => {
    if (!f.amount || !f.reason.trim()) { toast.error('금액·사유를 입력하세요.'); return; }
    const res = await fetch('/api/crm/change-quotes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId: deal.id, kind: f.kind, amount: Number(f.amount), reason: f.reason }) });
    if (res.ok) { setF({ kind: 'ADD', amount: '', reason: '' }); setOpen(false); reload(); } else toast.error('실패');
  };
  const del = async (cid: number) => { const res = await fetch(`/api/crm/change-quotes/${cid}`, { method: 'DELETE' }); if (res.ok) reload(); };

  return (
    <Card title={`변경 견적 ${deal.changeQuotes.length}건`}
      action={<button onClick={() => setOpen(v => !v)} className="btn-ghost text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> 감가/추가금</button>}>
      {open && (
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <select className="input text-sm w-24" value={f.kind} onChange={e => setF(p => ({ ...p, kind: e.target.value }))}><option value="ADD">추가금</option><option value="DEDUCT">감가</option></select>
          <input className="input text-sm w-32" type="number" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} placeholder="금액" />
          <input className="input text-sm flex-1 min-w-[140px]" value={f.reason} onChange={e => setF(p => ({ ...p, reason: e.target.value }))} placeholder="사유" />
          <button onClick={add} className="btn-primary text-sm">추가</button>
        </div>
      )}
      {deal.changeQuotes.length === 0 ? <div className="text-xs text-ink-subtle py-1">변경 내역 없음.</div> : (
        <ul className="space-y-1.5">
          {deal.changeQuotes.map(c => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              {c.kind === 'DEDUCT' ? <TrendingDown className="w-4 h-4" style={{ color: 'var(--error)' }} /> : <TrendingUp className="w-4 h-4" style={{ color: 'var(--success)' }} />}
              <span className="font-semibold tabular-nums" style={{ color: c.kind === 'DEDUCT' ? 'var(--error)' : 'var(--success)' }}>{c.kind === 'DEDUCT' ? '-' : '+'}₩{c.amount.toLocaleString()}</span>
              <span className="flex-1 text-ink-muted truncate">{c.reason}</span>
              <button onClick={() => del(c.id)} className="p-1 rounded text-ink-subtle hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="label mb-0.5">{label}</div>{children}</div>;
}
function DateField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (v: string) => void; hint?: string }) {
  // blur 시점에만 저장 — 타이핑 중간값(빈 문자열)이 날짜를 지워버리는 것을 방지. key 로 reload 후 표시 동기화.
  return (
    <div>
      <div className="label mb-0.5">{label}{hint && <span className="text-[10px] font-normal text-ink-subtle ml-1">— {hint}</span>}</div>
      <input key={value ?? ''} type="date" className="input w-full text-sm" defaultValue={fmtDate(value)}
        onBlur={e => e.target.value !== fmtDate(value) && onChange(e.target.value)} />
    </div>
  );
}
