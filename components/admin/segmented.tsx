'use client';

import { cn } from '@/lib/cn';

export type SegmentedOption<T extends string | number> = { value: T; label: React.ReactNode; count?: number };

/** Pill-style switch for periods, views and in-page tabs. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-admin-border bg-white p-0.5 shadow-sm', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active
                ? 'bg-admin-accent text-white shadow-sm'
                : 'text-admin-muted hover:bg-admin-rail-hover hover:text-admin-ink',
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-admin-muted',
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
