'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Plus, Users } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';
import { openImpersonationLink } from '@/lib/impersonation-link';

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

      openImpersonationLink(result);
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AdminPageChrome
      icon={<Users />}
      breadcrumbs={[
        { label: 'Tenants', href: '/organizations' },
        { label: 'Organization', href: `/organizations/${orgId}` },
        { label: 'Users' },
      ]}
      title="Organization Users"
      description={`${data?.users.length || 0} users`}
      actions={
        <button onClick={() => setShowInvite(true)} className={buttonClass.primary}>
          <Plus className="h-4 w-4" />
          Invite User
        </button>
      }
    >
      {data?.users.length === 0 && (
        <div className="mb-6 rounded-admin-sm border border-admin-warn/25 bg-admin-warn-soft px-4 py-3 text-sm text-amber-900">
          This organization has no users yet. Invite the customer&apos;s first admin with
          <span className="font-medium"> + Invite User</span>, or use{' '}
          <span className="font-medium">Login as Admin</span> on the organization page — it now
          creates a &quot;Platform Setup&quot; admin automatically so you can configure the
          tenant yourself.
        </div>
      )}
      <SectionCard
        icon={<Users />}
        title="Members"
        description="Roles, status and support actions for people in this organization"
        padded={false}
      >
        {data?.users.length === 0 ? (
          <EmptyState compact className="border-0 shadow-none" icon={<Users />} title="No users yet" />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>Name / Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Last Login</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user: any) => (
                  <tr key={user.id}>
                    <Td className="text-admin-ink">
                      {(user.firstName || user.lastName) && (
                        <p className="font-medium">{[user.firstName, user.lastName].filter(Boolean).join(' ')}</p>
                      )}
                      <p className={user.firstName || user.lastName ? 'text-xs text-admin-muted' : ''}>{user.email}</p>
                      {user.viaMembership && (
                        <p className="text-xs text-admin-muted">Account lives in another org; added here as a member</p>
                      )}
                    </Td>
                    <Td>
                      {isSuperAdmin && !user.viaMembership ? (
                        <select
                          value={EDITABLE_ROLES.includes(user.role) ? user.role : ''}
                          onChange={(e) => updateUserRole.mutate({ userId: user.id, role: e.target.value })}
                          disabled={updateUserRole.isPending}
                          className={`${selectClass} py-1 text-xs`}
                        >
                          {!EDITABLE_ROLES.includes(user.role) && <option value="">{user.role}</option>}
                          {EDITABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <StatusPill tone="brand" dot={false}>{user.role}</StatusPill>
                      )}
                    </Td>
                    <Td>
                      <StatusPill tone={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </StatusPill>
                    </Td>
                    <Td className="text-admin-muted">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </Td>
                    <Td className="space-x-3 whitespace-nowrap">
                      {user.viaMembership ? (
                        <span className="text-xs text-admin-muted">Manage from their home org</span>
                      ) : (<>
                      {isSuperAdmin && (
                        <button
                          onClick={() => openEdit(user)}
                          className="font-medium text-admin-secondary hover:text-admin-ink"
                        >
                          Edit
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleImpersonate(user.id)}
                          disabled={!user.isActive}
                          className="font-medium text-admin-accent-ink hover:underline disabled:opacity-50"
                        >
                          Impersonate
                        </button>
                      )}
                      {user.isActive ? (
                        <button
                          onClick={() => handleDeactivate(user.id)}
                          className="font-medium text-red-600 hover:text-red-700"
                        >
                          Deactivate
                        </button>
                      ) : (
                        isSuperAdmin && (
                          <button
                            onClick={() => reactivateUser.mutate({ userId: user.id })}
                            disabled={reactivateUser.isPending}
                            className="font-medium text-green-700 hover:text-green-800"
                          >
                            Reactivate
                          </button>
                        )
                      )}
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleDelete(user.id, user.email)}
                          className="font-medium text-red-700 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                      </>)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTableEl>
          </div>
        )}
      </SectionCard>

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-admin border border-admin-border bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-admin-ink">Edit user</h2>
            <p className="mt-1 text-sm text-admin-muted">Support-desk correction — not a general profile editor.</p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="First name"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                  className={inputClass}
                />
                <input
                  placeholder="Last name"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <input
                type="email"
                placeholder="email@company.com"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className={buttonClass.ghost}>
                Cancel
              </button>
              <button
                onClick={() => updateUserProfile.mutate({ userId: editingUser.id, ...editForm })}
                disabled={updateUserProfile.isPending || !editForm.firstName || !editForm.lastName || !editForm.email}
                className={buttonClass.primary}
              >
                {updateUserProfile.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite user modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-admin border border-admin-border bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-admin-ink">Invite user to this organization</h2>
            <p className="mt-1 text-sm text-admin-muted">
              Sends a WorkOS invitation plus a branded email. The user appears as Pending until
              they accept.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="email"
                placeholder="email@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                className={inputClass}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="First name"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((p) => ({ ...p, firstName: e.target.value }))}
                  className={inputClass}
                />
                <input
                  placeholder="Last name"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((p) => ({ ...p, lastName: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm((p) => ({ ...p, role: e.target.value as typeof p.role }))
                }
                className={`${selectClass} w-full`}
              >
                <option value="ORGANIZATION_ADMIN">Organization Admin</option>
                <option value="RECRUITER">Recruiter</option>
                <option value="HIRING_MANAGER">Hiring Manager</option>
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowInvite(false)} className={buttonClass.ghost}>
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
                className={buttonClass.primary}
              >
                {inviteOrgAdmin.isPending ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageChrome>
  );
}
