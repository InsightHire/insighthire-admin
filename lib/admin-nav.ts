import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  FlaskConical,
  Gauge,
  Globe,
  Home,
  Images,
  Lock,
  Mail,
  Puzzle,
  Shield,
  Users,
  Wrench,
} from 'lucide-react';

export type AdminNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Match path prefixes for active state */
  match?: string[];
  badgeKey?: 'attention' | 'anomalies';
};

export type AdminNavSection = {
  id: string;
  label?: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: 'main',
    items: [
      { name: 'Home', href: '/', icon: Home, match: ['/'] },
      {
        name: 'Attention',
        href: '/attention',
        icon: AlertTriangle,
        match: ['/attention', '/stuck-candidates'],
        badgeKey: 'attention',
      },
      {
        name: 'Organizations',
        href: '/organizations',
        icon: Building2,
        match: ['/organizations', '/onboarding'],
      },
    ],
  },
  {
    id: 'ops',
    label: 'Operations',
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
      },
      {
        name: 'Communications',
        href: '/email-monitoring',
        icon: Mail,
        match: ['/email-monitoring'],
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
    id: 'business',
    label: 'Business',
    items: [
      { name: 'Growth', href: '/leads', icon: Mail, match: ['/leads'] },
      { name: 'Billing', href: '/billing', icon: CreditCard, match: ['/billing'] },
      { name: 'Audit', href: '/audit', icon: Shield, match: ['/audit'] },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { name: 'Integrations', href: '/integrations', icon: Puzzle, match: ['/integrations'] },
      { name: 'Admins', href: '/settings/admins', icon: Users, match: ['/settings/admins'] },
      { name: 'Languages', href: '/settings/i18n', icon: Globe, match: ['/settings/i18n'] },
      {
        name: 'HeyGen avatars',
        href: '/admin/personas/heygen-catalog',
        icon: Images,
        match: ['/admin/personas'],
      },
      { name: 'GDPR', href: '/gdpr', icon: Lock, match: ['/gdpr'] },
      { name: 'DevOps skills', href: '/devops/skills', icon: Wrench, match: ['/devops/skills'] },
    ],
  },
];

export function isNavItemActive(pathname: string | null, item: AdminNavItem): boolean {
  if (!pathname) return false;
  if (item.href === '/') return pathname === '/';
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
