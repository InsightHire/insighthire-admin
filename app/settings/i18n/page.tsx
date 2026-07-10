'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';

const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  ja: 'Japanese (日本語)',
};

export default function PlatformI18nSettingsPage() {
  const { data, isLoading, refetch } = trpc.i18n.getPlatformConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [candidateExperienceEnabled, setCandidateExperienceEnabled] = useState(true);
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [enabledLocales, setEnabledLocales] = useState<string[]>(['en']);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data?.config) return;
    setCandidateExperienceEnabled(data.config.candidateExperienceEnabled);
    setDefaultLocale(data.config.defaultLocale);
    setEnabledLocales([...data.config.enabledLocales]);
  }, [data?.config]);

  const updateMutation = trpc.i18n.updatePlatformConfig.useMutation({
    onSuccess: () => {
      void refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const toggleLocale = (code: string) => {
    setEnabledLocales((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next.length > 0 ? next : prev;
      }
      return [...prev, code];
    });
  };

  const handleSave = () => {
    const locales = enabledLocales.length > 0 ? enabledLocales : ['en'];
    const defaultLoc = locales.includes(defaultLocale) ? defaultLocale : locales[0];
    updateMutation.mutate({
      candidateExperienceEnabled,
      defaultLocale: defaultLoc as 'en' | 'es' | 'fr' | 'de' | 'ja',
      enabledLocales: locales as Array<'en' | 'es' | 'fr' | 'de' | 'ja'>,
    });
  };

  const catalog =
    data?.catalog ??
    Object.keys(LOCALE_LABELS).map((code) => ({
      code,
      label: LOCALE_LABELS[code],
      enabled: enabledLocales.includes(code),
    }));

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Platform"
          title="Languages"
          description="Platform-wide controls for candidate and recruiter web translations. Admin UI stays English-only."
        />

        {isLoading ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <div className="admin-panel space-y-6 p-6">
            <label className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-4 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={candidateExperienceEnabled}
                onChange={(e) => setCandidateExperienceEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
              />
              <div>
                <span className="text-sm font-semibold text-admin-ink">
                  Candidate experience translations
                </span>
                <p className="mt-1 text-xs text-admin-muted">
                  Master switch. When off, all surfaces fall back to English regardless of org
                  settings.
                </p>
              </div>
            </label>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-admin-ink">Platform-enabled locales</h2>
              <p className="mb-3 text-xs text-admin-muted">
                Orgs can only enable languages from this list. At least one must stay on.
              </p>
              <div className="space-y-2">
                {catalog.map((item) => (
                  <label
                    key={item.code}
                    className="flex cursor-pointer items-center gap-3 rounded-admin-sm border border-admin-border px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={enabledLocales.includes(item.code)}
                      onChange={() => toggleLocale(item.code)}
                      className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                    />
                    <span className="text-sm text-admin-ink">
                      {LOCALE_LABELS[item.code] ?? item.code}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-admin-ink">
                Platform default locale
              </label>
              <select
                value={enabledLocales.includes(defaultLocale) ? defaultLocale : enabledLocales[0]}
                onChange={(e) => setDefaultLocale(e.target.value)}
                className="mt-1 block w-full max-w-xs rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              >
                {enabledLocales.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_LABELS[code] ?? code}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-admin-muted">
                Used when org and user have no language preference.
              </p>
            </div>

            <div className="flex items-center gap-3 border-t border-admin-border pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="inline-flex items-center rounded-admin-sm bg-admin-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save platform settings'}
              </button>
              {saved && <span className="text-sm text-admin-ok">Saved</span>}
              {updateMutation.error && (
                <span className="text-sm text-admin-danger">{updateMutation.error.message}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
