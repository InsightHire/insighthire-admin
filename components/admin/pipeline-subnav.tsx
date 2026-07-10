'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/background-jobs', label: 'Background jobs', match: ['/background-jobs', '/pipeline', '/jobs'] },
  { href: '/scoring', label: 'AI scoring', match: ['/scoring'] },
  { href: '/api-monitoring', label: 'API health', match: ['/api-monitoring'] },
] as const;

export function PipelineSubnav() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-1 border-b border-admin-border">
      {TABS.map((t) => {
        const active = t.match.some((m) => pathname === m || pathname?.startsWith(`${m}/`));
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
