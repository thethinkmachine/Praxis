/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0F1117',
          surface: '#161B22',
          surface2: '#21262D',
        },
        border: {
          DEFAULT: '#30363D',
        },
        text: {
          primary: '#E6EDF3',
          secondary: '#7D8590',
          muted: '#484F58',
        },
        accent: '#58A6FF',
        success: '#3FB950',
        warning: '#F0883E',
        danger: '#FF7B72',
        purple: '#D2A8FF',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
