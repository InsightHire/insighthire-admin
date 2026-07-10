'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
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

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
          <p className="text-gray-500 mt-1">
            Email ops console — durable outbound/inbound archive, digest queue, and provider debug
          </p>
        </div>
        <nav className="border-b border-gray-200 mb-6">
          <div className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive =
                tab.path === '/email-monitoring'
                  ? pathname === tab.path
                  : pathname === tab.path || pathname.startsWith(`${tab.path}/`);
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
        {children}
      </div>
    </AuthenticatedLayout>
  );
}
