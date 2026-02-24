/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    fontSize: {
      xs:   ['0.6875rem', { lineHeight: '1rem',    letterSpacing: '0.01em'  }],   // 11px — labels, meta
      sm:   ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0.005em' }],   // 13px — nav, secondary
      base: ['0.9375rem', { lineHeight: '1.625rem', letterSpacing: '0'      }],   // 15px — body
      lg:   ['1.125rem',  { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],   // 18px — lead text
      xl:   ['1.5rem',    { lineHeight: '1.875rem', letterSpacing: '-0.02em' }],  // 24px — small headings
      '2xl': ['2rem',     { lineHeight: '2.375rem', letterSpacing: '-0.025em' }], // 32px — section headings
      '3xl': ['2.75rem',  { lineHeight: '3.125rem', letterSpacing: '-0.03em'  }], // 44px — page headings
      '4xl': ['3.5rem',   { lineHeight: '3.875rem', letterSpacing: '-0.035em' }], // 56px — hero
    },
    extend: {
      fontFamily: {
        serif: ['"Crimson Text"', 'Georgia', 'serif'],
        sans: ['"Open Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        cadet: {
          50: '#f0f7f7',
          100: '#d9eded',
          200: '#b3dbdc',
          300: '#82c2c4',
          400: '#5f9ea0',
          500: '#4a8385',
          600: '#3d6b6d',
          700: '#345859',
          800: '#2e4a4b',
          900: '#293f40',
          950: '#162526',
        },
        sea: {
          50: '#f0fdf5',
          100: '#dcfce8',
          200: '#bbf7d2',
          300: '#86efad',
          400: '#4ade80',
          500: '#2e8b57',
          600: '#22774a',
          700: '#1d633e',
          800: '#1b4f34',
          900: '#18412c',
          950: '#0a2518',
        },
      },
    },
  },
}
