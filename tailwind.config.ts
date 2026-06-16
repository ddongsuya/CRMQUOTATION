import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // CHEMON 디자인 — 테라코타(burnt orange) 브랜드
        brand: {
          DEFAULT: '#E2560A',
          50: '#FFF6EF',
          100: '#FFF1E6',
          200: '#FBDCC4',
          300: '#F7BC8E',
          400: '#F2964F',
          500: '#F26F21',
          600: '#E2560A',
          700: '#C25510',
          800: '#9A5418',
          900: '#7C4415',
          light: '#F2964F',
          accent: '#C25510',
        },
        ink: {
          DEFAULT: '#2B2620',
          muted: '#5C5447',
          subtle: '#8A7E6C',
        },
        // slate 를 따뜻한 토프/아이보리로 재정의 → 앱 전체 그레이가 웜톤으로
        slate: {
          50: '#FBF8F3',
          100: '#F6F2EB',
          200: '#EFE9E0',
          300: '#E6DDD0',
          400: '#CDBFA9',
          500: '#B0A696',
          600: '#8A7E6C',
          700: '#6E665A',
          800: '#5C5447',
          900: '#2B2620',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', '"Pretendard"', '"Apple SD Gothic Neo"', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(43 38 32 / 0.04), 0 1px 3px 0 rgb(43 38 32 / 0.05)',
        'card-hover': '0 4px 14px -2px rgb(43 38 32 / 0.10), 0 2px 6px -1px rgb(43 38 32 / 0.05)',
        glow: '0 0 0 4px rgb(226 86 10 / 0.14)',
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
