/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#0b0a1f', 900: '#12102e', 800: '#1b1842', 700: '#262259', 600: '#35307a' },
        go: '#ec4899',
        cli: '#3b82f6',
        cir: '#f97316',
        pre: '#22c55e',
        ped: '#eab308',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(16px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-8px)' }, '40%,80%': { transform: 'translateX(8px)' } },
        floatUp: { '0%': { transform: 'translateY(0)', opacity: 1 }, '100%': { transform: 'translateY(-60px)', opacity: 0 } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(255,255,255,.5)' }, '100%': { boxShadow: '0 0 0 18px rgba(255,255,255,0)' } },
        glow: { '0%,100%': { filter: 'drop-shadow(0 0 6px rgba(250,204,21,.6))' }, '50%': { filter: 'drop-shadow(0 0 18px rgba(250,204,21,1))' } },
        slideIn: { '0%': { transform: 'translateX(40px) scale(.96)', opacity: 0 }, '100%': { transform: 'translateX(0) scale(1)', opacity: 1 } },
        zoomOut: { '0%': { transform: 'scale(1)', opacity: 1 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        pop: 'pop .45s cubic-bezier(.2,1.4,.4,1) both',
        rise: 'rise .4s ease-out both',
        shake: 'shake .45s ease-in-out',
        floatUp: 'floatUp 1.2s ease-out forwards',
        pulseRing: 'pulseRing 1.2s ease-out infinite',
        glow: 'glow 1.6s ease-in-out infinite',
        slideIn: 'slideIn .45s cubic-bezier(.2,1,.3,1) both',
        zoomOut: 'zoomOut .5s ease-in forwards',
        bob: 'bob 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
