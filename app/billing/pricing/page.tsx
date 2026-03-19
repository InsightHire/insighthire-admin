'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Check, X, Pencil, Save } from 'lucide-react';

type Plan = {
  id: string;
  name: string;
  price: number;
  priceId: string;
  candidatesLimit: number;
  featuresIncluded?: string[];
  featuresExcluded?: string[];
};

export default function BillingPricingPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: '',
    price: 0,
    stripePriceId: '',
    candidatesLimit: 50,
    featuresIncluded: '',
    featuresExcluded: '',
  });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.push('/login');
    else setIsAuthed(true);
  }, [router]);

  const utils = trpc.useUtils();
  const { data: plans, isLoading } = trpc.platformAdmin.getBillingPlans.useQuery(
    undefined,
    { enabled: isAuthed }
  );

  const updateMutation = trpc.platformAdmin.updateBillingPlan.useMutation({
    onSuccess: () => {
      setEditingPlan(null);
      utils.platformAdmin.getBillingPlans.invalidate();
    },
    onError: (e) => alert(e.message),
  });

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      price: plan.price,
      stripePriceId: plan.priceId || '',
      candidatesLimit: plan.candidatesLimit,
      featuresIncluded: (plan.featuresIncluded || []).join('\n'),
      featuresExcluded: (plan.featuresExcluded || []).join('\n'),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    updateMutation.mutate({
      planId: editingPlan.id as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE',
      name: form.name,
      price: form.price,
      stripePriceId: form.stripePriceId || undefined,
      candidatesLimit: form.candidatesLimit,
      featuresIncluded: form.featuresIncluded.split('\n').map((s) => s.trim()).filter(Boolean),
      featuresExcluded: form.featuresExcluded.split('\n').map((s) => s.trim()).filter(Boolean),
    });
  };

  if (!isAuthed) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Pricing plans</h2>
        <p className="text-gray-500 mt-1">
          Manage plan names, prices, Stripe price IDs, candidate limits, and features. Changes apply to new subscriptions.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans?.map((plan) => {
            const featuresIncluded = plan.featuresIncluded ?? [];
            const featuresExcluded = plan.featuresExcluded ?? [];
            const isPopular = plan.id === 'PROFESSIONAL';
            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 relative ${
                  isPopular
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => openEdit(plan)}
                  className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  title="Edit plan"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {isPopular && (
                  <span className="inline-block px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-full mb-4">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900 pr-10">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                {plan.candidatesLimit > 0 && (
                  <p className="text-sm text-gray-500 mt-1">{plan.candidatesLimit} candidates/month</p>
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
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Included</h4>
                    <ul className="space-y-2">
                      {featuresIncluded.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {featuresExcluded.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Not included
                      </h4>
                      <ul className="space-y-2">
                        {featuresExcluded.map((f) => (
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

      {/* Edit modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingPlan(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit plan: {editingPlan.id}</h3>
              <form onSubmit={handleSave} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price ($/month)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Candidates limit</label>
                    <input
                      type="number"
                      min={-1}
                      value={form.candidatesLimit}
                      onChange={(e) => setForm((f) => ({ ...f, candidatesLimit: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Price ID</label>
                  <input
                    type="text"
                    value={form.stripePriceId}
                    onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))}
                    placeholder="price_xxx"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Create the price in Stripe Dashboard, then paste the ID here.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Features included (one per line)</label>
                  <textarea
                    value={form.featuresIncluded}
                    onChange={(e) => setForm((f) => ({ ...f, featuresIncluded: e.target.value }))}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Features excluded (one per line)</label>
                  <textarea
                    value={form.featuresExcluded}
                    onChange={(e) => setForm((f) => ({ ...f, featuresExcluded: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> Stripe Price IDs must be created in the Stripe Dashboard. Paste the <code className="text-xs bg-gray-200 px-1 rounded">price_xxx</code> ID here.
          New subscriptions will use the configured price. Existing subscriptions keep their current Stripe price.
        </p>
      </div>
    </div>
  );
}
