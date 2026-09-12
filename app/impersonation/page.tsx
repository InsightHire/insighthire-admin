'use client';
export const dynamic = 'force-dynamic';

/**
 * Impersonation audit trail — who impersonated whom, when, and from where.
 * Sourced from admin_audit_logs (impersonate_user / impersonate_organization).
 * Actions taken during an impersonated session appear in the org timeline.
 */
import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const DAY_OPTIONS = [7, 30, 90] as const;

export default function ImpersonationPage() {
  useAdminAuth();
  const [days, setDays] = useState<number>(30);

  const list = (trpc as any).platformAdmin.listImpersonationEvents.useQuery(
    { days },
    { refetchOnWindowFocus: false },
  );
  const events: any[] = list.data ?? [];

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Impersonation</h1>
            <p className="text-sm text-gray-500">
              Every impersonation session started by a platform admin. Actions during the
              session are recorded in the organization's timeline.
            </p>
          </div>
          <div className="flex gap-1">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                  days === d ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {list.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">
              No impersonation sessions in the last {days} days.
            </p>
          ) : (
            events.map((e) => {
              const meta = (e.metadata ?? {}) as Record<string, unknown>;
              const targetEmail = typeof meta.userEmail === 'string' ? meta.userEmail : null;
              return (
                <div key={e.id} className="px-4 py-3 flex flex-wrap items-start gap-3">
                  <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 font-medium ${
                    e.action === 'impersonate_user' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {e.action === 'impersonate_user' ? 'user' : 'organization'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {e.adminName || e.adminEmail || e.adminId}
                      <span className="text-gray-400 font-normal"> impersonated </span>
                      {targetEmail ?? e.targetUserId ?? 'organization'}
                      {e.orgName && (
                        <>
                          <span className="text-gray-400 font-normal"> at </span>
                          {e.orgId ? (
                            <Link href={`/organizations/${e.orgId}`} className="text-purple-700 hover:underline">
                              {e.orgName}
                            </Link>
                          ) : (
                            e.orgName
                          )}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(e.at).toLocaleString()}
                      {e.ipAddress ? <span className="ml-2 font-mono">{e.ipAddress}</span> : null}
                      {typeof meta.userRole === 'string' ? <span className="ml-2">role: {meta.userRole}</span> : null}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
