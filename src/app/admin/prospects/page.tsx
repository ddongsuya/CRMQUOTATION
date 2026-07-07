import { getViewMode } from '@/lib/admin/view';
import { getProspects } from '@/lib/admin/aggregate';
import QuoteUploadButton from '@/components/admin/QuoteUploadButton';
import ProspectList, { type Prospect } from '@/components/admin/ProspectList';

export const dynamic = 'force-dynamic';

export default async function AdminProspects() {
  await getViewMode();
  const prospects = (await getProspects()) as Prospect[];
  const active = prospects.filter((p) => !p.companyId).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-bold text-ink tracking-tight">잠재 고객</h1>
          <p className="text-[13px] text-ink-subtle mt-1">영업 타겟 · 발굴 대상 <b className="text-ink-body tabular-nums">{active}</b>곳 (미전환)</p>
        </div>
        <QuoteUploadButton endpoint="/api/admin/prospects/import" label="잠재고객 업로드" />
      </div>

      <p className="text-[13px] text-ink-subtle mb-4">파이프라인·개발단계·IND 시점·CRO 전망을 관리하고, 성사되면 <b className="text-ink-body">고객 전환</b>으로 고객사에 등록됩니다.</p>

      <ProspectList prospects={prospects} />
    </>
  );
}
