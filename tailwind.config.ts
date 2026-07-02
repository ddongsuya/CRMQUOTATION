import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 실측 토큰(tokens.css) — 오렌지 단일 액센트. CTA·활성·링크·상태점·차트에만.
        brand: {
          DEFAULT: '#F5811F',
          50: '#FEF7F0',
          100: '#FEF0E2',   // accent-soft — 배지·활성 나브·호버 배경
          200: '#FBD9BC',
          300: '#F8C094',
          400: '#F6A05A',
          500: '#F5811F',   // accent
          600: '#F5811F',   // 1차 CTA
          700: '#DB7317',   // accent-hover
          800: '#B75E12',
          900: '#8A470E',
          light: '#FF9D4D',
          accent: '#DB7317',
        },
        ink: {
          DEFAULT: '#000000',  // text — 헤드라인·숫자·행 제목 near-black
          body: '#31302E',     // text-body — 본문
          muted: '#615D59',    // text-muted — 라벨·보조
          subtle: '#8C8781',   // 캡션·플레이스홀더·메타(파생)
        },
        // slate → 실측 중립색. bg=white, chip=#F1F1EF, hairline=#E6E6E6.
        slate: {
          50: '#F7F7F6',   // hover 표면
          100: '#F1F1EF',  // chip — 칩·세그먼트 트랙·아바타·부드러운 면
          200: '#E6E6E6',  // hairline — 1px 카드/구분선
          300: '#DCDBD7',
          400: '#B9B5AF',  // 플레이스홀더
          500: '#8C8781',
          600: '#615D59',  // muted
          700: '#4A4640',
          800: '#31302E',  // body
          900: '#191919',  // card-invert / dark surface
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
