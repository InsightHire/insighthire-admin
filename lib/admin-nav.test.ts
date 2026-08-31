import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_GROUPS,
  PUBLISHER_NAV_GROUPS,
  flattenNavItems,
  isNavGroupActive,
  isNavItemActive,
  navGroupBadge,
  navItemBadge,
} from './admin-nav';

const PREVIOUS_HREFS = [
  '/',
  '/attention',
  '/organizations',
  '/templates',
  '/blog',
  '/pipeline',
  '/reliability',
  '/email-monitoring',
  '/anomalies',
  '/billing',
  '/audit',
  '/integrations',
  '/settings/admins',
  '/settings/i18n',
  '/settings/marketing',
  '/admin/personas/heygen-catalog',
  '/gdpr',
  '/devops/skills',
].sort();

describe('admin nav grouping', () => {
  it('keeps every previous destination behind a short top-level list', () => {
    const hrefs = flattenNavItems(ADMIN_NAV_GROUPS)
      .map((item) => item.href)
      .sort();
    expect(hrefs).toEqual(PREVIOUS_HREFS);
    expect(ADMIN_NAV_GROUPS).toHaveLength(7);
    expect(ADMIN_NAV_GROUPS.map((group) => group.id)).toEqual([
      'home',
      'attention',
      'tenants',
      'content',
      'operations',
      'billing',
      'system',
    ]);
  });

  it('scopes publisher nav to blog only', () => {
    expect(flattenNavItems(PUBLISHER_NAV_GROUPS).map((item) => item.href)).toEqual(['/blog']);
    expect(PUBLISHER_NAV_GROUPS.every((group) => !group.items?.length)).toBe(true);
  });
});

describe('isNavItemActive', () => {
  it('treats home as an exact match', () => {
    expect(isNavItemActive('/', { name: 'Home', href: '/', icon: ADMIN_NAV_GROUPS[0].icon })).toBe(true);
    expect(isNavItemActive('/blog', { name: 'Home', href: '/', icon: ADMIN_NAV_GROUPS[0].icon })).toBe(false);
  });

  it('matches prefixes and excludes more specific siblings', () => {
    const reliability = flattenNavItems(ADMIN_NAV_GROUPS).find((item) => item.href === '/reliability');
    expect(reliability).toBeTruthy();
    expect(isNavItemActive('/devops', reliability!)).toBe(true);
    expect(isNavItemActive('/devops/skills', reliability!)).toBe(false);
    expect(isNavItemActive('/e2e-results/run-1', reliability!)).toBe(true);
  });
});

describe('isNavGroupActive', () => {
  it('marks a group active when a child route matches', () => {
    const tenants = ADMIN_NAV_GROUPS.find((group) => group.id === 'tenants')!;
    expect(isNavGroupActive('/organizations/abc', tenants)).toBe(true);
    expect(isNavGroupActive('/settings/admins', tenants)).toBe(true);
    expect(isNavGroupActive('/blog', tenants)).toBe(false);
  });

  it('does not mark Operations active for DevOps skills', () => {
    const operations = ADMIN_NAV_GROUPS.find((group) => group.id === 'operations')!;
    const system = ADMIN_NAV_GROUPS.find((group) => group.id === 'system')!;
    expect(isNavGroupActive('/devops/skills', operations)).toBe(false);
    expect(isNavGroupActive('/devops/skills', system)).toBe(true);
  });
});

describe('nav badges', () => {
  it('combines attention and anomaly counts on the Attention group', () => {
    const attention = ADMIN_NAV_GROUPS.find((group) => group.id === 'attention')!;
    expect(navGroupBadge(attention, 2, 3)).toEqual({ count: 5, tone: 'danger' });
    expect(navGroupBadge(attention, 0, 4)).toEqual({ count: 4, tone: 'warn' });
    expect(navGroupBadge(attention, 0, 0)).toBeNull();
  });

  it('keeps per-item badge tones', () => {
    expect(navItemBadge({ badgeKey: 'attention' }, 9, 1)).toEqual({ count: 9, tone: 'danger' });
    expect(navItemBadge({ badgeKey: 'anomalies' }, 9, 1)).toEqual({ count: 1, tone: 'warn' });
    expect(navItemBadge({ badgeKey: 'attention' }, 0, 1)).toBeNull();
  });
});
