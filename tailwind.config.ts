import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0e27',
        foreground: '#f5f5f5',
        card: '#1a1f3a',
        'card-hover': '#252d4a',
        border: '#2d3647',
        muted: '#8892a8',
        'muted-foreground': '#6b7280',
        primary: '#10b981',
        'primary-hover': '#059669',
        'primary-dark': '#047857',
        secondary: '#fbbf24',
        'secondary-hover': '#f59e0b',
        accent: '#ff6b6b',
        'accent-hover': '#ef4444',
        warning: '#fb923c',
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
      },
      backgroundColor: {
        dark: '#0a0e27',
        darker: '#050812',
        card: '#1a1f3a',
      },
      textColor: {
        primary: '#f5f5f5',
        secondary: '#8892a8',
        muted: '#6b7280',
      },
      borderColor: {
        DEFAULT: '#2d3647',
        light: '#3f4759',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 15px -3px rgba(16, 185, 129, 0.1)',
      },
    },
  },
  plugins: [],
}

export default config
