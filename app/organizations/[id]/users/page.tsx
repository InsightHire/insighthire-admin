'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ArrowLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const EDITABLE_ROLES = ['RECRUITER', 'HIRING_MANAGER', 'ADMIN', 'ORGANIZATION_ADMIN', 'ORG_ADMINISTRATOR'] as const;

type EditableUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export default function OrganizationUsersPage() {
  const params = useParams();
  const orgId = params.id as string;

  // Auth gating handled by middleware.ts; we only need the current admin's info
  // to stamp the impersonation handoff payload.
  const { data: me } = trpc.platformAdmin.me.useQuery(undefined, { staleTime: 60_000 });
  // Impersonation/role-change/delete are SUPER_ADMIN only; server-side
  // enforcement is the real guard (superAdminProcedure) — this only hides
  // the controls from everyone else.
  const isSuperAdmin =
    (me as any)?.platformRoleName === 'platform_super_admin' || (me as any)?.platformRole === 'SUPER_ADMIN';
  const { data, isLoading, refetch } = (trpc as any).platformAdmin.getOrganizationUsers.useQuery({
    organizationId: orgId,
  });
  const deactivateUser = trpc.platformAdmin.deactivateUser.useMutation({
    onSuccess: () => refetch(),
  });
  const reactivateUser = (trpc as any).platformAdmin.reactivateUser.useMutation({
    onSuccess: () => refetch(),
  });
  const updateUserRole = (trpc as any).platformAdmin.updateUserRole.useMutation({
    onSuccess: () => refetch(),
    onError: (e: { message: string }) => alert('Role change failed: ' + e.message),
  });
  const updateUserProfile = (trpc as any).platformAdmin.updateUserProfile.useMutation({
    onSuccess: () => { setEditingUser(null); refetch(); },
    onError: (e: { message: string }) => alert('Update failed: ' + e.message),
  });
  const deleteUser = (trpc as any).platformAdmin.deleteUser.useMutation({
    onSuccess: () => refetch(),
    onError: (e: { message: string }) => alert('Delete failed: ' + e.message),
  });
  const impersonateUser = trpc.platformAdmin.impersonateUser.useMutation();

  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '' });
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

  const handleDelete = async (userId: string, email: string) => {
    const reason = prompt(`Delete ${email}? This deactivates them and marks the account deleted. Reason:`);
    if (!reason) return;
    await deleteUser.mutateAsync({ userId, reason });
  };

  const openEdit = (user: EditableUser) => {
    setEditingUser(user);
    setEditForm({ firstName: user.firstName ?? '', lastName: user.lastName ?? '', email: user.email });
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
                  Name / Email
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
              {data?.users.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {(user.firstName || user.lastName) && (
                      <p className="font-medium">{[user.firstName, user.lastName].filter(Boolean).join(' ')}</p>
                    )}
                    <p className={user.firstName || user.lastName ? 'text-gray-500 text-xs' : ''}>{user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {isSuperAdmin ? (
                      <select
                        value={EDITABLE_ROLES.includes(user.role) ? user.role : ''}
                        onChange={(e) => updateUserRole.mutate({ userId: user.id, role: e.target.value })}
                        disabled={updateUserRole.isPending}
                        className="text-xs font-medium rounded-full border border-gray-200 bg-blue-50 px-2 py-1 text-blue-800"
                      >
                        {!EDITABLE_ROLES.includes(user.role) && <option value="">{user.role}</option>}
                        {EDITABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-3 whitespace-nowrap">
                    {isSuperAdmin && (
                      <button
                        onClick={() => openEdit(user)}
                        className="text-gray-600 hover:text-gray-900 font-medium"
                      >
                        Edit
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleImpersonate(user.id)}
                        disabled={!user.isActive}
                        className="text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                      >
                        Impersonate
                      </button>
                    )}
                    {user.isActive ? (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Deactivate
                      </button>
                    ) : (
                      isSuperAdmin && (
                        <button
                          onClick={() => reactivateUser.mutate({ userId: user.id })}
                          disabled={reactivateUser.isPending}
                          className="text-green-700 hover:text-green-800 font-medium"
                        >
                          Reactivate
                        </button>
                      )
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        className="text-red-700 hover:text-red-900 font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900">Edit user</h2>
            <p className="mt-1 text-sm text-gray-500">Support-desk correction — not a general profile editor.</p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="First name"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Last name"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <input
                type="email"
                placeholder="email@company.com"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => updateUserProfile.mutate({ userId: editingUser.id, ...editForm })}
                disabled={updateUserProfile.isPending || !editForm.firstName || !editForm.lastName || !editForm.email}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updateUserProfile.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

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
