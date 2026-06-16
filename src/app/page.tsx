import Link from 'next/link';
import { ArrowRight, FlaskConical, BookOpen, Layers, Boxes } from 'lucide-react';
import { loadData } from '@/lib/data';

export default function Home() {
  const { testItems, presets, blocks } = loadData();
  const byModality: Record<string, number> = {};
  for (const it of testItems) {
    for (const m of it.modalityPool) byModality[m] = (byModality[m] || 0) + 1;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="card overflow-hidden relative">
        <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white p-8 sm:p-10 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative max-w-2xl">
            <div className="text-[11px] uppercase tracking-widest font-semibold opacity-75">코아스템켐온</div>
            <h1 className="text-3xl sm:text-4xl font-bold mt-2 leading-tight tracking-tight">
              비임상시험 견적,<br />
              <span className="opacity-90">5분이면 충분합니다.</span>
            </h1>
            <p className="text-sm sm:text-base opacity-85 mt-4 leading-relaxed">
              모달리티 → 임상 계획 → 자동 구성 → 가격·할인 → PDF 출력.<br />
              데이터 기반 자동 추천으로 견적 작성 시간을 90% 단축하세요.
            </p>
            <Link
              href="/quote/new"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-white text-brand-700 font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              견적 작성 시작
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="text-sm font-semibold text-ink-muted mb-3 px-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-500" /> 데이터 현황
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<FlaskConical className="w-4 h-4" />} label="테스트 항목" value={testItems.length} />
          <Stat icon={<BookOpen className="w-4 h-4" />} label="가이드라인 블록" value={blocks.length} />
          <Stat icon={<Layers className="w-4 h-4" />} label="모달리티 프리셋" value={presets.length} />
          <Stat icon={<Boxes className="w-4 h-4" />} label="모달리티 수" value={Object.keys(byModality).length} />
        </div>
      </section>

      {/* Modality breakdown */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-ink-muted mb-4 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-brand-500" /> 모달리티별 항목 수
        </h2>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
          {Object.entries(byModality)
            .sort((a, b) => b[1] - a[1])
            .map(([m, n]) => (
              <li key={m} className="flex justify-between items-center border-b border-slate-100 py-1.5">
                <span className="text-ink">{m}</span>
                <span className="text-ink-subtle tabular-nums font-medium">{n}</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-center gap-2 text-ink-subtle mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold text-ink tabular-nums tracking-tight">{value.toLocaleString()}</div>
    </div>
  );
}
