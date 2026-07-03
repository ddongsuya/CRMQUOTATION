import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // tokens.css(var --*)에 매핑 — 컴포넌트는 이 유틸을 써도 전부 토큰을 참조, 라이트/다크 자동 스왑.
        brand: {
          DEFAULT: 'var(--accent)',
          50: 'var(--accent-tint)',
          100: 'var(--accent-tint)',   // 활성 나브·배지 틴트
          200: 'var(--accent)',
          300: 'var(--accent)',
          400: 'var(--accent)',
          500: 'var(--accent)',
          600: 'var(--accent)',         // 1차 CTA
          700: 'var(--accent-hover)',
          800: 'var(--accent-press)',
          900: 'var(--accent-press)',
          light: 'var(--accent)',
          accent: 'var(--accent-press)',
        },
        ink: {
          DEFAULT: 'var(--ink)',    // 헤드라인·숫자·행 제목
          body: 'var(--body)',
          muted: 'var(--muted)',
          subtle: 'var(--muted-soft)',
        },
        // slate 유틸 → 토큰. 100=크림, 200=헤어라인, 900=반전카드.
        slate: {
          50: 'var(--floor)',          // 페이지 바닥/hover
          100: 'var(--card-cream)',    // 칩·세그먼트 트랙·아바타·부드러운 면
          200: 'var(--hairline)',      // 1px 카드 경계
          300: 'var(--hairline-soft)', // 행 내부 구분
          400: 'var(--muted-soft)',    // 플레이스홀더
          500: 'var(--muted-soft)',
          600: 'var(--muted)',
          700: 'var(--body)',
          800: 'var(--body)',
          900: 'var(--dark-surface)',  // 반전 카드
        },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans KR"', '"Pretendard"', '"Apple SD Gothic Neo"', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // 실측 타입 스케일 (MEASURED_SPEC/tokens) — 대형 텍스트 자간 -0.022em 내장.
      fontSize: {
        display: ['42px', { lineHeight: '1.06', letterSpacing: '-0.022em', fontWeight: '700' }],
        kpi: ['34px', { lineHeight: '1', letterSpacing: '-0.022em', fontWeight: '700' }],
        stat: ['32px', { lineHeight: '1', letterSpacing: '-0.022em', fontWeight: '700' }],
        'card-title': ['22px', { lineHeight: '1.3', letterSpacing: '-0.022em', fontWeight: '700' }],
        amount: ['20px', { lineHeight: '1.2', letterSpacing: '-0.022em', fontWeight: '700' }],
        'list-title': ['19px', { lineHeight: '1.3', letterSpacing: '-0.022em', fontWeight: '700' }],
        subhead: ['16px', { lineHeight: '1.5' }],
      },
      boxShadow: {
        // Notion: 그림자 없음. depth = 1px 헤어라인 + 색면. (세그먼트 활성만 아주 옅게)
        card: 'none',
        'card-hover': 'none',
        seg: '0 1px 2px 0 rgb(0 0 0 / 0.06)',
        glow: '0 0 0 3px rgb(245 129 31 / 0.16)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.24s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
