/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './contexts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        admin: {
          bg: 'var(--bg)',
          panel: 'var(--panel)',
          ink: 'var(--ink)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--muted)',
          border: 'var(--border)',
          accent: 'var(--accent)',
          'accent-soft': 'var(--accent-soft)',
          'accent-ink': 'var(--accent-ink)',
          danger: 'var(--danger)',
          'danger-soft': 'var(--danger-soft)',
          warn: 'var(--warn)',
          'warn-soft': 'var(--warn-soft)',
          ok: 'var(--ok)',
          'ok-soft': 'var(--ok-soft)',
          info: 'var(--info)',
          'info-soft': 'var(--info-soft)',
          rail: 'var(--rail)',
          'rail-ink': 'var(--rail-ink)',
          'rail-muted': 'var(--rail-muted)',
          'rail-hover': 'var(--rail-hover)',
          'rail-active': 'var(--rail-active)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
      },
      borderRadius: {
        admin: 'var(--radius)',
        'admin-sm': 'var(--radius-sm)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
