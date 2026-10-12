'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, PanelLeft, PanelLeftClose, Search, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  ADMIN_NAV_GROUPS,
  PUBLISHER_NAV_GROUPS,
  type AdminNavBadge,
  type AdminNavGroup,
  type AdminNavItem,
  isNavGroupActive,
  isNavItemActive,
  navGroupBadge,
  navItemBadge,
} from '@/lib/admin-nav';
import { cn } from '@/lib/cn';
import { AlertBanner } from '@/components/layout/alert-banner';
import { OPEN_GLOBAL_SEARCH_EVENT } from '@/components/platform-admin/global-search';
import {
  readSideNavCollapsed,
  readSideNavSections,
  writeSideNavCollapsed,
  writeSideNavSections,
} from '@/lib/side-nav-collapsed';

function badgeToneClass(tone: AdminNavBadge['tone']) {
  return tone === 'danger' ? 'bg-admin-danger text-white' : 'bg-amber-100 text-amber-800';
}

function NavBadge({ badge }: { badge: AdminNavBadge }) {
  return (
    <span
      className={cn(
        'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
        badgeToneClass(badge.tone),
      )}
    >
      {badge.count > 99 ? '99+' : badge.count}
    </span>
  );
}

function NavItemLink({
  item,
  pathname,
  attentionCount,
  anomalyCount,
  onNavigate,
  mini,
}: {
  item: AdminNavItem;
  pathname: string | null;
  attentionCount: number;
  anomalyCount: number;
  onNavigate?: () => void;
  mini?: boolean;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item);
  const badge = navItemBadge(item, attentionCount, anomalyCount);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={mini ? item.name : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-admin-sm px-2.5 py-1.5 text-[13px] transition-colors',
        mini && 'h-10 justify-center px-0',
        active
          ? 'bg-admin-rail-active font-semibold text-admin-accent-ink'
          : 'font-medium text-admin-rail-ink hover:bg-admin-rail-hover hover:text-admin-ink',
      )}
    >
      {active && !mini ? (
        <span className="nav-indicator absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-admin-accent" />
      ) : null}
      <span className="relative shrink-0">
        <Icon
          className={cn(
            'h-4 w-4',
            active ? 'text-admin-accent' : 'text-admin-rail-muted group-hover:text-admin-secondary',
          )}
        />
        {mini && badge ? (
          <span
            className={cn(
              'absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
              badge.tone === 'danger' ? 'bg-admin-danger' : 'bg-admin-warn',
            )}
          />
        ) : null}
      </span>
      {!mini ? (
        <>
          <span className="flex-1 truncate">{item.name}</span>
          {badge ? <NavBadge badge={badge} /> : null}
        </>
      ) : null}
    </Link>
  );
}

function groupAsItem(group: AdminNavGroup): AdminNavItem {
  return {
    name: group.name,
    href: group.href!,
    icon: group.icon,
    match: group.match,
    exclude: group.exclude,
    badgeKey: group.badgeKey === 'alerts' ? undefined : group.badgeKey,
  };
}

