import type { Config } from 'tailwindcss';

// Brand tokens copied from mobile/src/theme/tokens.ts
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#14121C',
        raised: '#1A1724',
        line: 'rgba(255,255,255,0.09)',
        lineStrong: 'rgba(255,255,255,0.18)',
        ink: { DEFAULT: '#FFFFFF', 2: '#C9C3DA', muted: '#9A93B0', faint: '#7D7790' },
        pink: { DEFAULT: '#FF4D8D', soft: '#FF7AA8' },
        magenta: '#C04CF0',
        violet: '#7C5CFF',
        gold: '#FFC857',
        ok: '#2BD97C',
        danger: '#FF5C5C',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #FF4D8D 0%, #C04CF0 50%, #7C5CFF 100%)',
      },
      boxShadow: { glow: '0 10px 18px rgba(224,71,158,0.35)' },
    },
  },
  plugins: [],
};
export default config;
