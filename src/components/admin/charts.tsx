/**
 * 관리자 대시보드 차트 프리미티브 — 전부 순수 SVG/CSS (라이브러리 없음).
 * 색·굵기·radius 는 tokens(var(--*))만. 오렌지(--accent)는 강조에만, 기본은 ink/hairline.
 * 서버 컴포넌트로 렌더 가능(훅 없음).
 */

const AX = 'var(--hairline)';

/** 히어로 스파크라인 — 오렌지 라인 + 소프트 영역. */
export function Sparkline({ values, w = 150, h = 56 }: { values: number[]; w?: number; h?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - ((v - min) / span) * (h - 6) - 3] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="var(--accent)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** KPI 미니 막대 — 마지막 n개 오렌지 강조, 나머지 muted. */
export function BarSpark({ values, accentLast = 2, tone = 'accent', h = 34 }: { values: number[]; accentLast?: number; tone?: 'accent' | 'cream' | 'ink'; h?: number }) {
  const max = Math.max(...values, 1);
  const n = values.length;
  const hi = tone === 'cream' ? 'var(--card-cream)' : tone === 'ink' ? 'var(--ink)' : 'var(--accent)';
  const lo = 'var(--hairline)';
  return (
    <div className="flex items-end gap-1" style={{ height: h }}>
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-[2px]" style={{ height: `${Math.max((v / max) * 100, 6)}%`, background: i >= n - accentLast ? hi : lo }} />
      ))}
    </div>
  );
}

/** 수주율 — 블랙 진행 바. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full" style={{ background: 'var(--hairline)' }}>
      <div className="h-2 rounded-full" style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%`, background: 'var(--ink)' }} />
    </div>
  );
}

/** 센터별 월간 그룹 막대. series 색: ink(1센터) / accent(2센터). */
export function GroupedBars({ labels, series, h = 150 }: { labels: string[]; series: { name: string; color: string; values: number[] }[]; h?: number }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: h }}>
        {labels.map((lb, i) => (
          <div key={i} className="flex-1 h-full flex items-end justify-center gap-[3px]">
            {series.map((s) => (
              <div key={s.name} className="w-[7px] rounded-t-[2px]" style={{ height: `${Math.max((s.values[i] / max) * 100, 1.5)}%`, background: s.color }} title={`${s.name} ${lb}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        {labels.map((lb, i) => <div key={i} className="flex-1 text-center text-[10px] text-ink-subtle tabular-nums">{lb}</div>)}
      </div>
    </div>
  );
}

/** 도넛 게이지 — 링 진행 + 중앙 %. color: 'ink' | 'accent'. */
export function DonutGauge({ value, color = 'accent', label, size = 116 }: { value: number; color?: 'ink' | 'accent'; label?: string; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 1);
  const stroke = color === 'ink' ? 'var(--ink)' : 'var(--accent)';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={AX} strokeWidth="9" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${(c * pct).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[20px] font-bold text-ink tabular-nums">{Math.round(pct * 100)}%</span>
      </div>
      {label && <span className="text-[12px] text-ink-muted">{label}</span>}
    </div>
  );
}

/** 도넛(구성비) — 다중 세그먼트 + 중앙 총계. */
export function Donut({ segments, size = 130, centerLabel, centerValue }: { segments: { label: string; value: number; color: string }[]; size?: number; centerLabel?: string; centerValue?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={AX} strokeWidth="12" />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = `${(c * frac).toFixed(1)} ${c.toFixed(1)}`;
          const off = -c * (acc / total);
          acc += s.value;
          return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth="12"
            strokeDasharray={dash} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        })}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
          {centerValue && <span className="text-[16px] font-bold text-ink tabular-nums">{centerValue}</span>}
          {centerLabel && <span className="text-[10px] text-ink-subtle">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

/** 가로 막대 목록 (산업별 등). */
export function HBars({ items, fmt }: { items: { label: string; value: number; color?: string }[]; fmt: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-24 text-[13px] text-ink-body truncate flex-shrink-0">{it.label}</span>
          <div className="flex-1 h-2.5 rounded-full" style={{ background: 'var(--hairline)' }}>
            <div className="h-2.5 rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? (i === 0 ? 'var(--accent)' : 'var(--ink)') }} />
          </div>
          <span className="w-16 text-right text-[13px] font-semibold text-ink tabular-nums flex-shrink-0">{fmt(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** 활동 히트맵 — 요일(행) × 주(열), 강도=색 진하기. */
export function Heatmap({ cells, max }: { cells: number[][]; max: number }) {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col gap-[3px] justify-between py-[1px]">
        {days.map((d, i) => <span key={i} className="text-[9px] text-ink-subtle leading-[11px] h-[11px]">{i % 2 === 0 ? d : ''}</span>)}
      </div>
      <div className="flex flex-col gap-[3px] flex-1">
        {cells.map((row, r) => (
          <div key={r} className="flex gap-[3px]">
            {row.map((v, c) => {
              const t = max > 0 ? v / max : 0;
              const bg = v === 0 ? 'var(--hairline-soft)' : `color-mix(in srgb, var(--accent) ${Math.round(20 + t * 80)}%, var(--card))`;
              return <div key={c} className="flex-1 rounded-[2px]" style={{ aspectRatio: '1', background: bg }} title={`${v}건`} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 파이프라인 퍼널 — 단계별 가로 밴드(폭=건수 비례). */
export function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-16 text-[12px] text-ink-muted flex-shrink-0">{s.label}</span>
          <div className="flex-1">
            <div className="h-7 rounded-md flex items-center px-2.5 text-[12px] font-semibold text-slate-50 tabular-nums"
              style={{ width: `${Math.max((s.value / max) * 100, 8)}%`, background: i === 0 ? 'var(--ink)' : `color-mix(in srgb, var(--ink) ${Math.max(85 - i * 11, 25)}%, var(--accent))` }}>
              {s.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
