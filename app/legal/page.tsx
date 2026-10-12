'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { FileText, Scale } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Td, Th } from '@/components/admin/data-table';

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
  MESSAGING_DISCLOSURE: 'Texts, email and phone disclosure',
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
      <AdminPageChrome
        icon={<Scale />}
        breadcrumbs={[{ label: 'Content' }, { label: 'Licenses & disclosures' }]}
        title="Licenses & disclosures"
        description="The legal text customers and candidates see. Publishing a new version makes it live right away; every earlier version is kept."
      >
        {error ? <p className="mb-4 text-sm text-admin-danger">{error.message}</p> : null}

        {isLoading ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <SectionCard
            padded={false}
            icon={<FileText />}
            title="Documents"
            description="Open a document to edit a draft, publish, or see earlier versions"
          >
            {docs.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<FileText />} title="No documents yet." />
            ) : (
              <div className="overflow-x-auto">
                <DataTableEl>
                  <thead>
                    <tr>
                      <Th>Document</Th>
                      <Th>Live version</Th>
                      <Th>Last published</Th>
                      <Th>By</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id}>
                        <Td>
                          <Link href={`/legal/${d.slug}`} className="font-semibold text-admin-ink hover:text-admin-accent-ink hover:underline">
                            {d.title}
                          </Link>
                          <div className="mt-0.5 text-xs text-admin-muted">
                            {CATEGORY_LABEL[d.category] ?? d.category}
                            {d.usedAt ? <> · <span className="font-mono">{d.usedAt}</span></> : null}
                          </div>
                        </Td>
                        <Td>
                          <span className="flex flex-wrap items-center gap-2">
                            {d.live ? (
                              <StatusPill tone="success">v{d.live.version}</StatusPill>
                            ) : (
                              <StatusPill tone="neutral">Not live</StatusPill>
                            )}
                            {d.draft ? <StatusPill tone="warn">Draft v{d.draft.version}</StatusPill> : null}
                          </span>
                        </Td>
                        <Td className="text-admin-muted">{formatDate(d.live?.publishedAt)}</Td>
                        <Td className="text-admin-muted">{d.live?.publishedByEmail ?? '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTableEl>
              </div>
            )}
          </SectionCard>
        )}
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}
