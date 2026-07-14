'use client';

/**
 * 효력 견적서 · 시험 설계 페이지 본문 (인쇄용 정적 렌더).
 * STEP 3에서 설계한 노드 타임라인 · 군 구성 · 엔드포인트 매트릭스를 그대로 문서에 남긴다.
 * 인터랙션 없음. 색은 화면과 동일(PHASE/CHEV)하되 인쇄 안정성을 위해 solid hex만 사용.
 */
import { CHEV, DOSE_FREQ, PHASE } from './constants';
import { durLabel, groupTotal, timeCols, totalAnimalsOf, totalDaysOf, type EffState } from '@/app/quote-efficacy/_lib/state';
import type { StudyModel } from './models';

const LABEL: React.CSSProperties = {
  fontFamily: "'Roboto Mono',monospace", fontSize: 8.5, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.1em', color: '#a39e98', marginBottom: 6,
};

/** 타임라인 — 중앙선 + 번호 원 + 위/아래 교차 라벨 (STEP3와 동일 구조, 인쇄 크기로 축소) */
export function DesignTimeline({ s }: { s: EffState }) {
  const totalDays = totalDaysOf(s.schedule);
  const totalWeeks = Math.ceil(totalDays / 7);

  return (
    <div style={{ pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={LABEL}>시험 진행 타임라인</div>
        <div style={{ fontSize: 9.5, color: '#a39e98', fontVariantNumeric: 'tabular-nums' }}>
          총 {totalWeeks}주 · {totalDays}일
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 168, padding: '0 6px' }}>
        {/* 중앙 수평선 + 양끝 점 */}
        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, transform: 'translateY(-50%)', background: '#e0ddd9' }} />
        <span style={{ position: 'absolute', left: 0, top: '50%', width: 7, height: 7, borderRadius: '50%', transform: 'translateY(-50%)', background: '#e0ddd9' }} />
        <span style={{ position: 'absolute', right: 0, top: '50%', width: 7, height: 7, borderRadius: '50%', transform: 'translateY(-50%)', background: '#e0ddd9' }} />

        {s.schedule.map((p, i) => {
          const col = CHEV[i % CHEV.length];
          const up = i % 2 === 0;
          const detail = p.type === 'induction' ? (s.params.induction || '질환 유발')
            : p.type === 'administration' ? '시험물질 반복투여'
            : p.type === 'acclimation' ? '환경 적응'
            : p.type === 'observation' ? '효력 평가·관찰'
            : p.type === 'sacrifice' ? '부검·시료채취' : '시료 분석';
          return (
            <div key={p.id} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* 라벨 (위/아래 교차) */}
              <div style={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 104, textAlign: 'center',
                ...(up ? { bottom: 'calc(50% + 34px)' } : { top: 'calc(50% + 34px)' }),
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#191919' }}>{p.label}</div>
                <div style={{
                  display: 'inline-block', margin: '2px 0', padding: '1px 7px', borderRadius: 9999,
                  fontFamily: "'Roboto Mono',monospace", fontSize: 8, fontWeight: 600, color: col, background: `${col}1f`,
                }}>{durLabel(p)}</div>
                <div style={{ fontSize: 8, color: '#a39e98', lineHeight: 1.3 }}>{detail}</div>
              </div>
              {/* 점선 스템 */}
              <span style={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 0, height: 16,
                borderLeft: `1.5px dotted ${col}`,
                ...(up ? { bottom: 'calc(50% + 18px)' } : { top: 'calc(50% + 18px)' }),
              }} />
              {/* 번호 원 */}
              <span style={{
                position: 'relative', zIndex: 2, width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Roboto Mono',monospace", fontSize: 11, fontWeight: 700,
                background: '#fff', color: col, border: `2px solid ${col}`,
              }}>{String(i + 1).padStart(2, '0')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 군 구성 — 군별 라벨·유발여부·하위분할·마리수 */
export function DesignGroups({ s }: { s: EffState }) {
  const totalAnimals = totalAnimalsOf(s.groups);
  return (
    <div style={{ pageBreakInside: 'avoid', marginTop: 14 }}>
      <div style={LABEL}>군 구성</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#f1f1ef' }}>
            <th style={{ ...th, width: 40 }}>군</th>
            <th style={th}>군 명</th>
            <th style={{ ...th, width: 60, textAlign: 'center' }}>질환유발</th>
            <th style={{ ...th, width: 110 }}>하위 분할</th>
            <th style={{ ...th, width: 56, textAlign: 'right' }}>마리수</th>
          </tr>
        </thead>
        <tbody>
          {s.groups.map((g) => (
            <tr key={g.id} style={{ borderTop: '1px solid #efefee' }}>
              <td style={{ ...td, fontFamily: "'Roboto Mono',monospace", fontWeight: 700, color: '#191919' }}>{g.tag}</td>
              <td style={{ ...td, color: '#191919' }}>{g.label}</td>
              <td style={{ ...td, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-block', padding: '1px 7px', borderRadius: 9999, fontSize: 8.5, fontWeight: 600,
                  ...(g.induct ? { background: '#d1685a', color: '#fff' } : { background: '#f1f1ef', color: '#a39e98' }),
                }}>{g.induct ? '유발' : '무처치'}</span>
              </td>
              <td style={{ ...td, color: '#615d59', fontVariantNumeric: 'tabular-nums' }}>
                {g.subs.length > 1 ? `${g.subs.map((x) => `${x.label} ${x.n}`).join(' · ')}` : '—'}
              </td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#191919', fontVariantNumeric: 'tabular-nums' }}>{groupTotal(g)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #191919' }}>
            <td style={{ ...td, fontWeight: 700, color: '#191919' }} colSpan={4}>{s.groups.length}개 군 · 합계</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#191919', fontVariantNumeric: 'tabular-nums' }}>{totalAnimals}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 엔드포인트 · 평가 스케줄 매트릭스 — 행=평가항목, 열=시점, ●=측정 */
export function DesignEndpoints({ s, m }: { s: EffState; m: StudyModel }) {
  const cols = timeCols(s.schedule);
  const freqLabel = (DOSE_FREQ.find((f) => f.key === s.params.freq) ?? DOSE_FREQ[0]).label;

  return (
    <div style={{ pageBreakInside: 'avoid', marginTop: 14 }}>
      <div style={LABEL}>엔드포인트 · 평가 스케줄</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#f1f1ef' }}>
            <th style={th}>평가 항목</th>
            {cols.map((c) => (
              <th key={c} style={{ ...th, width: 46, textAlign: 'center', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.endpoints.map((e) => (
            <tr key={e.id} style={{ borderTop: '1px solid #efefee' }}>
              <td style={{ ...td, color: '#191919' }}>{e.name}</td>
              {cols.map((c) => (
                <td key={c} style={{ ...td, textAlign: 'center' }}>
                  {e.times[c]
                    ? <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f5811f' }} />
                    : <span style={{ color: '#e6e6e6' }}>·</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8, fontSize: 9.5, color: '#615d59' }}>
        <span>양성대조물질 · <b style={{ color: '#191919' }}>{m.positiveControl || 'N/A'}</b></span>
        <span>유발방법 · <b style={{ color: '#191919' }}>{s.params.induction || 'N/A'}</b></span>
        <span>투여 · <b style={{ color: '#191919' }}>{s.params.route} · {freqLabel}</b></span>
        <span style={{ color: '#a39e98' }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f5811f', marginRight: 4 }} />
          측정 시점
        </span>
      </div>
    </div>
  );
}

/** 단계 유형 범례 — 타임라인 색 해설 */
export function DesignLegend({ s }: { s: EffState }) {
  const used = s.schedule.map((p) => p.type).filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 2, fontSize: 9, color: '#615d59' }}>
      {used.map((t) => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: PHASE[t].color }} />
          {PHASE[t].label}
        </span>
      ))}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '5px 8px', fontSize: 8.5, fontWeight: 600,
  color: '#615d59', textTransform: 'uppercase', letterSpacing: '.06em',
};
const td: React.CSSProperties = { padding: '5px 8px', color: '#31302e', verticalAlign: 'middle' };
