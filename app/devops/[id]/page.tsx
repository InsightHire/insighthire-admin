'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function DevopsIncidentPage() {
  useAdminAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const configQuery = trpc.platformAdmin.getDevopsConfig.useQuery();
  const detailQuery = trpc.platformAdmin.getDevopsIncident.useQuery(
    { id },
    { enabled: Boolean(id) },
  );

  const detail = detailQuery.data;

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/devops"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to DevOps
        </Link>

        {detailQuery.isLoading ? (
          <p className="text-sm text-gray-500">Loading incident…</p>
        ) : !detail ? (
          <p className="text-sm text-red-600">Incident not found.</p>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase text-gray-500">{detail.incident.severity}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs font-medium text-indigo-700">{detail.incident.status}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{detail.incident.title}</h1>
              {detail.incident.summary && (
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{detail.incident.summary}</p>
              )}
              <p className="mt-2 text-xs font-mono text-gray-400">{detail.incident.id}</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {configQuery.data?.axiomStreamUrl && (
                <a
                  href={configQuery.data.axiomStreamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Search logs in Axiom <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {detail.incident.githubIssueUrl && (
                <a
                  href={detail.incident.githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  GitHub issue <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {detail.incident.prUrl && (
                <a
                  href={detail.incident.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Pull request <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
              </div>
              <ul className="divide-y divide-gray-100">
                {detail.events.map((evt) => (
                  <li key={evt.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-900">{evt.kind}</span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {new Date(evt.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {evt.payload && Object.keys(evt.payload as object).length > 0 && (
                      <pre className="mt-2 text-xs bg-gray-50 rounded p-3 overflow-x-auto text-gray-700">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
