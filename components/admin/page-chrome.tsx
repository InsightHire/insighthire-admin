'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { PageHeader, type Breadcrumb } from './page-header';

const WIDTH = {
  narrow: 'max-w-4xl',
  default: 'max-w-7xl',
  wide: 'max-w-[96rem]',
} as const;

/** Page container: consistent width and padding for every admin screen. */
export function AdminPage({
  children,
  width = 'default',
  className,
}: {
  children: React.ReactNode;
  width?: keyof typeof WIDTH;
  className?: string;
}) {
  return <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8', WIDTH[width], className)}>{children}</div>;
}

/** Page container plus the standard header. */
export function AdminPageChrome({
  eyebrow,
  title,
  description,
  children,
  actions,
  breadcrumbs,
  icon,
  meta,
  width,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  width?: keyof typeof WIDTH;
}) {
  return (
    <AdminPage width={width}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        breadcrumbs={breadcrumbs}
        icon={icon}
        meta={meta}
      />
      {children}
    </AdminPage>
  );
}

export function AdminSectionTabs({
  tabs,
}: {
  tabs: Array<{ href: string; label: string; match?: string[] }>;
}) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-admin-border">
      {tabs.map((t) => {
        const prefixes = t.match ?? [t.href];
        const active = prefixes.some((m) => pathname === m || pathname?.startsWith(`${m}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'text-admin-accent-ink' : 'text-admin-muted hover:text-admin-ink',
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
