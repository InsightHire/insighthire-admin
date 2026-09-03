'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import {
  Phone,
  Plug,
  TrendingUp,
  DollarSign,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/sales', label: 'Overview', icon: DollarSign },
  { href: '/sales/pipeline', label: 'Pipeline', icon: TrendingUp },
  { href: '/sales/calls', label: 'Calls', icon: Phone },
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600 mt-1">
            Salesforce pipeline with Gong calls. Apollo and Sales Nav are next.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 shrink-0">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/sales' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <ChevronRight className={`h-4 w-4 ml-auto ${isActive ? 'text-indigo-500' : 'text-gray-400'}`} />
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
