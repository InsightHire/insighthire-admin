'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import {
  Phone,
  Plug,
  TrendingUp,
  DollarSign,
  Mail,
  FileSignature,
} from 'lucide-react';

const tabs = [
  { href: '/sales', label: 'Overview', icon: DollarSign },
  { href: '/sales/pipeline', label: 'Pipeline', icon: TrendingUp },
  { href: '/sales/quotes', label: 'Quotes', icon: FileSignature },
  { href: '/sales/calls', label: 'Calls', icon: Phone },
  { href: '/sales/outreach', label: 'Outreach', icon: Mail },
  { href: '/sales/connections', label: 'Connections', icon: Plug },
];

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600 mt-1">
            Salesforce pipeline, Gong calls and Engage flows, Dialpad, Apollo sequences.
          </p>
        </div>

        <nav className="border-b border-gray-200 mb-6">
          <div className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                tab.href === '/sales'
                  ? pathname === tab.href
                  : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="min-w-0">{children}</main>
      </div>
    </AuthenticatedLayout>
  );
}
