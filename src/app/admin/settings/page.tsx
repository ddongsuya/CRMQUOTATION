import { getViewMode } from '@/lib/admin/view';
import { listTargets } from '@/lib/admin/aggregate';
import TargetForm from '@/components/admin/TargetForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  await getViewMode(); // 게이트는 layout에서. 여기선 데이터만.
  const targets = await listTargets('2026H1');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[26px] sm:text-[30px] font-bold text-ink tracking-tight">설정</h1>
        <p className="text-[13px] text-ink-subtle mt-1">목표 · 조직 관리</p>
      </div>

      <TargetForm period={targets.period} rows={targets.rows} />

      <p className="text-[12px] text-ink-subtle mt-4 max-w-lg">
        목표는 관리자 대시보드의 <b>목표 달성 게이지</b>·실적 분석의 <b>달성률</b>에 즉시 반영됩니다.
        센터별 목표의 합이 전사 목표와 반드시 일치할 필요는 없습니다.
      </p>
    </>
  );
}
