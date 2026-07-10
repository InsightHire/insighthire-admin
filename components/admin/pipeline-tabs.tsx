'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/admin/page-header';

const TABS = [
  { id: 'jobs', label: 'Background jobs', href: '/pipeline?tab=jobs' },
  { id: 'scoring', label: 'AI scoring', href: '/pipeline?tab=scoring' },
  { id: 'api', label: 'API health', href: '/pipeline?tab=api' },
] as const;

export function PipelineTabs({ children }: { children?: React.ReactNode }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'jobs';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Operations"
        title="Pipeline"
        description="Workers, scoring health, and API status — consolidated ops surface."
      />
      <div className="mb-4 flex gap-1 border-b border-admin-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'text-admin-ink' : 'text-admin-muted hover:text-admin-secondary',
            )}
          >
            {t.label}
            {tab === t.id ? (
              <span className="nav-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-admin-accent" />
            ) : null}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}

export function usePipelineTab(): 'jobs' | 'scoring' | 'api' {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  if (tab === 'scoring' || tab === 'api') return tab;
  return 'jobs';
}

/** Highlight active path for legacy redirects. */
export function useIsPipelinePath() {
  const pathname = usePathname();
  return (
    pathname === '/pipeline' ||
    pathname?.startsWith('/background-jobs') ||
    pathname?.startsWith('/scoring') ||
    pathname?.startsWith('/api-monitoring')
  );
}
