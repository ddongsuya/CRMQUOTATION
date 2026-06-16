import Link from 'next/link';
import { FlaskConical, BookOpen, Layers, Boxes, ArrowRight, Receipt, FileText } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadData } from '@/lib/data';

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '작성중', cls: 'bg-slate-200 text-ink-muted' },
  ISSUED: { label: '발행', cls: 'bg-brand-100 text-brand-700' },
  SENT: { label: '발송', cls: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { label: '수주', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: '반려', cls: 'bg-red-100 text-red-700' },
};

export default async function Home() {
  const { testItems, presets, blocks } = loadData();
  const byModality: Record<string, number> = {};
  for (const it of testItems) for (const m of it.modalityPool) byModality[m] = (byModality[m] || 0) + 1;
  const modalityRows = Object.entries(byModality).sort((a, b) => b[1] - a[1]);
  const maxCount = modalityRows.length ? modalityRows[0][1] : 1;

  const session = await getServerSession(authOptions);
  const name = session?.user?.name ?? '게스트';

  let quotes: Array<{ id: number; quoteNumber: string; customerCompany: string | null; modality: string; status: string; grandTotal: number | null }> = [];
  try {
    quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, quoteNumber: true, customerCompany: true, modality: true, status: true, grandTotal: true },
    });
  } catch { /* DB 미연결 시 빈 목록 */ }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">안녕하세요, {name}님 👋</h1>
        <p className="text-sm text-ink-muted mt-0.5">실제 시험 항목 마스터와 프리셋 기반으로 견적을 구성하세요.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<FlaskConical className="w-4 h-4" />} label="시험 항목 마스터" value={testItems.length} unit="개" />
        <StatCard icon={<Layers className="w-4 h-4" />} label="프리셋" value={presets.length} unit="종" />
        <StatCard icon={<BookOpen className="w-4 h-4" />} label="가이드라인 블록" value={blocks.length} unit="개" />
        <StatCard icon={<Boxes className="w-4 h-4" />} label="모달리티" value={modalityRows.length} unit="종" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 최근 견적 */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-brand-500" /> 최근 견적
            </h2>
            <Link href="/quotes" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5">
              전체 보기 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {quotes.length === 0 ? (
            <div className="py-10 text-center">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-brand-50 text-brand-400 mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-sm text-ink-muted">아직 저장된 견적이 없습니다.</div>
              <Link href="/quote/new" className="btn-primary text-xs mt-3">
                <FileText className="w-3.5 h-3.5" /> 첫 견적 작성하기
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {quotes.map(q => {
                const st = STATUS[q.status] ?? STATUS.DRAFT;
                return (
                  <li key={q.id}>
                    <Link href={`/quote/print?id=${q.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50/60 -mx-2 px-2 rounded-lg transition-colors">
                      <span className="text-xs text-ink-subtle font-mono w-28 flex-shrink-0">{q.quoteNumber}</span>
                      <span className="flex-1 min-w-0 text-sm text-ink truncate">
                        {q.customerCompany || '(고객사 미지정)'} · <span className="text-ink-muted">{q.modality}</span>
                      </span>
                      <span className={`pill ${st.cls} flex-shrink-0`}>{st.label}</span>
                      <span className="text-sm font-semibold text-ink tabular-nums w-32 text-right flex-shrink-0">
                        ₩{(q.grandTotal ?? 0).toLocaleString()}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 모달리티별 항목 수 (막대) */}
        <section className="card p-5">
          <h2 className="text-sm font-bold text-ink flex items-center gap-1.5 mb-3">
            <Boxes className="w-4 h-4 text-brand-500" /> 모달리티별 항목 수
          </h2>
          <ul className="space-y-2 max-h-[320px] overflow-auto pr-1">
            {modalityRows.map(([m, n]) => (
              <li key={m} className="flex items-center gap-3">
                <span className="text-xs text-ink w-28 flex-shrink-0 truncate" title={m}>{m}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${Math.max(6, (n / maxCount) * 100)}%` }} />
                </div>
                <span className="text-xs text-ink-subtle tabular-nums w-9 text-right flex-shrink-0">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: number; unit: string }) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-center gap-2 text-ink-subtle mb-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-ink tabular-nums tracking-tight">{value.toLocaleString()}</span>
        <span className="text-xs text-ink-subtle">{unit}</span>
      </div>
    </div>
  );
}
