/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui-kit/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-midnight': '#0B0F19',
        'card-surface': '#111827',
        'well-surface': '#1E293B',
        'utility-slate': '#64748B',
        'solar-gold': '#FFBF00',
        'clean-emerald': '#10B981',
        'ion-cyan': '#22D3EE',
        'combustion-crimson': '#EF4444',
        // Legacy Brand Mappings
        'brand-forest': '#111827',
        'brand-dark': '#0B0F19',
        'brand-amber': '#FFBF00',
        'brand-teal': '#10B981',
        'brand-sky': '#22D3EE',
        'brand-sky-light': '#38BDF8',
        'brand-sky-dark': '#06B6D4',
        'brand-warm': '#F8FAF7',
        'brand-charcoal': '#1E293B',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

