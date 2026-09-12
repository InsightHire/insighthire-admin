'use client';

/**
 * Authio SSO link + SCIM provisioning status for a tenant. No SSO-required/
 * enabled flag is stored locally — Authio is the source of truth for
 * connection + policy state, so this always reflects what platformAdmin.
 * getOrgAuthenticationStatus reads live from Authio. SCIM has no persisted
 * event log yet, so the "provisioned users" list is current state, not a
 * timeline of what changed.
 */
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

export function OrgAuthenticationSection({ organizationId }: { organizationId: string }) {
  const status = (trpc as any).platformAdmin.getOrgAuthenticationStatus.useQuery(
    { organizationId },
    { refetchOnWindowFocus: false },
  );

  if (status.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Authentication</h2>
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const data = status.data;
  const linked = !!data?.authioOrganizationId;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900">Authentication</h2>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
          linked ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {linked ? 'Authio linked' : 'Not linked'}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">SSO connection and SCIM user provisioning for this tenant.</p>

      {!linked ? (
        <p className="text-sm text-gray-400">
          No Authio organization linked yet — it's created automatically the first time someone is
          invited or logs in.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">SSO</p>
              <p className="text-sm font-medium text-gray-900">
                {data.ssoEnabled ? (data.ssoProvider || 'Connected') : 'Not connected'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">SSO required</p>
              <p className="text-sm font-medium text-gray-900">{data.ssoRequired ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">SCIM-managed users</p>
              <p className="text-sm font-medium text-gray-900">{data.scimManagedUsers?.length ?? 0}</p>
            </div>
          </div>

          {data.groupRoleMappings?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                Group → role mappings
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.groupRoleMappings.map((m: any) => (
                  <span key={m.id} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                    {m.groupDisplayName} → {m.role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.scimManagedUsers?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                SCIM-managed users
              </p>
              <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
                {data.scimManagedUsers.slice(0, 10).map((u: any) => (
                  <div key={u.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-900 flex-1 min-w-0 truncate">{u.email}</span>
                    <span className="text-xs text-gray-500">{u.role}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {u.isActive ? 'active' : 'inactive'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {u.scimLastSyncedAt ? `synced ${new Date(u.scimLastSyncedAt).toLocaleDateString()}` : 'never synced'}
                    </span>
                  </div>
                ))}
              </div>
              {data.scimManagedUsers.length > 10 && (
                <p className="text-xs text-gray-400 mt-1">
                  +{data.scimManagedUsers.length - 10} more —{' '}
                  <Link href={`/organizations/${organizationId}/users`} className="text-purple-700 hover:text-purple-900">
                    full user list
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
