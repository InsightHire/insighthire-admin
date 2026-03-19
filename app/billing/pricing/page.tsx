'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Check, X } from 'lucide-react';

export default function BillingPricingPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.push('/login');
    else setIsAuthed(true);
  }, [router]);

  const { data: plans, isLoading } = trpc.platformAdmin.getBillingPlans.useQuery(
    undefined,
    { enabled: isAuthed }
  );

  if (!isAuthed) return null;

  const planFeatures: Record<string, { included: string[]; excluded: string[] }> = {
    STARTER: {
      included: [
        'Up to 50 candidates/month',
        'Basic video assessments',
        'Standard question bank',
        'Email support',
        'Basic analytics',
      ],
      excluded: ['Advanced AI analysis', 'Custom scoring', 'ATS integrations', 'White-label'],
    },
    PROFESSIONAL: {
      included: [
        'Up to 200 candidates/month',
        'Advanced AI analysis',
        'Custom scoring matrices',
        'Phone + chat support',
        'Advanced analytics',
        'Basic integrations',
        'Bias reduction tools',
      ],
      excluded: ['White-label options', 'Custom AI models'],
    },
    ENTERPRISE: {
      included: [
        'Unlimited candidates',
        'Custom AI models',
        'White-label options',
        'Dedicated success manager',
        'Full integration suite',
        'Custom reporting',
        'SOC 2 compliance',
        'Priority support',
      ],
      excluded: [],
    },
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Pricing plans</h2>
        <p className="text-gray-500 mt-1">Plans from the homepage. Stripe price IDs configured via env.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans?.map((plan, idx) => {
            const features = planFeatures[plan.id] || { included: [], excluded: [] };
            const isPopular = plan.id === 'PROFESSIONAL';
            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 ${
                  isPopular
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {isPopular && (
                  <span className="inline-block px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-full mb-4">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                {plan.candidatesLimit > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {plan.candidatesLimit} candidates/month
                  </p>
                )}
                {plan.candidatesLimit === -1 && (
                  <p className="text-sm text-gray-500 mt-1">Unlimited candidates</p>
                )}
                {plan.priceId && (
                  <p className="text-xs text-gray-400 mt-2 font-mono truncate" title={plan.priceId}>
                    Price ID: {plan.priceId.slice(0, 20)}…
                  </p>
                )}
                {!plan.priceId && (
                  <p className="text-xs text-amber-600 mt-2">Price ID not configured</p>
                )}
                <div className="mt-6 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Included
                    </h4>
                    <ul className="space-y-2">
                      {features.included.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {features.excluded.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Not included
                      </h4>
                      <ul className="space-y-2">
                        {features.excluded.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                            <X className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> Stripe price IDs are set via environment variables (
          <code className="text-xs bg-gray-200 px-1 rounded">STRIPE_PRICE_STARTER_MONTHLY</code>,{' '}
          <code className="text-xs bg-gray-200 px-1 rounded">STRIPE_PRICE_PROFESSIONAL_MONTHLY</code>,{' '}
          <code className="text-xs bg-gray-200 px-1 rounded">STRIPE_PRICE_ENTERPRISE_MONTHLY</code>).
        </p>
      </div>
    </div>
  );
}
