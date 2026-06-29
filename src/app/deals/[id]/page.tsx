'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { ArrowLeft, Loader2, Plus, Trash2, FileText, FileSignature, FlaskConical, TrendingDown, TrendingUp, Check, Building2, Briefcase, Save } from 'lucide-react';
import { toast } from '@/lib/toast';

type Quote = { id: number; quoteNumber: string; grandTotal: number | null; currency: string; status: string; sentAt: string | null; accepted: boolean | null; createdAt: string };
type PaymentTerm = { id: number; seq: number; kind: string; ratio: number | null; amount: number | null; condition: string | null; dueAt: string | null; paidAt: string | null };
type Contract = { id: number; status: string; contractNumber: string | null; costEstimateSentAt: string | null; draftSentAt: string | null; approvedAt: string | null; signedAt: string | null; paymentTerms: PaymentTerm[] };
type Study = { id: number; itemName: string | null; studyNumber: string | null; director: string | null; requestSentAt: string | null; intakeCompletedAt: string | null; reportDraftDueAt: string | null; reportDraftIssuedAt: string | null; invoiceRequestedAt: string | null; invoiceIssuedAt: string | null };
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
      <Link href={`/customers/${deal.contact.company.id}`} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"><ArrowLeft className="w-3.5 h-3.5" /> {deal.contact.company.name}</Link>

      {/* 헤더 */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink flex items-center gap-2"><Briefcase className="w-5 h-5 text-brand-500" />{deal.title}</h1>
            <div className="text-xs text-ink-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{deal.contact.company.name} · {deal.contact.name}{deal.contact.position ? ` (${deal.contact.position})` : ''}</span>
              {deal.modality && <span>{deal.modality}</span>}
              {deal.indication && <span>적응증: {deal.indication}</span>}
              {deal.submissionTarget && <span>{deal.submissionTarget}</span>}
              <span className={clsx('pill', deal.reportLanguage === 'EN' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-ink-muted')}>{deal.reportLanguage === 'EN' ? '영문보고서' : '국문보고서'}</span>
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
              <span className={clsx('pill', deal.status === 'WON' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{deal.status === 'WON' ? '수주' : `중단${deal.lostReason ? ` · ${deal.lostReason}` : ''}`}</span>
            )}
          </div>
        </div>

        {/* 단계 스테퍼 (클릭 시 단계 설정) */}
        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => (
            <button key={s.k} onClick={() => patchDeal({ stage: s.k })}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                i < curIdx ? 'bg-brand-50 text-brand-600' : i === curIdx ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-subtle hover:bg-slate-100')}>
              {i < curIdx ? <Check className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}{s.label}
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
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: 'MEETING', body: '' });
  const add = async () => {
    if (!f.body.trim()) { toast.error('내용을 입력하세요.'); return; }
    const res = await fetch('/api/crm/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, dealId: deal.id, contactId: deal.contact.id }) });
    if (res.ok) { setF({ type: 'MEETING', body: '' }); setOpen(false); reload(); } else toast.error('실패');
  };
  const del = async (id: number) => { const res = await fetch(`/api/crm/notes/${id}`, { method: 'DELETE' }); if (res.ok) reload(); };
  const TLABEL: Record<string, string> = { MEETING: '미팅', CALL: '통화', MEMO: '메모' };
  return (
    <Card icon={<FileText className="w-4 h-4 text-brand-500" />} title={`기록 ${deal.notes.length}건`}
      action={<button onClick={() => setOpen(v => !v)} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 기록 추가</button>}>
      {open && (
        <div className="space-y-2 mb-3">
          <div className="flex gap-1.5">{['MEETING', 'CALL', 'MEMO'].map(t => <button key={t} onClick={() => setF(p => ({ ...p, type: t }))} className={clsx('chip', f.type === t ? 'chip-active' : 'chip-inactive')}>{TLABEL[t]}</button>)}</div>
          <textarea className="input w-full min-h-[70px]" value={f.body} onChange={e => setF(p => ({ ...p, body: e.target.value }))} placeholder="미팅·상담 내용…" autoFocus />
          <div className="flex justify-end"><button onClick={add} className="btn-primary text-sm"><Save className="w-4 h-4" /> 저장</button></div>
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

function Card({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function SectionQuotes({ deal }: { deal: Deal }) {
  return (
    <Card icon={<FileText className="w-4 h-4 text-brand-500" />} title={`견적서 ${deal.quotes.length}건`}
      action={<Link href={`/quote-v2?dealId=${deal.id}`} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 이 안건으로 견적 작성</Link>}>
      {deal.quotes.length === 0 ? <div className="text-xs text-ink-subtle py-1">아직 견적이 없습니다.</div> : (
        <ul className="divide-y divide-slate-50">
          {deal.quotes.map(q => (
            <li key={q.id}>
              <Link href={`/quote/print?id=${q.id}`} className="flex items-center gap-3 py-2 hover:bg-slate-50/60 -mx-1 px-1 rounded">
                <span className="text-xs text-ink-subtle font-mono w-32 truncate">{q.quoteNumber}</span>
                <span className="flex-1 text-sm font-semibold text-ink tabular-nums">{fmtMoney(q.grandTotal, q.currency)}</span>
                {q.accepted && <span className="pill bg-emerald-100 text-emerald-700">수락</span>}
                <span className="pill bg-slate-100 text-ink-muted">{q.status}</span>
              </Link>
            </li>
          ))}
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
    <Card icon={<FileSignature className="w-4 h-4 text-brand-500" />} title="계약">
      <button onClick={start} disabled={busy} className="btn-ghost text-xs">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} 계약 시작 (견적 기반)</button>
    </Card>
  );

  return (
    <Card icon={<FileSignature className="w-4 h-4 text-brand-500" />} title="계약">
      <div className="grid sm:grid-cols-2 gap-3">
        <Labeled label="상태">
          <select className="input w-full text-sm" value={c.status} onChange={e => patch({ status: e.target.value })}>
            {['DRAFT', 'SENT', 'REVIEWED', 'APPROVED', 'SIGNED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Labeled>
        <Labeled label="계약번호"><input className="input w-full text-sm" defaultValue={c.contractNumber ?? ''} onBlur={e => e.target.value !== (c.contractNumber ?? '') && patch({ contractNumber: e.target.value })} placeholder="사업지원팀 부여" /></Labeled>
        <DateField label="예정원가·안분 송부" value={c.costEstimateSentAt} onChange={v => patch({ costEstimateSentAt: v })} />
        <DateField label="초안 송부" value={c.draftSentAt} onChange={v => patch({ draftSentAt: v })} />
        <DateField label="승인" value={c.approvedAt} onChange={v => patch({ approvedAt: v })} />
        <DateField label="최종 날인" value={c.signedAt} onChange={v => patch({ signedAt: v })} />
      </div>
      <div className="mt-3">
        <div className="label mb-1">지급 회차</div>
        <ul className="space-y-1">
          {c.paymentTerms.map(t => (
            <li key={t.id} className="flex items-center gap-2 text-xs text-ink-muted">
              <span className="pill bg-brand-50 text-brand-700">{KIND_LABEL[t.kind] ?? t.kind}</span>
              <span className="font-semibold text-ink">{t.ratio != null ? `${Math.round(t.ratio * 100)}%` : t.amount != null ? `₩${t.amount.toLocaleString()}` : '-'}</span>
              <span>· {t.condition ?? ''}</span>
              {t.paidAt && <span className="pill bg-emerald-100 text-emerald-700">입금완료</span>}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ink-subtle mt-1.5">중도금·시험번호별 회차 편집은 Phase 2 후속에서. 기본은 선금 50% + 잔금 50%(보고서안 발행+30일).</p>
      </div>
    </Card>
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
    <Card icon={<FlaskConical className="w-4 h-4 text-brand-500" />} title={`시험 추적 ${deal.studies.length}건`}
      action={<button onClick={() => setAdding(v => !v)} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 시험 추가</button>}>
      {adding && (
        <div className="flex gap-2 mb-3">
          <input className="input flex-1 text-sm" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="시험 항목명 (예: 설치류 13주 반복투여 독성)" autoFocus />
          <button onClick={add} className="btn-primary text-sm"><Save className="w-4 h-4" /> 추가</button>
        </div>
      )}
      {deal.studies.length === 0 ? <div className="text-xs text-ink-subtle py-1">등록된 시험이 없습니다. (시험관리팀 접수 후 시험번호별 추가)</div> : (
        <div className="space-y-3">
          {deal.studies.map(s => (
            <div key={s.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-2 mb-2">
                <input className="input flex-1 text-sm font-medium" defaultValue={s.itemName ?? ''} onBlur={e => e.target.value !== (s.itemName ?? '') && patch(s.id, { itemName: e.target.value })} placeholder="시험 항목명" />
                <button onClick={() => del(s.id)} className="p-1.5 rounded text-ink-subtle hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Labeled label="시험번호"><input className="input w-full text-sm" defaultValue={s.studyNumber ?? ''} onBlur={e => e.target.value !== (s.studyNumber ?? '') && patch(s.id, { studyNumber: e.target.value })} /></Labeled>
                <Labeled label="시험책임자"><input className="input w-full text-sm" defaultValue={s.director ?? ''} onBlur={e => e.target.value !== (s.director ?? '') && patch(s.id, { director: e.target.value })} /></Labeled>
                <DateField label="시험 접수완료" value={s.intakeCompletedAt} onChange={v => patch(s.id, { intakeCompletedAt: v })} />
                <DateField label="최종보고서(안) 발행" value={s.reportDraftIssuedAt} onChange={v => patch(s.id, { reportDraftIssuedAt: v })} hint="발행+30일=잔금 기한" />
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
    <Card icon={<TrendingUp className="w-4 h-4 text-brand-500" />} title={`변경 견적 ${deal.changeQuotes.length}건`}
      action={<button onClick={() => setOpen(v => !v)} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> 감가/추가금</button>}>
      {open && (
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <select className="input text-sm w-24" value={f.kind} onChange={e => setF(p => ({ ...p, kind: e.target.value }))}><option value="ADD">추가금</option><option value="DEDUCT">감가</option></select>
          <input className="input text-sm w-32" type="number" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} placeholder="금액" />
          <input className="input text-sm flex-1 min-w-[140px]" value={f.reason} onChange={e => setF(p => ({ ...p, reason: e.target.value }))} placeholder="사유" />
          <button onClick={add} className="btn-primary text-sm"><Save className="w-4 h-4" /> 추가</button>
        </div>
      )}
      {deal.changeQuotes.length === 0 ? <div className="text-xs text-ink-subtle py-1">변경 내역 없음.</div> : (
        <ul className="space-y-1.5">
          {deal.changeQuotes.map(c => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              {c.kind === 'DEDUCT' ? <TrendingDown className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-emerald-600" />}
              <span className={clsx('font-semibold tabular-nums', c.kind === 'DEDUCT' ? 'text-red-600' : 'text-emerald-700')}>{c.kind === 'DEDUCT' ? '-' : '+'}₩{c.amount.toLocaleString()}</span>
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
  return (
    <div>
      <div className="label mb-0.5">{label}{hint && <span className="text-[10px] font-normal text-ink-subtle ml-1">— {hint}</span>}</div>
      <input type="date" className="input w-full text-sm" defaultValue={fmtDate(value)} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
