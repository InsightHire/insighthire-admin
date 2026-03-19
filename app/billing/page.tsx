'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import {
  DollarSign,
  CreditCard,
  AlertTriangle,
  Users,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function BillingDashboardPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.push('/login');
    else setIsAuthed(true);
  }, [router]);

  const { data, isLoading } = trpc.platformAdmin.getBillingOverview.useQuery(
    undefined,
    { enabled: isAuthed, refetchInterval: 60000 }
  );

  if (!isAuthed) return null;

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">MRR</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : `$${data?.mrr ?? 0}`}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-full">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : data?.activeSubscriptions ?? 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Past Due</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {isLoading ? '...' : data?.pastDueCount ?? 0}
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Trial</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : data?.trialCount ?? 0}
              </p>
            </div>
            <div className="p-3 bg-cyan-100 rounded-full">
              <Users className="h-6 w-6 text-cyan-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Canceled</p>
              <p className="text-2xl font-bold text-gray-500 mt-1">
                {isLoading ? '...' : data?.canceledCount ?? 0}
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <XCircle className="h-6 w-6 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Plan Breakdown */}
      {data?.planBreakdown && Object.keys(data.planBreakdown).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(data.planBreakdown).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">{plan}</span>
                <span className="text-2xl font-bold text-indigo-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/billing/pricing"
          className="p-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-full">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Pricing plans</h3>
              <p className="text-sm text-gray-500">Starter, Professional, Enterprise</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>

        <Link
          href="/billing/collections"
          className="p-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Collections</h3>
              <p className="text-sm text-gray-500">
                {data?.pastDueCount ?? 0} past due
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>

        <Link
          href="/billing/settings"
          className="p-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Settings</h3>
              <p className="text-sm text-gray-500">Stripe, dunning, suspension</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
}
