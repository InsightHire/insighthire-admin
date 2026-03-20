'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { Check, X, Pencil, Save, Sparkles, Users, Loader2 } from 'lucide-react';

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
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    price: 0,
    stripePriceId: '',
    candidatesLimit: 50,
    featuresIncluded: '',
    featuresExcluded: '',
  });

  const queryEnabled = !authLoading && isAuthenticated;
  const utils = trpc.useUtils();

  const { data: plans, isLoading } = trpc.platformAdmin.getBillingPlans.useQuery(undefined, {
    enabled: queryEnabled,
  });

  const updateMutation = trpc.platformAdmin.updateBillingPlan.useMutation({
    onSuccess: () => {
      setEditingPlan(null);
      utils.platformAdmin.getBillingPlans.invalidate();
    },
    onError: (e) => alert(e.message),
  });

  const syncMutation = trpc.platformAdmin.syncStripeCatalogFromDatabase.useMutation({
    onSuccess: (data) => {
      utils.platformAdmin.getBillingPlans.invalidate();
      const created = data.results.filter((r) => r.created).length;
      setActionMessage(
        `Synced Stripe: ${data.results.length} plan(s). ${created ? `${created} new price(s) created.` : 'Reused existing prices where amounts match.'}`
      );
    },
    onError: (e) => setActionMessage(`Error: ${e.message}`),
  });

  const backfillMutation = trpc.platformAdmin.backfillStripeCustomers.useMutation({
    onSuccess: (data) => {
      if (data.dryRun) {
        setActionMessage(`Dry run: would create customers for ${data.wouldProcess} org(s).`);
        return;
      }
      setActionMessage(`Created Stripe customers for ${data.processed} organization(s).`);
    },
    onError: (e) => setActionMessage(`Error: ${e.message}`),
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

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pricing plans</h2>
          <p className="text-gray-500 mt-1 max-w-2xl">
            Catalog amounts live in the database. Use <strong>Sync plans to Stripe</strong> to create matching
            Products and monthly Prices in Stripe and link <code className="text-xs bg-gray-100 px-1 rounded">price_…</code>{' '}
            IDs automatically — then Checkout and webhooks can resolve plan ↔ price.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sync plans to Stripe
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && !window.confirm('Create Stripe customers for every org missing one?')) return;
              backfillMutation.mutate({});
            }}
            disabled={backfillMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {backfillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Backfill customers
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
          {actionMessage}
          <button type="button" className="ml-2 underline font-medium" onClick={() => setActionMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
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
                  <p className="text-xs text-gray-500 mt-2 font-mono break-all" title={plan.priceId}>
                    Stripe price: {plan.priceId}
                  </p>
                )}
                {!plan.priceId && (
                  <p className="text-xs text-amber-700 mt-2 font-medium">Not linked — run &quot;Sync plans to Stripe&quot;</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Price ID (optional override)</label>
                  <input
                    type="text"
                    value={form.stripePriceId}
                    onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))}
                    placeholder="price_xxx"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank to use the ID from &quot;Sync plans to Stripe&quot;, or paste a Dashboard price manually.
                  </p>
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

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
        <p className="text-sm text-gray-700">
          <strong>Stripe Dashboard:</strong> After syncing, open Products in Stripe — you should see <em>InsightHire — Starter / Professional / Enterprise</em> with recurring monthly prices matching the amounts above.
        </p>
        <p className="text-sm text-gray-600">
          WorkOS handles identity; Stripe handles payments. The link between app plan and Stripe is the <strong>Price ID</strong> stored in the database and in webhook events.
        </p>
      </div>
    </div>
  );
}
