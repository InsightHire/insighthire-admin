'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ArrowLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function OrganizationUsersPage() {
  const params = useParams();
  const orgId = params.id as string;

  // Auth gating handled by middleware.ts; we only need the current admin's info
  // to stamp the impersonation handoff payload.
  const { data: me } = trpc.platformAdmin.me.useQuery(undefined, { staleTime: 60_000 });
  const { data, isLoading, refetch } = trpc.platformAdmin.getOrganizationUsers.useQuery({
    organizationId: orgId,
  });
  const deactivateUser = trpc.platformAdmin.deactivateUser.useMutation({
    onSuccess: () => refetch(),
  });
  const impersonateUser = trpc.platformAdmin.impersonateUser.useMutation();

  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'ORGANIZATION_ADMIN' as 'ORGANIZATION_ADMIN' | 'RECRUITER' | 'HIRING_MANAGER',
  });

  // Cast: the admin app's `trpc` is typed as `any`-router (every hook call in
  // this codebase errors the same way); keep new code out of the tsc baseline.
  const inviteOrgAdmin = (trpc as any).platformAdmin.inviteOrgAdmin.useMutation({
    onSuccess: () => {
      setShowInvite(false);
      setInviteForm({ email: '', firstName: '', lastName: '', role: 'ORGANIZATION_ADMIN' });
      refetch();
    },
    onError: (e: { message: string }) => alert('Invite failed: ' + e.message),
  });

  const handleImpersonate = async (userId: string) => {
    if (!confirm('Impersonate this user? All actions will be logged.')) return;

    try {
      const result = await impersonateUser.mutateAsync({ userId });

      if (typeof window !== 'undefined') {
        localStorage.setItem('impersonation_token', result.token);
        localStorage.setItem('impersonation_user', JSON.stringify(result.user));
        if (me) {
          localStorage.setItem('impersonation_admin', JSON.stringify(me));
        }
      }

      window.open('/dashboard?impersonated=true', '_blank');
      setImpersonating(userId);
    } catch (error: any) {
      alert('Impersonation failed: ' + error.message);
    }
  };

  const handleDeactivate = async (userId: string) => {
    const reason = prompt('Reason for deactivation:');
    if (!reason) return;

    await deactivateUser.mutateAsync({ userId, reason });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Link
              href={`/organizations/${orgId}`}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div className="flex items-center space-x-3">
              <UserGroupIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Organization Users</h1>
                <p className="text-sm text-gray-600">{data?.users.length || 0} users</p>
              </div>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setShowInvite(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Invite User
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {data?.users.length === 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This organization has no users yet. Invite the customer&apos;s first admin with
            <span className="font-medium"> + Invite User</span>, or use{' '}
            <span className="font-medium">Login as Admin</span> on the organization page — it now
            creates a &quot;Platform Setup&quot; admin automatically so you can configure the
            tenant yourself.
          </div>
        )}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-3">
                    <button
                      onClick={() => handleImpersonate(user.id)}
                      disabled={!user.isActive}
                      className="text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                    >
                      Impersonate
                    </button>
                    {user.isActive && (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite user modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900">Invite user to this organization</h2>
            <p className="mt-1 text-sm text-gray-500">
              Sends a WorkOS invitation plus a branded email. The user appears as Pending until
              they accept.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="email"
                placeholder="email@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="First name"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Last name"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm((p) => ({ ...p, role: e.target.value as typeof p.role }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ORGANIZATION_ADMIN">Organization Admin</option>
                <option value="RECRUITER">Recruiter</option>
                <option value="HIRING_MANAGER">Hiring Manager</option>
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  inviteOrgAdmin.mutate({ organizationId: orgId, ...inviteForm })
                }
                disabled={
                  inviteOrgAdmin.isPending ||
                  !inviteForm.email ||
                  !inviteForm.firstName ||
                  !inviteForm.lastName
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inviteOrgAdmin.isPending ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
