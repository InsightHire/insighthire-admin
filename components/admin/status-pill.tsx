import { cn } from '@/lib/cn';

const TONES = {
  success: { pill: 'bg-admin-ok-soft text-emerald-700 ring-emerald-600/15', dot: 'bg-emerald-500' },
  brand: { pill: 'bg-admin-accent-soft text-admin-accent-ink ring-admin-accent/20', dot: 'bg-admin-accent' },
  warn: { pill: 'bg-admin-warn-soft text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  danger: { pill: 'bg-admin-danger-soft text-red-700 ring-red-600/15', dot: 'bg-red-500' },
  info: { pill: 'bg-admin-info-soft text-sky-700 ring-sky-600/15', dot: 'bg-sky-500' },
  neutral: { pill: 'bg-slate-100 text-slate-700 ring-slate-500/15', dot: 'bg-slate-400' },
} as const;

export type StatusTone = keyof typeof TONES;

/** Rounded status label with an optional leading dot. */
export function StatusPill({
  tone = 'neutral',
  dot = true,
  children,
  className,
  title,
}: {
  tone?: StatusTone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        t.pill,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} /> : null}
      {children}
    </span>
  );
}
