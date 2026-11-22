import type { Config } from 'tailwindcss';

// Mirrors apps/mobile/lib/core/theme/app_theme.dart so the admin panel and
// student app share the same Raja Rani design system.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0B5D52',
        primaryLight: '#14806F',
        secondary: '#E8A33D',
        background: '#FAFAF8',
        surface: '#FFFFFF',
        textMuted: '#6B7280',
        success: '#2E7D32',
        error: '#C62828',
        border: '#E5E7EB',
      },
      borderRadius: { card: '16px' },
    },
  },
  plugins: [],
};
export default config;
