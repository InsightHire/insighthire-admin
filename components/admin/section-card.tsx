import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Card with a standard header (icon tile, title, one-line description,
 * actions or an "open" link) and an optional footer.
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  href,
  hrefLabel = 'View all',
  footer,
  padded = true,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  footer?: React.ReactNode;
  /** Set false for tables and lists that run edge to edge. */
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  const hasHeader = title || description || actions || href;
  return (
    <section className={cn('admin-panel flex flex-col overflow-hidden', className)}>
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 border-b border-admin-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-admin-accent-border bg-admin-accent-soft text-admin-accent [&>svg]:h-4 [&>svg]:w-4">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              {title ? <h2 className="truncate text-[15px] font-semibold text-admin-ink">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-xs leading-relaxed text-admin-muted">{description}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {href ? (
              <Link
                href={href}
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-semibold text-admin-muted transition-colors hover:bg-admin-accent-soft hover:text-admin-accent-ink"
              >
                {hrefLabel}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={cn('flex-1', padded && 'p-5', bodyClassName)}>{children}</div>
      {footer ? (
        <footer className="border-t border-admin-border bg-admin-bg/50 px-5 py-3 text-xs text-admin-muted">{footer}</footer>
      ) : null}
    </section>
  );
}

/** Label/value pairs in a responsive grid, for settings and summaries. */
export function DetailList({
  items,
  cols = 3,
  className,
}: {
  items: Array<{ label: React.ReactNode; value: React.ReactNode }>;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">{item.label}</dt>
          <dd className="mt-1 text-sm text-admin-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
