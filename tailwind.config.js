/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // YZZY Official Calm Technology Palette
        primary: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB', // Primary YZZY
          700: '#1D4ED8', // Primary Hover
          800: '#1E40AF', // Primary Active
          900: '#1E3A8A',
          950: '#172554',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F8FAFC',
          tertiary: '#F1F5F9',
        },
        yzzy: {
          bg: '#F7F9FC',
          border: '#E2E8F0',
          'border-focus': '#93C5FD',
          text: {
            primary: '#0F172A',
            secondary: '#64748B',
            muted: '#94A3B8',
          },
        },
        status: {
          success: {
            DEFAULT: '#10B981',
            soft: '#ECFDF5',
            border: '#A7F3D0',
            text: '#065F46',
          },
          warning: {
            DEFAULT: '#F59E0B',
            soft: '#FFFBEB',
            border: '#FDE68A',
            text: '#92400E',
          },
          danger: {
            DEFAULT: '#EF4444',
            soft: '#FEF2F2',
            border: '#FECACA',
            text: '#991B1B',
          },
          info: {
            DEFAULT: '#3B82F6',
            soft: '#EFF6FF',
            border: '#BFDBFE',
            text: '#1E40AF',
          },
        },
        // Legacy brand aliases for full backwards compatibility
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
          950: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'sm': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'md': '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        'floating': '0 12px 28px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
        'focus': '0 0 0 3px rgba(37, 99, 235, 0.18)',
        'subtle-blue': '0 8px 24px -4px rgba(37, 99, 235, 0.10)',
        'card-hover': '0 8px 20px -4px rgba(15, 23, 42, 0.08), 0 3px 6px -2px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        'input': '11px',
        'btn': '11px',
        'card-sm': '13px',
        'card': '16px',
        'modal': '18px',
      },
      transitionDuration: {
        'default': '200ms',
        'quick': '150ms',
      },
    },
  },
  plugins: [],
}
