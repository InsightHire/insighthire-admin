'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';

type LegacyVersion = { id: string; versionLabel: string; status: string; publishedAt: string | Date | null };

/**
 * The journey consent screen is versioned in Licenses & Disclosures. Versions
 * made here before the move stay listed because older consent records cite
 * their labels.
 */
export function ConsentDisclaimerPanel() {
  const { data, isLoading } = trpc.gdpr.listConsentDisclaimerVersions.useQuery(undefined, { refetchOnWindowFocus: false });
  const versions = ((data as LegacyVersion[] | undefined) ?? []).filter((v) => v.status !== 'DRAFT');

  return (
    <div className="space-y-4">
      <div className="admin-panel p-6">
        <h2 className="text-base font-semibold text-admin-ink">Candidate consent screen</h2>
        <p className="mt-1 text-sm text-admin-muted">
          The consent screen candidates see before a journey (data, video and audio recording, AI analysis, third parties) is now edited
          and versioned in Licenses &amp; Disclosures. Each consent record stores the version the candidate agreed to.
        </p>
        <Link
          href="/legal/candidate-consent"
          className="mt-4 inline-flex items-center rounded-admin-sm bg-admin-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open Journey consent in Licenses &amp; Disclosures →
        </Link>
      </div>

      <div className="admin-panel p-6">
        <h3 className="text-sm font-semibold text-admin-ink">Earlier versions (read-only)</h3>
        <p className="mt-1 text-xs text-admin-muted">Made in the old editor. Older consent records refer to these labels.</p>
        {isLoading ? (
          <p className="mt-3 text-sm text-admin-muted">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="mt-3 text-sm text-admin-muted">None.</p>
        ) : (
          <ul className="mt-3 divide-y divide-admin-border text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2">
                <span className="font-mono text-admin-ink">{v.versionLabel}</span>
                <span className="text-xs text-admin-muted">
                  {v.status.toLowerCase()}
                  {v.publishedAt ? ` · ${new Date(v.publishedAt).toLocaleDateString()}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
