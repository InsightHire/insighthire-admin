'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';

type VersionMeta = { version: number; publishedAt: string | null; publishedByEmail: string | null };
type DocRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  usedAt: string | null;
  live: VersionMeta | null;
  draft: VersionMeta | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  CUSTOMER_CONTRACT: 'Customer contract',
  PUBLIC_POLICY: 'Public policy',
  CANDIDATE_DISCLOSURE: 'Candidate disclosure',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function LegalDocumentsPage() {
  const { data, isLoading, error } = (trpc as any).legalDocuments.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const docs = (data?.documents ?? []) as DocRow[];

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Content"
          title="Licenses & disclosures"
          description="The legal text customers and candidates see. Publishing a new version makes it live right away; every earlier version is kept."
        />

        {error ? <p className="mb-4 text-sm text-red-600">{error.message}</p> : null}

        {isLoading ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <div className="admin-panel overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border text-left text-xs uppercase tracking-wide text-admin-muted">
                  <th className="px-4 py-3 font-semibold">Document</th>
                  <th className="px-4 py-3 font-semibold">Live version</th>
                  <th className="px-4 py-3 font-semibold">Last published</th>
                  <th className="px-4 py-3 font-semibold">By</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-admin-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/legal/${d.slug}`} className="font-semibold text-admin-ink hover:underline">
                        {d.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-admin-muted">
                        {CATEGORY_LABEL[d.category] ?? d.category}
                        {d.usedAt ? <> · <span className="font-mono">{d.usedAt}</span></> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {d.live ? (
                        <span className="font-medium text-admin-ink">v{d.live.version}</span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-admin-muted">Not live</span>
                      )}
                      {d.draft ? (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Draft v{d.draft.version}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-admin-muted">{formatDate(d.live?.publishedAt)}</td>
                    <td className="px-4 py-3 text-admin-muted">{d.live?.publishedByEmail ?? '—'}</td>
                  </tr>
                ))}
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-admin-muted">
                      No documents yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
