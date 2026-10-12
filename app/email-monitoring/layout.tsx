'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { cn } from '@/lib/cn';
import { ChartIcon } from './_utils';
import {
  EnvelopeIcon,
  ClockIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline';

const tabs = [
  { path: '/email-monitoring', label: 'Overview', icon: ChartIcon },
  { path: '/email-monitoring/digest', label: 'Digest Queue', icon: ClockIcon },
  { path: '/email-monitoring/sent-emails', label: 'Sent Emails', icon: EnvelopeIcon },
  { path: '/email-monitoring/inbound', label: 'Inbound', icon: InboxArrowDownIcon },
  { path: '/email-monitoring/mailgun', label: 'Mailgun Events', icon: EnvelopeIcon },
];

export default function EmailMonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = tabs.find((tab) =>
    tab.path === '/email-monitoring'
      ? pathname === tab.path
      : pathname === tab.path || pathname.startsWith(`${tab.path}/`),
  );

  return (
    <AuthenticatedLayout>
      <AdminPage>
        <PageHeader
          icon={<Mail />}
          breadcrumbs={[
            { label: 'Operations' },
            { label: 'Communications', href: activeTab && activeTab.path !== '/email-monitoring' ? '/email-monitoring' : undefined },
            ...(activeTab && activeTab.path !== '/email-monitoring' ? [{ label: activeTab.label }] : []),
          ]}
          title="Communications"
          description="Email ops console — durable outbound/inbound archive, digest queue, and provider debug"
        />
        <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-admin-border">
          {tabs.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <Link
                key={tab.path}
                href={tab.path}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'text-admin-accent-ink' : 'text-admin-muted hover:text-admin-ink',
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {isActive ? (
                  <span className="nav-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-admin-accent" />
                ) : null}
              </Link>
            );
          })}
        </nav>
        {children}
      </AdminPage>
    </AuthenticatedLayout>
  );
}
