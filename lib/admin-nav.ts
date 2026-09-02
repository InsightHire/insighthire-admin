import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Building2,
  ClipboardList,
  CreditCard,
  FlaskConical,
  Gauge,
  Globe,
  Home,
  Lock,
  Mail,
  Megaphone,
  Newspaper,
  Puzzle,
  Settings,
  Shield,
  Users,
  Wrench,
} from 'lucide-react';

export type AdminNavBadgeKey = 'attention' | 'anomalies' | 'alerts';

export type AdminNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Match path prefixes for active state */
  match?: string[];
  /** Prefixes that must not count as active (more specific siblings). */
  exclude?: string[];
  badgeKey?: Exclude<AdminNavBadgeKey, 'alerts'>;
};

export type AdminNavGroup = {
  id: string;
  name: string;
  icon: LucideIcon;
  /** Direct destination when this entry is a leaf (no children). */
  href?: string;
  match?: string[];
  exclude?: string[];
  items?: AdminNavItem[];
  badgeKey?: AdminNavBadgeKey;
  /** Mini-rail flyout grows upward so lower groups stay on screen. */
  flyoutAlign?: 'start' | 'end';
};

export type AdminNavBadge = {
  count: number;
  tone: 'danger' | 'warn';
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'home',
    name: 'Home',
    href: '/',
    icon: Home,
    match: ['/'],
  },
  {
    id: 'attention',
    name: 'Attention',
    icon: AlertTriangle,
    badgeKey: 'alerts',
    items: [
      {
        name: 'Attention',
        href: '/attention',
        icon: AlertTriangle,
        match: ['/attention', '/stuck-candidates'],
        badgeKey: 'attention',
      },
      {
        name: 'Anomalies',
        href: '/anomalies',
        icon: Gauge,
        match: ['/anomalies'],
        badgeKey: 'anomalies',
      },
    ],
  },
  {
    id: 'tenants',
    name: 'Tenants',
    icon: Building2,
    items: [
      {
        name: 'Organizations',
        href: '/organizations',
        icon: Building2,
        match: ['/organizations', '/onboarding'],
      },
      {
        name: 'Admins',
        href: '/settings/admins',
        icon: Users,
        match: ['/settings/admins'],
      },
    ],
  },
  {
    id: 'content',
    name: 'Content',
    icon: Newspaper,
    items: [
      {
        name: 'Blog',
        href: '/blog',
        icon: Newspaper,
        match: ['/blog'],
      },
      {
        name: 'Templates',
        href: '/templates',
        icon: ClipboardList,
        match: ['/templates'],
      },
      {
        name: 'Marketing tags',
        href: '/settings/marketing',
        icon: Megaphone,
        match: ['/settings/marketing'],
      },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    icon: Activity,
    items: [
      {
        name: 'Pipeline',
        href: '/pipeline',
        icon: Activity,
        match: ['/pipeline', '/background-jobs', '/scoring', '/api-monitoring', '/jobs'],
      },
      {
        name: 'Reliability',
        href: '/reliability',
        icon: FlaskConical,
        match: ['/reliability', '/e2e-results', '/devops'],
        exclude: ['/devops/skills'],
      },
      {
        name: 'Communications',
        href: '/email-monitoring',
        icon: Mail,
        match: ['/email-monitoring'],
      },
    ],
  },
  {
    id: 'billing',
    name: 'Billing',
    href: '/billing',
    icon: CreditCard,
    match: ['/billing'],
    flyoutAlign: 'end',
  },
  {
    id: 'system',
    name: 'System',
    icon: Settings,
    flyoutAlign: 'end',
    items: [
      { name: 'Integrations', href: '/integrations', icon: Puzzle, match: ['/integrations'] },
      { name: 'Languages', href: '/settings/i18n', icon: Globe, match: ['/settings/i18n'] },
      { name: 'Audit', href: '/audit', icon: Shield, match: ['/audit'] },
      { name: 'GDPR', href: '/gdpr', icon: Lock, match: ['/gdpr'] },
      { name: 'DevOps skills', href: '/devops/skills', icon: Wrench, match: ['/devops/skills'] },
    ],
  },
];

// The platform_publisher role is scoped to blog management only — see
// platformBlogMiddleware in insighthire-api. Publishers get this trimmed rail
// instead of ADMIN_NAV_GROUPS.
export const PUBLISHER_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'blog',
    name: 'Blog',
    href: '/blog',
    icon: Newspaper,
    match: ['/blog'],
  },
];

export function isNavItemActive(pathname: string | null, item: AdminNavItem): boolean {
  if (!pathname) return false;
  if (item.exclude?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (item.href === '/') return pathname === '/';
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isNavGroupActive(pathname: string | null, group: AdminNavGroup): boolean {
  if (group.items?.length) {
    return group.items.some((item) => isNavItemActive(pathname, item));
  }
  if (!group.href) return false;
  return isNavItemActive(pathname, {
    name: group.name,
    href: group.href,
    icon: group.icon,
    match: group.match,
    exclude: group.exclude,
  });
}

export function navItemBadge(
  item: Pick<AdminNavItem, 'badgeKey'>,
  attentionCount: number,
  anomalyCount: number,
): AdminNavBadge | null {
  if (item.badgeKey === 'attention' && attentionCount > 0) {
    return { count: attentionCount, tone: 'danger' };
  }
  if (item.badgeKey === 'anomalies' && anomalyCount > 0) {
    return { count: anomalyCount, tone: 'warn' };
  }
  return null;
}

export function navGroupBadge(
  group: AdminNavGroup,
  attentionCount: number,
  anomalyCount: number,
): AdminNavBadge | null {
  if (group.badgeKey === 'alerts') {
    const count = attentionCount + anomalyCount;
    if (count <= 0) return null;
    return { count, tone: attentionCount > 0 ? 'danger' : 'warn' };
  }
  return navItemBadge(group, attentionCount, anomalyCount);
}

export function flattenNavItems(groups: AdminNavGroup[]): AdminNavItem[] {
  return groups.flatMap((group) => {
    if (group.items?.length) return group.items;
    if (!group.href) return [];
    return [
      {
        name: group.name,
        href: group.href,
        icon: group.icon,
        match: group.match,
        exclude: group.exclude,
        badgeKey: group.badgeKey === 'alerts' ? undefined : group.badgeKey,
      },
    ];
  });
}
