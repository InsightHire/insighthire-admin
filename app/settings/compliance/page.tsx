'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';

type StringKey =
  | 'aiDisclosureEmail'
  | 'aiDisclosureSms'
  | 'humanKeyword'
  | 'smsOptInLanguage'
  | 'smsHelpMessage'
  | 'smsOptOutMessage'
  | 'phoneRecordingDisclosure'
  | 'phoneConsentDefault'
  | 'candidateAiNotice';
type BoolKey = 'disclosureOnConcierge' | 'disclosureOnSequences';
type Copy = Record<StringKey, string> & Record<BoolKey, boolean>;

const SECTIONS: Array<{
  title: string;
  description: string;
  fields: Array<{ key: StringKey; label: string; help: string; rows?: number; mono?: boolean }>;
  toggles?: Array<{ key: BoolKey; label: string; help: string }>;
}> = [
  {
    title: 'AI disclosure on outbound messages',
    description:
      'Appended to messages the platform writes on a recruiter’s behalf. {{orgName}} becomes the tenant’s name.',
    fields: [
      { key: 'aiDisclosureEmail', label: 'Email footer', help: 'Added after a blank line at the end of AI-written emails.', rows: 3 },
      { key: 'aiDisclosureSms', label: 'Text message suffix', help: 'Keep it short. Every 160 characters is another SMS segment billed.', rows: 2 },
      { key: 'humanKeyword', label: 'Human keyword', help: 'When a candidate replies with this word the AI stops drafting and the recruiter handles the thread.', mono: true },
    ],
    toggles: [
      { key: 'disclosureOnConcierge', label: 'Disclose on concierge answers', help: 'Role Q&A replies sent by email or text.' },
      { key: 'disclosureOnSequences', label: 'Disclose on sequence emails', help: 'Automated multi-step outreach. Turn off if customers write every step themselves.' },
    ],
  },
  {
    title: 'SMS consent and carrier keywords',
    description:
      'The opt-in language is shown wherever a candidate gives a mobile number. HELP and STOP replies must match the Twilio Messaging Service opt-out settings and the registered 10DLC campaign.',
    fields: [
      { key: 'smsOptInLanguage', label: 'Opt-in language', help: 'Apply forms, careers pages, and the recruiter’s consent quick-record.', rows: 4 },
      { key: 'smsHelpMessage', label: 'HELP reply', help: 'Carrier-required. Include who is texting and how to get support.', rows: 3 },
      { key: 'smsOptOutMessage', label: 'STOP reply', help: 'Carrier-required. Confirm the unsubscribe and how to resubscribe.', rows: 3 },
    ],
  },
  {
    title: 'Phone screens',
    description: 'Spoken by the AI phone screener and pre-filled when a recruiter records consent.',
    fields: [
      { key: 'phoneRecordingDisclosure', label: 'Recording disclosure (spoken)', help: 'Said in the intro, right before “Is now still a good time?”', rows: 3 },
      { key: 'phoneConsentDefault', label: 'Default consent note', help: 'Pre-filled in the schedule form. Recruiters can edit it before saving.', rows: 3 },
    ],
  },
  {
    title: 'Candidate-facing AI notice',
    description: 'Shown under the “Ask about this role” assistant on careers pages.',
    fields: [{ key: 'candidateAiNotice', label: 'Notice', help: 'Plain language. One or two sentences.', rows: 3 }],
  },
];

export default function ComplianceCopySettingsPage() {
  const { data, isLoading, refetch } = trpc.complianceCopy.getConfig.useQuery(undefined, { refetchOnWindowFocus: false });
  const [copy, setCopy] = useState<Copy | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.config) setCopy(data.config as Copy);
  }, [data?.config]);

  const updateMutation = trpc.complianceCopy.updateConfig.useMutation({
    onSuccess: () => {
      void refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const set = (key: StringKey, value: string) => setCopy((c) => (c ? { ...c, [key]: value } : c));
  const toggle = (key: BoolKey, value: boolean) => setCopy((c) => (c ? { ...c, [key]: value } : c));

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Platform"
          title="Compliance copy"
          description="AI disclosures, SMS consent text, and phone-screen disclosures used across every tenant. Changes take effect within a minute."
        />

        {isLoading || !copy ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <div className="space-y-6">
            {SECTIONS.map((section) => (
              <section key={section.title} className="admin-panel space-y-5 p-6">
                <div>
                  <h2 className="text-base font-semibold text-admin-ink">{section.title}</h2>
                  <p className="mt-1 text-xs text-admin-muted">{section.description}</p>
                </div>
                {section.toggles?.map((t) => (
                  <label key={t.key} className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={copy[t.key]}
                      onChange={(e) => toggle(t.key, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                    />
                    <div>
                      <span className="text-sm font-semibold text-admin-ink">{t.label}</span>
                      <p className="mt-0.5 text-xs text-admin-muted">{t.help}</p>
                    </div>
                  </label>
                ))}
                {section.fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-sm font-semibold text-admin-ink">{f.label}</label>
                    {f.rows ? (
                      <textarea
                        value={copy[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        rows={f.rows}
                        maxLength={1000}
                        className="mt-1 block w-full rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
                      />
                    ) : (
                      <input
                        type="text"
                        value={copy[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        maxLength={32}
                        spellCheck={false}
                        className={`mt-1 block w-full max-w-xs rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent ${f.mono ? 'font-mono' : ''}`}
                      />
                    )}
                    <div className="mt-1 flex items-start justify-between gap-3 text-xs text-admin-muted">
                      <p>{f.help}</p>
                      {data?.defaults && data.defaults[f.key] !== copy[f.key] ? (
                        <button type="button" onClick={() => set(f.key, data.defaults[f.key])} className="shrink-0 underline hover:text-admin-ink">
                          Reset to default
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </section>
            ))}

            {updateMutation.error ? (
              <p className="text-sm text-red-600">{(updateMutation.error as { message?: string }).message ?? 'Save failed'}</p>
            ) : null}

            <div className="flex items-center gap-3 border-t border-admin-border pt-4">
              <button
                type="button"
                onClick={() => updateMutation.mutate(copy)}
                disabled={updateMutation.isPending}
                className="inline-flex items-center rounded-admin-sm bg-admin-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              {saved ? <span className="text-sm font-medium text-emerald-600">Saved</span> : null}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
