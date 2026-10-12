'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/background-jobs', label: 'Background jobs', match: ['/background-jobs', '/pipeline', '/jobs'] },
  { href: '/scoring', label: 'AI scoring', match: ['/scoring'], exclude: ['/scoring/panel'] },
  { href: '/scoring/panel', label: 'Grader panel', match: ['/scoring/panel'] },
  { href: '/api-monitoring', label: 'API health', match: ['/api-monitoring'] },
] as const;

export function PipelineSubnav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-admin-border">
      {TABS.map((t) => {
        const excluded = 'exclude' in t && t.exclude.some((m) => pathname === m || pathname?.startsWith(`${m}/`));
        const active = !excluded && t.match.some((m) => pathname === m || pathname?.startsWith(`${m}/`));
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
