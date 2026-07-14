import Link from 'next/link';

/**
 * 새 견적 진입 — 시험 유형 선택 (효력 / 독성).
 * 레퍼런스: design_handoff_efficacy_quotation/견적 작성 진입.dc.html
 * 우리 프로젝트 기준: 독성 모듈은 이미 구축(/quote-v2)되어 있으므로 '사용 가능'으로 노출하고,
 * 단계 칩은 우리 위저드의 실제 5단계를 표기한다(핸드오프 README §10 스크린샷도 둘 다 사용가능).
 */
export const dynamic = 'force-dynamic';

const FLASK = 'M8 3v3.5L4.5 15A3 3 0 0 0 7.3 19h9.4a3 3 0 0 0 2.8-4L16 6.5V3M7 3h10M6.5 13h11';
const CLIPBOARD = 'M12 2a3 3 0 0 0-3 3v1H7a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a2 2 0 0 0-2-2h-2V5a3 3 0 0 0-3-3zM9 12h6M9 16h6';

type Card = {
  href: string; eyebrow: string; title: string; desc: string;
  steps: string[]; foot: string; icon: string;
  iconBg: string; iconFg: string;
};

const CARDS: Card[] = [
  {
    href: '/quote-efficacy', eyebrow: 'EFFICACY', title: '효력시험 견적',
    desc: '질환모델 프리셋을 불러와 시험 디자인을 시각화하고 원가·견적을 자동 산출합니다. 110개 모델 · 실단가 반영.',
    steps: ['① 모델 선택', '② 고객 정보', '③ 시험 설계', '④ 견적서'],
    foot: '노드 타임라인 · 군구성 · 엔드포인트',
    icon: FLASK, iconBg: '#eaf0ff', iconFg: '#3f6fbf',
  },
  {
    href: '/quote-v2', eyebrow: 'TOXICOLOGY', title: '독성시험 견적',
    desc: '모달리티·임상 계획을 입력하면 규칙 엔진이 시험 항목과 부형제·함량분석을 자동 구성합니다.',
    steps: ['① 프로젝트', '② 모달리티', '③ 임상 계획', '④ 항목·부형제', '⑤ 통화·할인'],
    foot: '규칙 엔진 · 선행항목 자동 · 가이드라인 연동',
    icon: CLIPBOARD, iconBg: 'var(--accent-tint)', iconFg: 'var(--accent-press)',
  },
];

export default function QuoteStartPage() {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-12">
        <div className="eyebrow mb-3">NEW QUOTATION</div>
        <h1 className="text-[36px] font-extrabold leading-[1.1] tracking-tight text-ink m-0">어떤 시험의 견적을 작성할까요?</h1>
        <p className="mt-3 text-[16px] text-ink-muted">시험 유형을 선택하면 해당 모듈에 맞는 단계로 진행됩니다.</p>
      </div>

      <div className="mx-auto max-w-[1000px] grid grid-cols-1 md:grid-cols-2 gap-5">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}
            className="type-card group flex flex-col bg-[var(--card)] border border-slate-200 rounded-[18px] p-7">
            <div className="flex items-center justify-between mb-[18px]">
              <span className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-[14px]"
                style={{ background: c.iconBg, color: c.iconFg }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
              </span>
              <span className="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[11.5px] font-semibold"
                style={{ background: '#e7f6ec', color: '#1a8f38' }}>
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--success)' }} />사용 가능
              </span>
            </div>

            <div className="eyebrow mb-1">{c.eyebrow}</div>
            <h2 className="m-0 text-[23px] font-bold text-ink tracking-tight">{c.title}</h2>
            <p className="mt-2 mb-0 text-[13.5px] leading-[1.55] text-ink-muted">{c.desc}</p>

            <div className="flex flex-wrap gap-1.5 mt-[18px] mb-[22px]">
              {c.steps.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full bg-slate-100 text-ink-muted text-[11px] font-medium">{s}</span>
              ))}
            </div>

            <div className="mt-auto flex items-center justify-between">
              <span className="text-[12px] text-ink-subtle">{c.foot}</span>
              <span className="go inline-flex items-center gap-[7px] h-10 px-[18px] rounded-full bg-[var(--dark-surface)] text-white text-[14px] font-semibold transition-colors">
                시작하기
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-[22px] flex items-center gap-2.5 justify-center text-[12px] text-ink-subtle">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        고객사 선택 · 견적번호 발번 · 견적서(표지/명세/상세) · 저장/PDF는 두 모듈이 공통으로 사용합니다.
      </div>
    </div>
  );
}
