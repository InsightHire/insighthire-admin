'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';

export default function MarketingAnalyticsSettingsPage() {
  const { data, isLoading, refetch } = trpc.marketingAnalytics.getConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [enabled, setEnabled] = useState(true);
  const [googleAdsId, setGoogleAdsId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data?.config) return;
    setEnabled(data.config.enabled);
    setGoogleAdsId(data.config.googleAdsId ?? '');
  }, [data?.config]);

  const updateMutation = trpc.marketingAnalytics.updateConfig.useMutation({
    onSuccess: () => {
      void refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      enabled,
      googleAdsId: googleAdsId.trim(),
    });
  };

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Platform"
          title="Marketing tags"
          description="Ad tags loaded on the public marketing site (homepage, pricing, contact, etc.). Requires marketing cookie consent on the web."
        />

        {isLoading ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <div className="admin-panel space-y-6 p-6">
            <label className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-4 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
              />
              <div>
                <span className="text-sm font-semibold text-admin-ink">Enable marketing tags</span>
                <p className="mt-1 text-xs text-admin-muted">
                  Master switch. When off, no Google Ads (or other) tags load on marketing pages.
                </p>
              </div>
            </label>

            <div>
              <label className="mb-1 block text-sm font-semibold text-admin-ink">
                Google Ads tag ID
              </label>
              <input
                type="text"
                value={googleAdsId}
                onChange={(e) => setGoogleAdsId(e.target.value)}
                placeholder="AW-18384455410"
                spellCheck={false}
                className="mt-1 block w-full max-w-md rounded-admin-sm border border-admin-border bg-white px-3 py-2 font-mono text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              />
              <p className="mt-1 text-xs text-admin-muted">
                From Google Ads → Tools → Google tag. Format{' '}
                <code className="rounded bg-slate-100 px-1">AW-…</code>. Leave blank to disable
                Google only.
              </p>
            </div>

            <div className="rounded-admin-sm border border-dashed border-admin-border bg-slate-50 p-4 text-xs text-admin-muted">
              <p className="font-semibold text-admin-ink">Where this loads</p>
              <p className="mt-1">
                Marketing routes on www.insighthire.com (not dashboard, candidate journeys, or
                careers tenants). Visitors must accept marketing cookies first.
              </p>
            </div>

            {updateMutation.error ? (
              <p className="text-sm text-red-600">
                {(updateMutation.error as { message?: string }).message ?? 'Save failed'}
              </p>
            ) : null}

            <div className="flex items-center gap-3 border-t border-admin-border pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="inline-flex items-center rounded-admin-sm bg-admin-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              {saved ? (
                <span className="text-sm font-medium text-emerald-600">Saved</span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
