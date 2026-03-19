'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import {
  AlertTriangle,
  ExternalLink,
  Ban,
  Building2,
  CreditCard,
} from 'lucide-react';

export default function BillingCollectionsPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [suspending, setSuspending] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.push('/login');
    else setIsAuthed(true);
  }, [router]);

  const { data, isLoading, refetch } = trpc.platformAdmin.getCollections.useQuery(
    { limit: 50, includeExpiringTrials: true },
    { enabled: isAuthed, refetchInterval: 60000 }
  );

  const suspendMutation = trpc.platformAdmin.suspendForNonPayment.useMutation({
    onSuccess: () => {
      setSuspending(null);
      refetch();
    },
    onError: (e) => {
      setSuspending(null);
      alert('Failed: ' + e.message);
    },
  });

  const handleSuspend = (orgId: string, name: string) => {
    if (!confirm(`Suspend "${name}" for non-payment? This will cancel their subscription and deactivate all users.`))
      return;
    setSuspending(orgId);
    suspendMutation.mutate({ organizationId: orgId, reason: 'Non-payment - admin action' });
  };

  if (!isAuthed) return null;

  const pastDue = data?.organizations?.filter((o) => o.subscriptionStatus === 'PAST_DUE') ?? [];
  const trials = data?.organizations?.filter((o) => o.subscriptionStatus === 'TRIAL') ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
        <p className="text-gray-500 mt-1">
          Past due accounts and expiring trials. Suspend for non-payment when needed.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Past Due */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Past due ({pastDue.length})
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Payment failed or overdue. Consider suspending for non-payment.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {pastDue.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  No past due accounts
                </div>
              ) : (
                pastDue.map((org) => (
                  <div
                    key={org.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-amber-100 rounded-full">
                        <Building2 className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <Link
                          href={`/organizations/${org.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {org.name || org.domain || org.id}
                        </Link>
                        <p className="text-sm text-gray-500">{org.domain}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Plan: {org.subscriptionPlan} • Period end:{' '}
                          {org.stripeCurrentPeriodEnd
                            ? new Date(org.stripeCurrentPeriodEnd).toLocaleDateString()
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {org.stripeCustomerId && (
                        <a
                          href={`https://dashboard.stripe.com/customers/${org.stripeCustomerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600"
                        >
                          Stripe <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleSuspend(org.id, org.name || org.domain || '')}
                        disabled={suspending === org.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />
                        {suspending === org.id ? 'Suspending…' : 'Suspend'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expiring trials */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-500" />
                Trials ({trials.length})
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Organizations in trial. Expires soon listed first.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {trials.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  No trial organizations
                </div>
              ) : (
                trials.map((org) => (
                  <div
                    key={org.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-cyan-100 rounded-full">
                        <Building2 className="h-5 w-5 text-cyan-600" />
                      </div>
                      <div>
                        <Link
                          href={`/organizations/${org.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {org.name || org.domain || org.id}
                        </Link>
                        <p className="text-sm text-gray-500">{org.domain}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Expires:{' '}
                          {org.subscriptionExpiresAt
                            ? new Date(org.subscriptionExpiresAt).toLocaleDateString()
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/organizations/${org.id}`}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      View org
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
