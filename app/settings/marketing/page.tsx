'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Tag } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { buttonClass, checkboxClass, inputClass } from '@/components/admin/controls';

export default function MarketingAnalyticsSettingsPage() {
  const { data, isLoading, refetch } = trpc.marketingAnalytics.getConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [enabled, setEnabled] = useState(true);
  const [googleAdsId, setGoogleAdsId] = useState('');
  const [xPixelId, setXPixelId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data?.config) return;
    setEnabled(data.config.enabled);
    setGoogleAdsId(data.config.googleAdsId ?? '');
    setXPixelId(data.config.xPixelId ?? '');
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
      xPixelId: xPixelId.trim(),
    });
  };

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<Megaphone />}
        breadcrumbs={[{ label: 'Platform' }, { label: 'Marketing tags' }]}
        title="Marketing tags"
        description="Ad tags loaded on the public marketing site (homepage, pricing, contact, etc.). Requires marketing cookie consent on the web."
      >
        {isLoading ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <SectionCard
            icon={<Tag />}
            title="Tag settings"
            description="Applies to www.insighthire.com marketing routes"
            actions={
              data?.config ? (
                <StatusPill tone={data.config.enabled ? 'success' : 'neutral'}>{data.config.enabled ? 'On' : 'Off'}</StatusPill>
              ) : null
            }
            bodyClassName="space-y-6"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-4 hover:bg-admin-bg/70">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className={`${checkboxClass} mt-1`}
              />
              <div>
                <span className="text-sm font-semibold text-admin-ink">Enable marketing tags</span>
                <p className="mt-1 text-xs text-admin-muted">
                  Master switch. When off, no Google Ads, X (or other) tags load on marketing pages.
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
                className={`${inputClass} mt-1 max-w-md font-mono`}
              />
              <p className="mt-1 text-xs text-admin-muted">
                From Google Ads → Tools → Google tag. Format{' '}
                <code className="admin-mono rounded bg-admin-bg px-1">AW-…</code>. Leave blank to disable
                Google only.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-admin-ink">
                X pixel ID
              </label>
              <input
                type="text"
                value={xPixelId}
                onChange={(e) => setXPixelId(e.target.value)}
                placeholder="rhek7"
                spellCheck={false}
                className={`${inputClass} mt-1 max-w-md font-mono`}
              />
              <p className="mt-1 text-xs text-admin-muted">
                From X Ads → Tools → Events manager. Loads the X conversion tracking base code.
                Leave blank to disable X only.
              </p>
            </div>

            <div className="rounded-admin-sm border border-dashed border-admin-border bg-admin-bg/50 p-4 text-xs text-admin-muted">
              <p className="font-semibold text-admin-ink">Where this loads</p>
              <p className="mt-1">
                Marketing routes on www.insighthire.com (not dashboard, candidate journeys, or
                careers tenants). Visitors must accept marketing cookies first.
              </p>
            </div>

            {updateMutation.error ? (
              <p className="text-sm text-admin-danger">
                {(updateMutation.error as { message?: string }).message ?? 'Save failed'}
              </p>
            ) : null}

            <div className="flex items-center gap-3 border-t border-admin-border pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className={buttonClass.primary}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              {saved ? (
                <StatusPill tone="success">Saved</StatusPill>
              ) : null}
            </div>
          </SectionCard>
        )}
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}
