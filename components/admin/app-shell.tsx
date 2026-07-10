'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, Search, User, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ADMIN_NAV_SECTIONS, isNavItemActive } from '@/lib/admin-nav';
import { cn } from '@/lib/cn';
import { AlertBanner } from '@/components/layout/alert-banner';

function NavSections({
  pathname,
  attentionCount,
  anomalyCount,
  onNavigate,
  compact,
}: {
  pathname: string | null;
  attentionCount: number;
  anomalyCount: number;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-6', compact && 'gap-4')}>
      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.id}>
          {section.label ? (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-admin-rail-muted">
              {section.label}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item);
              const badge =
                item.badgeKey === 'attention'
                  ? attentionCount
                  : item.badgeKey === 'anomalies'
                    ? anomalyCount
                    : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-admin-sm px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-admin-rail-active text-white'
                        : 'text-admin-rail-ink hover:bg-admin-rail-hover hover:text-white',
                    )}
                  >
                    {active ? (
                      <span className="nav-indicator absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-teal-300" />
                    ) : null}
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-teal-200' : 'text-admin-rail-muted')} />
                    <span className="flex-1 truncate font-medium">{item.name}</span>
                    {badge > 0 ? (
                      <span
                        className={cn(
                          'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white',
                          item.badgeKey === 'attention' ? 'bg-admin-danger' : 'bg-admin-warn',
                        )}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    // Prefer org candidate search when it looks like email; otherwise forensics-style deep link via orgs search.
    if (query.includes('@')) {
      router.push(`/organizations?q=${encodeURIComponent(query)}`);
    } else if (query.startsWith('cm') || query.length > 20) {
      router.push(`/candidate/${encodeURIComponent(query)}`);
    } else {
      router.push(`/organizations?q=${encodeURIComponent(query)}`);
    }
    setQ('');
  };

  return (
    <form onSubmit={submit} className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search org, email, candidate id…"
        className="admin-mono w-full rounded-admin-sm border border-admin-border bg-white py-1.5 pl-8 pr-3 text-xs text-admin-ink shadow-sm placeholder:font-sans placeholder:text-admin-muted focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
      />
    </form>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState('Admin');

  const { data: me } = trpc.platformAdmin.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const { data: healthData } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!me) return;
    const name = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
    setAdminDisplayName(name || me.email || 'Admin');
  }, [me]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const attentionCount = healthData?.alerts?.total ?? 0;
  const anomalyCount = healthData?.metrics?.locationAnomalies ?? 0;

  const rail = useMemo(
    () => (
      <NavSections
        pathname={pathname}
        attentionCount={attentionCount}
        anomalyCount={anomalyCount}
        onNavigate={() => setDrawerOpen(false)}
      />
    ),
    [pathname, attentionCount, anomalyCount],
  );

  return (
    <div className="admin-shell-bg min-h-screen">
      <AlertBanner />
      <div className="flex min-h-[calc(100vh-0px)]">
        {/* Desktop rail */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-admin-rail text-admin-rail-ink lg:flex">
          <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <Image
                src="/logo-insighthire-white.png"
                alt="InsightHire"
                width={160}
                height={40}
                className="h-7 w-auto object-contain object-left"
                priority
              />
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-200">
                Admin
              </span>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-4">{rail}</nav>
          <div className="border-t border-white/10 p-3 text-[10px] text-admin-rail-muted">
            Ops console · sessions not candidates
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-admin-rail shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                <span className="text-sm font-semibold text-white">Menu</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded p-1 text-admin-rail-muted hover:bg-admin-rail-hover hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-2 py-4">{rail}</nav>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-admin-border bg-white/90 px-3 backdrop-blur sm:px-6">
            <button
              type="button"
              className="rounded-admin-sm p-2 text-admin-secondary hover:bg-slate-100 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-1.5 lg:hidden">
              <span className="text-sm font-semibold text-admin-ink">InsightHire</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-admin-muted">
                Admin
              </span>
            </Link>
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-2">
              {attentionCount > 0 ? (
                <Link
                  href="/attention"
                  className="hidden items-center gap-1.5 rounded-admin-sm bg-admin-danger-soft px-2 py-1 text-xs font-semibold text-admin-danger sm:inline-flex"
                >
                  <span className="severity-pulse inline-block h-1.5 w-1.5 rounded-full bg-admin-danger" />
                  {attentionCount} need action
                </Link>
              ) : null}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-admin-sm px-2 py-1.5 text-sm text-admin-secondary hover:bg-slate-100"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden max-w-[140px] truncate sm:inline">{adminDisplayName}</span>
                </button>
                {userMenuOpen ? (
                  <div className="absolute right-0 mt-1 w-52 rounded-admin border border-admin-border bg-white py-1 shadow-lg">
                    <div className="border-b border-admin-border px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-admin-muted">Signed in</p>
                      <p className="truncate text-sm text-admin-ink">{adminDisplayName}</p>
                    </div>
                    <a
                      href="/api/auth/sign-out"
                      className="flex items-center px-3 py-2 text-sm text-admin-danger hover:bg-admin-danger-soft"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
