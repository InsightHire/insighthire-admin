'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeft } from 'lucide-react';

const PLAN_DEFAULT_MONTHLY: Record<string, number> = {
  STARTER: 99900,
  PROFESSIONAL: 245000,
  ENTERPRISE: 0,
  ENTERPRISE_PLUS: 0,
};

export default function NewTenantQuotePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();

  const { data: catalog } = trpc.platformAdmin.getTenantQuoteCatalog.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
  });
  const { data: pipeline } = trpc.platformAdmin.getSalesPipeline.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
  });

  const [companyName, setCompanyName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('');
  const [plan, setPlan] = useState('PROFESSIONAL');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [amountDollars, setAmountDollars] = useState('2450');
  const [termsNotes, setTermsNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [sfOpportunityId, setSfOpportunityId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = trpc.platformAdmin.createTenantQuote.useMutation({
    onSuccess: (res) => router.push(`/sales/quotes/${res.id}`),
    onError: (err) => setFormError(err.message),
  });

  const featureGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof catalog>['features']>();
    for (const f of catalog?.features ?? []) {
      const list = groups.get(f.category) ?? [];
      list.push(f);
      groups.set(f.category, list);
    }
    return Array.from(groups.entries());
  }, [catalog]);

  const opportunities = pipeline?.connected ? (pipeline.opportunities ?? []) : [];

  function applyOpportunity(oppId: string) {
    setSfOpportunityId(oppId);
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp) return;
    if (opp.accountName) setCompanyName(opp.accountName);
    if (opp.amount != null && opp.amount > 0) {
      setAmountDollars(String(Math.round(opp.amount)));
      setBillingInterval('year');
    }
  }

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const cents = Math.round(Number(amountDollars || '0') * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    createMutation.mutate({
      companyName,
      companyDomain: companyDomain || null,
      recipientName,
      recipientEmail,
      recipientTitle: recipientTitle || null,
      plan: plan as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'ENTERPRISE_PLUS',
      billingInterval,
      amountCents: cents,
      currency: 'usd',
      termsNotes: termsNotes || null,
      featureSlugs: Array.from(selectedSlugs),
      validUntil: validUntil ? new Date(`${validUntil}T23:59:59Z`).toISOString() : null,
      sfOpportunityId: sfOpportunityId || null,
    });
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/sales/quotes" className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>

      <form onSubmit={submit} className="space-y-6">
        {opportunities.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Start from Salesforce</h2>
            <p className="text-sm text-gray-500 mb-3">
              Optional — prefill the company and amount from an open Opportunity.
            </p>
            <select
              className={inputClass}
              value={sfOpportunityId}
              onChange={(e) => applyOpportunity(e.target.value)}
            >
              <option value="">Start from scratch</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.name}
                  {opp.accountName ? ` — ${opp.accountName}` : ''}
                  {opp.amount ? ` ($${Math.round(opp.amount).toLocaleString()})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Company & contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company name *</label>
              <input required minLength={2} className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company domain</label>
              <input className={inputClass} value={companyDomain} onChange={(e) => setCompanyDomain(e.target.value)} placeholder="acme.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signer name *</label>
              <input required minLength={2} className={inputClass} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signer email *</label>
              <input required type="email" className={inputClass} value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="jane@acme.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signer title</label>
              <input className={inputClass} value={recipientTitle} onChange={(e) => setRecipientTitle(e.target.value)} placeholder="VP People" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Plan & pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
              <select
                className={inputClass}
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  const def = PLAN_DEFAULT_MONTHLY[e.target.value];
                  if (def > 0 && billingInterval === 'month') setAmountDollars(String(def / 100));
                }}
              >
                {(catalog?.plans ?? []).map((p) => (
                  <option key={p.plan} value={p.plan}>
                    {p.label} ({p.plan})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing interval *</label>
              <select className={inputClass} value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as 'month' | 'year')}>
                <option value="month">Monthly</option>
                <option value="year">Annual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (USD per {billingInterval === 'year' ? 'year' : 'month'}) *
              </label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Use 0 for comped deals activated manually after signature.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote valid until</label>
              <input type="date" className={inputClass} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional terms</label>
            <textarea
              className={`${inputClass} min-h-24`}
              value={termsNotes}
              onChange={(e) => setTermsNotes(e.target.value)}
              placeholder="Net terms, onboarding commitments, ramp schedule…"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Enabled features <span className="text-sm font-normal text-gray-500">({selectedSlugs.size} selected)</span>
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Granted to the tenant automatically on activation. Plan tier still gates Hire-only features.
          </p>
          <div className="space-y-5">
            {featureGroups.map(([category, features]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{category}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {features.map((f) => (
                    <label key={f.slug} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedSlugs.has(f.slug)}
                        onChange={() => toggleSlug(f.slug)}
                      />
                      <span>
                        <span className="font-medium text-gray-900">{f.name}</span>
                        {f.description ? <span className="block text-xs text-gray-500">{f.description}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{formError}</div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create draft quote'}
          </button>
          <span className="text-sm text-gray-500">You review and send it from the next screen.</span>
        </div>
      </form>
    </div>
  );
}
