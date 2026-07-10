'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Lightweight section chrome for pages that still use legacy gray cards. */
export function AdminPageChrome({
  eyebrow,
  title,
  description,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-admin-ink">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-admin-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminSectionTabs({
  tabs,
}: {
  tabs: Array<{ href: string; label: string; match?: string[] }>;
}) {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-1 border-b border-admin-border">
      {tabs.map((t) => {
        const prefixes = t.match ?? [t.href];
        const active = prefixes.some((m) => pathname === m || pathname?.startsWith(`${m}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              active ? 'text-admin-ink' : 'text-admin-muted hover:text-admin-secondary',
            )}
          >
            {t.label}
            {active ? (
              <span className="nav-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-admin-accent" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
