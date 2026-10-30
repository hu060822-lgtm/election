/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#060B16', 2: '#0A1222' },
        panel: { DEFAULT: '#0C1528', 2: '#111D36', 3: '#17264A' },
        rule: { DEFAULT: '#1C2A47', strong: '#2A3B60' },
        electric: { DEFAULT: '#3AA0FF', dim: '#1F6FC2', glow: '#7CC2FF' },
        signal: { DEFAULT: '#FF3B4E', dim: '#B4202F' },
        gold: { DEFAULT: '#E6B84C', dim: '#9C7A2A' },
        text: { DEFAULT: '#E9EEF8', 2: '#B5C0D6', 3: '#7E8BA6', 4: '#56627D' },
        nodata: '#26324D',
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        lift: '0 10px 30px -12px rgba(0, 0, 0, 0.7)',
      },
      keyframes: {
        ticker: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        ticker: 'ticker 60s linear infinite',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
