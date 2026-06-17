'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { FileStack, Check, Info, Loader2, FilePlus2 } from 'lucide-react';
import { useWizard, type Selection } from '@/lib/store';
import { isComingSoon } from '@/lib/modality-config';
import { toast } from '@/lib/toast';

type Tpl = { id: string; name: string; modality: string; scenario?: string; tests: { key: string; quantity?: number }[] };
type Item = { key: string; testName: string; adminRoute: string | null; priceMfds: number | null; priceOecd: number | null };

export default function SectionTemplate() {
  const s = useWizard();
  const [tpls, setTpls] = useState<Tpl[] | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!s.modality) { setTpls([]); return; }
    setTpls(null);
    fetch(`/api/quote-templates?modality=${encodeURIComponent(s.modality)}`)
      .then(r => r.json()).then(d => setTpls(d.templates ?? [])).catch(() => setTpls([]));
  }, [s.modality]);

  if (!s.modality) {
    return <div className="text-center py-8 text-sm text-ink-subtle"><Info className="w-5 h-5 mx-auto mb-2 text-ink-subtle/60" />2단계에서 모달리티를 먼저 선택하세요.</div>;
  }
  if (isComingSoon(s.modality)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mb-3"><Info className="w-6 h-6" /></div>
        <div className="text-base font-semibold text-ink">{s.modality} — 준비 중입니다</div>
        <p className="text-sm text-ink-muted mt-1.5">규제 시험 데이터 정비 후 템플릿이 제공됩니다.</p>
      </div>
    );
  }

  const resolvePrice = (it: Item): number => {
    const v = s.priceStandard === 'MFDS' ? it.priceMfds : it.priceOecd;
    return v != null && Number.isFinite(v) ? Number(v) : 0;
  };

  const apply = async (tpl: Tpl) => {
    setApplyingId(tpl.id);
    try {
      const keys = tpl.tests.map(t => t.key);
      const res = await fetch('/api/items/by-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keys }) });
      const { items } = await res.json() as { items: Item[] };
      const byKey = new Map(items.map(it => [it.key, it]));
      const sels: Selection[] = tpl.tests.map(t => {
        const it = byKey.get(t.key);
        if (!it) return null;
        return { key: it.key, testName: it.testName, adminRoute: it.adminRoute, unitPrice: resolvePrice(it), quantity: t.quantity ?? 1, priority: '필수' as const, tag: `템플릿: ${tpl.name}`, source: 'preset' as const };
      }).filter(Boolean) as Selection[];
      s.replaceSelections(sels);
      toast.success(`"${tpl.name}" 템플릿 적용 — ${sels.length}개 시험`);
    } catch (e) { toast.error(`적용 실패: ${e instanceof Error ? e.message : '알 수 없음'}`); }
    finally { setApplyingId(null); }
  };

  if (tpls === null) return <div className="py-10 text-center text-ink-subtle text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> 템플릿 불러오는 중…</div>;

  return (
    <div className="space-y-4">
      <div className="text-xs text-ink-muted">
        <span className="font-semibold text-ink">{s.modality}</span> 의 견적 템플릿을 선택하면 시험이 자동으로 채워집니다. 이후 4단계에서 항목을 조정할 수 있습니다.
      </div>

      {tpls.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 text-brand-400 mb-3"><FileStack className="w-6 h-6" /></div>
          <div className="text-sm font-medium text-ink">이 모달리티의 템플릿이 아직 없습니다.</div>
          <p className="text-xs text-ink-subtle mt-1">관리자가 <span className="font-medium">항목·가격 → 모달리티·템플릿 구성</span>에서 만들 수 있습니다.</p>
          <button onClick={() => { s.replaceSelections([]); toast.success('빈 견적으로 시작 — 4단계에서 항목을 직접 추가하세요.'); }} className="btn-ghost text-xs mt-3">
            <FilePlus2 className="w-3.5 h-3.5" /> 빈 견적으로 시작
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {tpls.map(tpl => {
            const active = s.planApplied && s.selections.some(x => x.tag === `템플릿: ${tpl.name}`);
            return (
              <button key={tpl.id} onClick={() => apply(tpl)} disabled={applyingId === tpl.id}
                className={clsx('text-left rounded-2xl border-2 p-5 transition-all', active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-card-hover')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={clsx('text-base font-bold', active ? 'text-brand-700' : 'text-ink')}>{tpl.name}</div>
                    {tpl.scenario && <div className="text-xs text-ink-subtle mt-0.5 line-clamp-2">{tpl.scenario}</div>}
                  </div>
                  {applyingId === tpl.id ? <Loader2 className="w-5 h-5 animate-spin text-brand-500 flex-shrink-0" />
                    : active ? <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white flex-shrink-0"><Check className="w-5 h-5" /></span>
                    : <FileStack className="w-5 h-5 text-ink-subtle flex-shrink-0" />}
                </div>
                <div className="text-xs text-ink-muted mt-3 font-medium">{tpl.tests.length}개 시험</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
