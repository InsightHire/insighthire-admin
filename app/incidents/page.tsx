'use client';
export const dynamic = 'force-dynamic';

/**
 * "What happened while I was asleep" — production smoke-test failures and
 * the rollbacks they triggered, read from GitHub issues opened by the smoke
 * workflow (5 min cache on the API side).
 */
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

export default function IncidentsPage() {
  useAdminAuth();
  const incidents = (trpc as any).platformAdmin.listIncidents.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const rows: any[] = incidents.data ?? [];

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incident history</h1>
          <p className="text-sm text-gray-500">
            Production smoke failures and rollbacks, from GitHub issues in insighthire-web.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {incidents.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : incidents.isError ? (
            <p className="px-4 py-6 text-sm text-red-700">
              Couldn't load incidents — check GITHUB_TOKEN is set on the API.
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No incidents recorded.</p>
          ) : (
            rows.map((incident) => (
              <a
                key={incident.url}
                href={incident.url}
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                    incident.state === 'open' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {incident.state === 'open' ? 'Open' : 'Closed'}
                  </span>
                  <p className="text-sm font-medium text-gray-900">{incident.title}</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Opened {new Date(incident.openedAt).toLocaleString()}
                  {incident.closedAt && ` · Closed ${new Date(incident.closedAt).toLocaleString()}`}
                </p>
              </a>
            ))
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
