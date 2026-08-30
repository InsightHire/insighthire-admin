'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, PanelLeft, PanelLeftClose, Search, User, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ADMIN_NAV_SECTIONS, PUBLISHER_NAV_SECTIONS, type AdminNavSection, isNavItemActive } from '@/lib/admin-nav';
import { cn } from '@/lib/cn';
import { AlertBanner } from '@/components/layout/alert-banner';
import { readSideNavCollapsed, writeSideNavCollapsed } from '@/lib/side-nav-collapsed';

function NavSections({
  sections,
  pathname,
  attentionCount,
  anomalyCount,
  onNavigate,
  compact,
  mini,
}: {
  sections: AdminNavSection[];
  pathname: string | null;
  attentionCount: number;
  anomalyCount: number;
  onNavigate?: () => void;
  compact?: boolean;
  mini?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-6', compact && 'gap-4')}>
      {sections.map((section) => (
        <div key={section.id}>
          {section.label && !mini ? (
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
                    title={mini ? item.name : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-admin-sm px-3 py-2 text-sm transition-colors',
                      mini && 'justify-center px-0',
                      active
                        ? 'bg-admin-rail-active text-white'
                        : 'text-admin-rail-ink hover:bg-admin-rail-hover hover:text-white',
                    )}
                  >
                    {active ? (
                      <span
                        className={cn(
                          'nav-indicator absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-teal-300',
                          mini ? '-left-0.5' : 'left-0',
                        )}
                      />
                    ) : null}
                    <span className="relative shrink-0">
                      <Icon className={cn('h-4 w-4', active ? 'text-teal-200' : 'text-admin-rail-muted')} />
                      {mini && badge > 0 ? (
                        <span
                          className={cn(
                            'absolute -right-1 -top-1 h-2 w-2 rounded-full',
                            item.badgeKey === 'attention' ? 'bg-admin-danger' : 'bg-admin-warn',
                          )}
                        />
                      ) : null}
                    </span>
                    {!mini ? (
                      <>
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
                      </>
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
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState('Admin');
  const [railCollapsed, setRailCollapsed] = useState(true);

  useEffect(() => {
    setRailCollapsed(readSideNavCollapsed());
  }, []);

  const toggleRailCollapsed = () => {
    setRailCollapsed((prev) => {
      const next = !prev;
      writeSideNavCollapsed(next);
      return next;
    });
  };

  // blogAdmin.whoAmI (not platformAdmin.me) because platformAdminProcedure
  // deliberately rejects the platform_publisher role — every platform-admin
  // role, publisher included, is allowed to call this one, so it's safe to
  // fire before we know which role we're dealing with.
  const { data: who } = trpc.blogAdmin.whoAmI.useQuery(undefined, { retry: false });
  const isPublisher = who?.isPublisher ?? false;

  // Never call platformAdmin.* for a publisher: platformAdminMiddleware
  // rejects it with FORBIDDEN, and the tRPC client's fetch wrapper treats any
  // FORBIDDEN as an expired session and redirects to session refresh — which
  // bounces right back here and loops. Only enable once we positively know
  // the caller isn't a publisher.
  const { data: me } = trpc.platformAdmin.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
    enabled: who !== undefined && !isPublisher,
  });

  const { data: healthData } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
    enabled: who !== undefined && !isPublisher,
  });

  useEffect(() => {
    if (!me) return;
    const name = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
    setAdminDisplayName(name || me.email || 'Admin');
  }, [me]);

  useEffect(() => {
    if (who) {
      const name = [who.firstName, who.lastName].filter(Boolean).join(' ').trim();
      if (isPublisher) setAdminDisplayName(name || who.email || 'Publisher');
    }
  }, [who, isPublisher]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Publisher is scoped to blog management only — bounce anywhere else in
  // the console back to the one section they're allowed to use.
  useEffect(() => {
    if (isPublisher && pathname && !pathname.startsWith('/blog')) {
      router.replace('/blog');
    }
  }, [isPublisher, pathname, router]);

  const attentionCount = isPublisher ? 0 : (healthData?.alerts?.total ?? 0);
  const anomalyCount = isPublisher ? 0 : (healthData?.metrics?.locationAnomalies ?? 0);
  const navSections = isPublisher ? PUBLISHER_NAV_SECTIONS : ADMIN_NAV_SECTIONS;

  const rail = useMemo(
    () => (
      <NavSections
        sections={navSections}
        pathname={pathname}
        attentionCount={attentionCount}
        anomalyCount={anomalyCount}
        onNavigate={() => setDrawerOpen(false)}
        mini={railCollapsed}
      />
    ),
    [navSections, pathname, attentionCount, anomalyCount, railCollapsed],
  );

  const mobileRail = useMemo(
    () => (
      <NavSections
        sections={navSections}
        pathname={pathname}
        attentionCount={attentionCount}
        anomalyCount={anomalyCount}
        onNavigate={() => setDrawerOpen(false)}
      />
    ),
    [navSections, pathname, attentionCount, anomalyCount],
  );

  return (
    <div className="min-h-screen bg-white">
      <AlertBanner />
      <div className="flex min-h-[calc(100vh-0px)]">
        {/* Desktop rail */}
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col bg-admin-rail text-admin-rail-ink transition-[width] duration-150 lg:flex',
            railCollapsed ? 'w-16' : 'w-60',
          )}
        >
          <div
            className={cn(
              'flex h-14 items-center gap-2 border-b border-white/10',
              railCollapsed ? 'justify-center px-0' : 'px-4',
            )}
          >
            <Link href="/" className="flex min-w-0 items-center gap-2" title="InsightHire">
              {railCollapsed ? (
                // eslint-disable-next-line @next/next/no-img-element -- SVG source; next/image optimizer rejects local SVGs
                <img src="/favicon.svg" alt="InsightHire" className="h-8 w-8 shrink-0" />
              ) : (
                <>
                  <Image
                    src="/brand/insighthire-logo-dark.png"
                    alt="InsightHire"
                    width={1834}
                    height={360}
                    className="h-6 w-auto object-contain object-left"
                    priority
                  />
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-200">
                    Admin
                  </span>
                </>
              )}
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-4">{rail}</nav>
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={toggleRailCollapsed}
              title={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-admin-sm px-3 py-2 text-sm font-medium text-admin-rail-ink transition-colors hover:bg-admin-rail-hover hover:text-white',
                railCollapsed && 'justify-center px-0',
              )}
            >
              {railCollapsed ? (
                <PanelLeft className="h-4 w-4 shrink-0 text-admin-rail-muted" />
              ) : (
                <PanelLeftClose className="h-4 w-4 shrink-0 text-admin-rail-muted" />
              )}
              {!railCollapsed ? <span>Collapse</span> : null}
            </button>
          </div>
          {!railCollapsed ? (
            <div className="border-t border-white/10 p-3 text-[10px] text-admin-rail-muted">
              Ops console · sessions not candidates
            </div>
          ) : null}
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
              <nav className="flex-1 overflow-y-auto px-2 py-4">{mobileRail}</nav>
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
              <Image
                src="/brand/insighthire-logo-light.png"
                alt="InsightHire"
                width={1834}
                height={360}
                className="h-5 w-auto object-contain"
                priority
              />
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
