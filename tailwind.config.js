/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const tokens = [
  'paper', 'surface', 'surface-2', 'surface-3', 'line', 'ink', 'ink-2', 'ink-3',
  'brand', 'brand-soft', 'on-brand', 'act', 'on-act', 'on-ok', 'code', 'code-ink',
  'crit', 'high', 'mod', 'verify', 'ok', 'info', 'low',
  'crit-soft', 'crit-ink', 'high-soft', 'high-ink', 'warn-soft', 'warn-ink',
  'verify-soft', 'verify-ink', 'ok-soft', 'ok-ink', 'info-soft', 'info-ink',
];
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next Variable"', '"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', '"Atkinson Hyperlegible Next Variable"', 'sans-serif'],
        data: ['"Barlow Semi Condensed"', '"Atkinson Hyperlegible Next Variable"', 'sans-serif'],
      },
      colors: Object.fromEntries(tokens.map((t) => [t, v(t)])),
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .10), 0 6px 18px -10px rgb(var(--shadow) / .35)',
        float: '0 18px 40px -16px rgb(var(--shadow) / .55)',
      },
    },
  },
  plugins: [],
};
