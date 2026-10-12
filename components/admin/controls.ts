/** Shared class strings for native form controls and buttons across admin pages. */

export const inputClass =
  'block w-full rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm text-admin-ink shadow-sm placeholder:text-admin-muted focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/15 disabled:bg-slate-50 disabled:text-admin-muted';

export const selectClass =
  'block rounded-admin-sm border border-admin-border bg-white py-2 pl-3 pr-8 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/15 disabled:bg-slate-50';

export const checkboxClass = 'h-4 w-4 rounded border-admin-border-strong text-admin-accent focus:ring-admin-accent/30';

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-admin-sm text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 disabled:pointer-events-none disabled:opacity-40';

export const buttonClass = {
  primary: `${buttonBase} bg-admin-accent px-3.5 py-2 text-white shadow-sm hover:bg-admin-accent-ink`,
  secondary: `${buttonBase} border border-admin-border bg-white px-3.5 py-2 text-admin-ink shadow-sm hover:border-admin-border-strong hover:bg-admin-bg`,
  danger: `${buttonBase} bg-admin-danger px-3.5 py-2 text-white shadow-sm hover:bg-red-700`,
  ghost: `${buttonBase} px-2.5 py-1.5 text-admin-secondary hover:bg-admin-rail-hover hover:text-admin-ink`,
  small: `${buttonBase} border border-admin-border bg-white px-2.5 py-1 text-xs text-admin-ink hover:border-admin-border-strong hover:bg-admin-bg`,
} as const;
