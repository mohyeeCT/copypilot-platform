import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:             'var(--bg)',
        surface:        'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'sidebar-bg':   'var(--sidebar-bg)',
        border:         'var(--border)',
        'border-subtle':'var(--border-subtle)',
        text:           'var(--text)',
        muted:          'var(--muted)',
        accent:         'var(--accent)',
        error:          'var(--error)',
        warning:        'var(--warning)',
        success:        'var(--success)',
        // Per-tool accent hues
        'tool-faq':     'var(--tool-faq)',
        'tool-intro':   'var(--tool-intro)',
        'tool-meta':    'var(--tool-meta)',
        'tool-page':    'var(--tool-page)',
        'tool-aio':     'var(--tool-aio)',
        'tool-neutral': 'var(--tool-neutral)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        xs:     'var(--shadow-xs)',
        sm:     'var(--shadow-sm)',
        md:     'var(--shadow-md)',
        lg:     'var(--shadow-lg)',
        accent: 'var(--shadow-accent)',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}
export default config
