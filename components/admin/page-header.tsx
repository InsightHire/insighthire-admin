import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export type Breadcrumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Breadcrumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1 text-xs text-admin-muted', className)}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <ChevronRight className="h-3 w-3 text-admin-border-strong" /> : null}
          {item.href ? (
            <Link href={item.href} className="font-medium hover:text-admin-accent-ink">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-admin-secondary">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  breadcrumbs,
  icon,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: string;
  breadcrumbs?: Breadcrumb[];
  /** Small icon tile shown left of the title. */
  icon?: React.ReactNode;
  /** Inline pills or ids shown next to the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-3" /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon ? (
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-admin border border-admin-accent-border bg-admin-accent-soft text-admin-accent [&>svg]:h-5 [&>svg]:w-5">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-accent">
                {eyebrow}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-admin-ink sm:text-[1.7rem]">{title}</h1>
              {meta}
            </div>
            {description ? (
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-admin-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
