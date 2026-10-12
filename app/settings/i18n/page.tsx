'use client';

import { useEffect, useState } from 'react';
import { Globe, Languages } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { buttonClass, checkboxClass, selectClass } from '@/components/admin/controls';
import { TranslationStatus } from '@/components/platform-admin/translation-status';

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
      <AdminPageChrome
        icon={<Languages />}
        breadcrumbs={[{ label: 'System' }, { label: 'Languages' }]}
        title="Languages"
        description="Which languages each product ships in, how complete they are, and what still needs a professional translator. Admin UI stays English-only."
      >
        <div className="space-y-6">
          <TranslationStatus />

          {isLoading ? (
            <div className="admin-panel max-w-3xl py-16 text-center text-sm text-admin-muted">Loading…</div>
          ) : (
            <SectionCard
              className="max-w-3xl"
              icon={<Globe />}
              title="Hire app platform controls"
              description="Orgs can only narrow what is enabled here"
              actions={
                data?.config ? (
                  <StatusPill tone={data.config.candidateExperienceEnabled ? 'success' : 'neutral'}>
                    {data.config.candidateExperienceEnabled ? 'On' : 'Off'}
                  </StatusPill>
                ) : null
              }
              bodyClassName="space-y-6"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-4 hover:bg-admin-bg/70">
                <input
                  type="checkbox"
                  checked={candidateExperienceEnabled}
                  onChange={(e) => setCandidateExperienceEnabled(e.target.checked)}
                  className={`${checkboxClass} mt-1`}
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
                      className="flex cursor-pointer items-center gap-3 rounded-admin-sm border border-admin-border px-3 py-2 hover:bg-admin-bg/70"
                    >
                      <input
                        type="checkbox"
                        checked={enabledLocales.includes(item.code)}
                        onChange={() => toggleLocale(item.code)}
                        className={checkboxClass}
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
                  className={`${selectClass} mt-1 w-full max-w-xs`}
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
                  className={buttonClass.primary}
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save platform settings'}
                </button>
                {saved && <StatusPill tone="success">Saved</StatusPill>}
                {updateMutation.error && (
                  <span className="text-sm text-admin-danger">{updateMutation.error.message}</span>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}