/** Full-width rail: leaves render as links, groups as collapsible small-caps sections. */
function NavSections({
  groups,
  pathname,
  attentionCount,
  anomalyCount,
  onNavigate,
}: {
  groups: AdminNavGroup[];
  pathname: string | null;
  attentionCount: number;
  anomalyCount: number;
  onNavigate?: () => void;
}) {
  const [manual, setManual] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setManual(readSideNavSections());
  }, []);

  const toggle = (id: string, currentlyOpen: boolean) => {
    setManual((prev) => {
      const next = { ...prev, [id]: !currentlyOpen };
      writeSideNavSections(next);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-0.5">
      {groups.map((group) => {
        const children = group.items ?? [];
        if (children.length === 0 && group.href) {
          return (
            <NavItemLink
              key={group.id}
              item={groupAsItem(group)}
              pathname={pathname}
              attentionCount={attentionCount}
              anomalyCount={anomalyCount}
              onNavigate={onNavigate}
            />
          );
        }

        const active = isNavGroupActive(pathname, group);
        const open = manual[group.id] ?? active;
        const badge = navGroupBadge(group, attentionCount, anomalyCount);

        return (
          <div key={group.id} className="mt-3 first:mt-0">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(group.id, open)}
              className="group flex w-full items-center gap-2 rounded-admin-sm px-2.5 py-1 text-left"
            >
              <span
                className={cn(
                  'flex-1 truncate text-[10.5px] font-semibold uppercase tracking-[0.14em]',
                  active ? 'text-admin-accent-ink' : 'text-admin-rail-muted group-hover:text-admin-secondary',
                )}
              >
                {group.name}
              </span>
              {badge && !open ? <NavBadge badge={badge} /> : null}
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-admin-rail-muted transition-transform',
                  !open && '-rotate-90',
                )}
              />
            </button>
            {open ? (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {children.map((item) => (
                  <NavItemLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    attentionCount={attentionCount}
                    anomalyCount={anomalyCount}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Icon-only rail: groups open a flyout with their links. */
function MiniNav({
  groups,
  pathname,
  attentionCount,
  anomalyCount,
}: {
  groups: AdminNavGroup[];
  pathname: string | null;
  attentionCount: number;
  anomalyCount: number;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-admin-nav-group]')) setOpenGroup(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => {
        const Icon = group.icon;
        const children = group.items ?? [];
        if (children.length === 0 && group.href) {
          return (
            <NavItemLink
              key={group.id}
              item={groupAsItem(group)}
              pathname={pathname}
              attentionCount={attentionCount}
              anomalyCount={anomalyCount}
              mini
            />
          );
        }
        const active = isNavGroupActive(pathname, group);
        const badge = navGroupBadge(group, attentionCount, anomalyCount);
        const open = openGroup === group.id;
        return (
          <div key={group.id} data-admin-nav-group className="relative">
            <button
              type="button"
              title={group.name}
              aria-expanded={open}
              onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
              className={cn(
                'group relative flex h-10 w-full items-center justify-center rounded-admin-sm transition-colors',
                active || open ? 'bg-admin-rail-active' : 'hover:bg-admin-rail-hover',
              )}
            >
              <span className="relative">
                <Icon
                  className={cn(
                    'h-4 w-4',
                    active ? 'text-admin-accent' : 'text-admin-rail-muted group-hover:text-admin-secondary',
                  )}
                />
                {badge ? (
                  <span
                    className={cn(
                      'absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                      badge.tone === 'danger' ? 'bg-admin-danger' : 'bg-admin-warn',
                    )}
                  />
                ) : null}
              </span>
            </button>
            {open ? (
              <div
                className={cn(
                  'absolute left-[calc(100%+0.6rem)] z-50 w-60 rounded-admin border border-admin-border bg-white p-1.5 shadow-xl',
                  group.flyoutAlign === 'end' ? 'bottom-0 top-auto' : 'top-0',
                )}
              >
                <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-admin-rail-muted">
                  {group.name}
                </p>
                {children.map((item) => (
                  <NavItemLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    attentionCount={attentionCount}
                    anomalyCount={anomalyCount}
                    onNavigate={() => setOpenGroup(null)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TopSearch() {
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
    <form onSubmit={submit} className="relative hidden min-w-0 flex-1 md:block md:max-w-lg">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search org, email, candidate id…"
        className="w-full rounded-full border border-admin-border bg-admin-bg py-2 pl-9 pr-16 text-sm text-admin-ink placeholder:text-admin-muted focus:border-admin-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-admin-accent/15"
      />
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT))}
        title="Search everything (⌘K)"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-admin-border bg-white px-1.5 py-0.5 text-[11px] font-medium text-admin-muted shadow-sm hover:text-admin-ink"
      >
        ⌘K
      </button>
    </form>
  );
}

function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

function UserMenu({ name, email }: { name: string; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-admin-secondary transition-colors hover:bg-admin-rail-hover"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-admin-accent text-[11px] font-semibold text-white">
          {name ? initials(name) : ''}
        </span>
        <span className="hidden max-w-[140px] truncate font-medium sm:inline">{name || '…'}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-admin-muted sm:block" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-admin border border-admin-border bg-white shadow-xl">
          <div className="border-b border-admin-border bg-admin-bg/60 px-3.5 py-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-admin-muted">Signed in</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-admin-ink">{name || '…'}</p>
            {email && email !== name ? <p className="truncate text-xs text-admin-muted">{email}</p> : null}
          </div>
          <div className="p-1">
            <a
              href="/api/auth/sign-out"
              className="flex items-center rounded-admin-sm px-2.5 py-2 text-sm font-medium text-admin-danger hover:bg-admin-danger-soft"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Empty until the role query resolves — showing "Admin" and then swapping
  // to the real name reads as a glitch.
  const [adminDisplayName, setAdminDisplayName] = useState('');
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
  const { data: who, isLoading: whoLoading } = trpc.blogAdmin.whoAmI.useQuery(undefined, { retry: false });
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
  // Until we know the caller's role, render no nav at all. Rendering the full
  // admin rail first and swapping to the publisher rail a beat later is the
  // "flashing nav" bug — and for publishers, mounting an admin page fires
  // platformAdmin queries whose FORBIDDEN response bounces the browser
  // through session refresh in a loop.
  const navGroups = whoLoading ? [] : isPublisher ? PUBLISHER_NAV_GROUPS : ADMIN_NAV_GROUPS;
  const publisherOffLimits = isPublisher && !!pathname && !pathname.startsWith('/blog');
  const adminEmail = (isPublisher ? who?.email : me?.email) ?? null;

  const rail = useMemo(
    () =>
      railCollapsed ? (
        <MiniNav
          groups={navGroups}
          pathname={pathname}
          attentionCount={attentionCount}
          anomalyCount={anomalyCount}
        />
      ) : (
        <NavSections
          groups={navGroups}
          pathname={pathname}
          attentionCount={attentionCount}
          anomalyCount={anomalyCount}
        />
      ),
    [navGroups, pathname, attentionCount, anomalyCount, railCollapsed],
  );

  const mobileRail = useMemo(
    () => (
      <NavSections
        groups={navGroups}
        pathname={pathname}
        attentionCount={attentionCount}
        anomalyCount={anomalyCount}
        onNavigate={() => setDrawerOpen(false)}
      />
    ),
    [navGroups, pathname, attentionCount, anomalyCount],
  );

  return (
    <div className="min-h-screen bg-admin-bg">
      <div className="flex min-h-screen">
        {/* Desktop rail */}
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-admin-border bg-admin-rail transition-[width] duration-150 lg:flex',
            railCollapsed ? 'z-30 w-[68px] overflow-visible' : 'w-64',
          )}
        >
          <div className={cn('flex h-16 items-center gap-2', railCollapsed ? 'justify-center px-0' : 'px-5')}>
            <Link href="/" className="flex min-w-0 items-center gap-2" title="InsightHire">
              {railCollapsed ? (
                <Image
                  src="/brand/insighthire-mark-circle.png"
                  alt="InsightHire"
                  width={512}
                  height={512}
                  className="h-8 w-8 shrink-0 rounded-full"
                  priority
                />
              ) : (
                <>
                  <Image
                    src="/brand/insighthire-logo-light.png"
                    alt="InsightHire"
                    width={1834}
                    height={360}
                    className="h-6 w-auto object-contain object-left"
                    priority
                  />
                  <span className="rounded-full border border-admin-accent-border bg-admin-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-admin-accent-ink">
                    Admin
                  </span>
                </>
              )}
            </Link>
          </div>
          <nav
            aria-label="Admin"
            className={cn(
              'min-h-0 flex-1 py-3',
              railCollapsed ? 'overflow-visible px-2.5' : 'overflow-y-auto overflow-x-hidden px-3',
            )}
          >
            {rail}
          </nav>
          <div className="border-t border-admin-border p-2.5">
            <button
              type="button"
              onClick={toggleRailCollapsed}
              title={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-admin-sm px-2.5 py-2 text-[13px] font-medium text-admin-muted transition-colors hover:bg-admin-rail-hover hover:text-admin-ink',
                railCollapsed && 'justify-center px-0',
              )}
            >
              {railCollapsed ? (
                <PanelLeft className="h-4 w-4 shrink-0" />
              ) : (
                <PanelLeftClose className="h-4 w-4 shrink-0" />
              )}
              {!railCollapsed ? <span>Collapse</span> : null}
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-admin-border bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-admin-border px-4">
                <Image
                  src="/brand/insighthire-logo-light.png"
                  alt="InsightHire"
                  width={1834}
                  height={360}
                  className="h-5 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="rounded-admin-sm p-1.5 text-admin-muted hover:bg-admin-rail-hover hover:text-admin-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
                {mobileRail}
              </nav>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-admin-border bg-white/85 px-3 backdrop-blur-md sm:px-6">
            <button
              type="button"
              className="rounded-admin-sm p-2 text-admin-secondary hover:bg-admin-rail-hover lg:hidden"
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
            </Link>
            <TopSearch />
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT))}
                aria-label="Search"
                className="rounded-admin-sm p-2 text-admin-secondary hover:bg-admin-rail-hover md:hidden"
              >
                <Search className="h-5 w-5" />
              </button>
              {attentionCount > 0 ? (
                <Link
                  href="/attention"
                  className="hidden items-center gap-2 rounded-full border border-admin-danger/20 bg-admin-danger-soft px-3 py-1.5 text-xs font-semibold text-admin-danger transition-colors hover:border-admin-danger/40 sm:inline-flex"
                >
                  <span className="severity-pulse inline-block h-2 w-2 rounded-full bg-admin-danger" />
                  {attentionCount} need action
                </Link>
              ) : null}
              <span className="mx-1 hidden h-6 w-px bg-admin-border sm:block" />
              <UserMenu name={adminDisplayName} email={adminEmail} />
            </div>
          </header>
          <main className="flex-1">
            {whoLoading || publisherOffLimits ? (
              <div className="flex items-center justify-center py-24 text-sm text-admin-muted">
                Loading…
              </div>
            ) : (
              <>
                {isPublisher ? null : <AlertBanner />}
                {children}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
