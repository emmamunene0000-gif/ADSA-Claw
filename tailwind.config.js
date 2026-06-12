/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0a0a14',
        panel:    '#0f0f20',
        card:     '#13132a',
        border:   '#1e1e3a',
        gold:     '#FFD700',
        teal:     '#00c9a7',
        red:      '#ff4757',
        amber:    '#f4a523',
        text:     '#e8e8f0',
        muted:    '#6b6b8a',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-teal': 'pulse-teal 2s ease-in-out infinite',
        'pulse-red':  'pulse-red 2s ease-in-out infinite',
        'slide-in':   'slide-in 200ms ease-out',
      },
      keyframes: {
        'pulse-teal': { '0%,100%': { boxShadow: '0 0 0 0 rgba(0,201,167,0.4)' }, '50%': { boxShadow: '0 0 0 4px rgba(0,201,167,0)' } },
        'pulse-red':  { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,71,87,0.4)' },  '50%': { boxShadow: '0 0 0 4px rgba(255,71,87,0)' } },
        'slide-in':   { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      }
    }
  },
  plugins: []
}
