import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Notion-스타일 · 오렌지 단일 액센트 (#F5811F). 오렌지는 CTA·활성·링크에만.
        brand: {
          DEFAULT: '#F5811F',
          50: '#FEF5EC',
          100: '#FCE8D3',   // 오렌지 틴트 배경(활성 나브·필·진행바 트랙)
          200: '#F9CFA6',
          300: '#F7B476',
          400: '#F69B49',
          500: '#F5811F',   // accent
          600: '#F5811F',   // 1차 CTA
          700: '#E06A12',   // hover/press
          800: '#B9560F',
          900: '#8A4210',
          light: '#FF9D4D',
          accent: '#E06A12',
        },
        ink: {
          DEFAULT: '#211f1c',  // 헤드라인·주요 텍스트(웜 near-black)
          muted: '#615d59',    // 본문·보조
          subtle: '#a39e98',   // 캡션·플레이스홀더·메타
        },
        // slate → Notion 웜 중립색(헤어라인·크림면·바닥). 앱 전역 그레이가 이 팔레트로.
        slate: {
          50: '#f6f5f4',   // floor(페이지 바닥, 웜 페이퍼) · hover
          100: '#f1f1ef',  // card-cream(아바타·칩·세그먼트 트랙·부드러운 필)
          200: '#e6e6e6',  // hairline(1px 경계)
          300: '#dcdbd7',
          400: '#c3c0bb',  // 플레이스홀더
          500: '#a39e98',  // muted-soft
          600: '#615d59',  // muted
          700: '#4a4640',
          800: '#31302e',  // body
          900: '#191918',  // dark surface(반전 카드) · near-black
        },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans KR"', '"Pretendard"', '"Apple SD Gothic Neo"', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        // Notion: 그림자 거의 없음. depth = 1px 헤어라인 + 색면.
        card: '0 1px 0 0 rgb(17 17 17 / 0.02)',
        'card-hover': '0 1px 3px 0 rgb(17 17 17 / 0.06)',
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
