/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a4bcfc',
          400: '#7b97f8',
          500: '#5a71f2',
          600: '#4553e6',
          700: '#3a43cb',
          800: '#3139a4',
          900: '#2d3682',
          950: '#1e2150',
        },
        accent: {
          50: '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6e0',
          300: '#5fe9ce',
          400: '#2ed3b7',
          500: '#15b79e',
          600: '#0e9380',
          700: '#107569',
          800: '#125d55',
          900: '#134d47',
          950: '#042f2b',
        },
        dark: {
          50: '#f6f7f9',
          100: '#eceff3',
          200: '#d5dbe4',
          300: '#b1bccc',
          400: '#8798b0',
          500: '#687b96',
          600: '#53637c',
          700: '#445065',
          800: '#3b4555',
          900: '#343c49',
          950: '#0f1117',
        },
        surface: {
          50: '#fafbfc',
          100: '#f0f2f5',
          200: '#e4e7ec',
          300: '#d1d5db',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
