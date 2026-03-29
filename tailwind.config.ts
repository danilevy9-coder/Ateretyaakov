import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#0a0a0c',
          50: '#1a1a20',
          100: '#141418',
          200: '#0f0f13',
          300: '#0a0a0c',
        },
        gold: {
          DEFAULT: '#D4AF37',
          50: '#f5e6a3',
          100: '#edd97a',
          200: '#e3c85a',
          300: '#D4AF37',
          400: '#b8962e',
          500: '#9a7c25',
          600: '#7d641c',
        },
        navy: {
          DEFAULT: '#0d1b2a',
          50: '#1a3352',
          100: '#152b44',
          200: '#102337',
          300: '#0d1b2a',
          400: '#091522',
          500: '#050f1a',
        },
        cream: '#f5f0e8',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        hebrew: ['var(--font-noto-serif-hebrew)', 'serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #f5e6a3 50%, #D4AF37 100%)',
        'obsidian-gradient': 'linear-gradient(180deg, #0a0a0c 0%, #141418 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center, #1a1a20 0%, #0a0a0c 70%)',
        'glow-gold': 'radial-gradient(ellipse at center, rgba(212,175,55,0.15) 0%, transparent 70%)',
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'grain': 'grain 8s steps(10) infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212,175,55,0.3), 0 0 60px rgba(212,175,55,0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(212,175,55,0.6), 0 0 100px rgba(212,175,55,0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-2%, -3%)' },
          '20%': { transform: 'translate(3%, 2%)' },
          '30%': { transform: 'translate(-1%, 4%)' },
          '40%': { transform: 'translate(4%, -1%)' },
          '50%': { transform: 'translate(-3%, 3%)' },
          '60%': { transform: 'translate(2%, -4%)' },
          '70%': { transform: 'translate(-4%, 1%)' },
          '80%': { transform: 'translate(1%, -2%)' },
          '90%': { transform: 'translate(3%, 4%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      screens: {
        '3xl': '1920px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};

export default config;
