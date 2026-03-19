'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import {
  UserPlusIcon,
  EnvelopeIcon,
  PencilIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  ClockIcon,
  TrashIcon,
  PlayIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Fallback labels for legacy enum values
const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Admin',
  PLATFORM_SUPPORT: 'Support',
  SUPER_ADMIN: 'Super Admin',
  SUPPORT: 'Support',
  BILLING_ADMIN: 'Billing',
  ANALYTICS: 'Analytics',
  platform_admin: 'Platform Admin',
  platform_support: 'Platform Support',
  platform_super_admin: 'Super Admin',
  platform_billing_admin: 'Billing Admin',
  platform_analytics: 'Analytics',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    platformRole: string | null;
    platform_role_id: string | null;
  } | null>(null);
  const [auditUserId, setAuditUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [invitePlatformRoleId, setInvitePlatformRoleId] = useState<string>('platform_role_support');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.push('/login');
    else {
      setIsAuthed(true);
      try {
        const u = localStorage.getItem('admin_user');
        if (u) setCurrentUserId(JSON.parse(u).id);
      } catch {}
    }
  }, [router]);

  const { data: admins, isLoading, refetch } = trpc.platformAdmin.listPlatformAdmins.useQuery(
    undefined,
    { enabled: isAuthed, refetchInterval: 30000 }
  );

  const { data: platformRoles } = trpc.platformAdmin.listPlatformRoles.useQuery(
    undefined,
    { enabled: isAuthed && (showInvite || !!editingAdmin) }
  );

  const { data: auditLogs, isLoading: auditLoading } = trpc.platformAdmin.getPlatformAdminAuditLogs.useQuery(
    { userId: auditUserId!, page: 1, limit: 50 },
    { enabled: !!auditUserId }
  );

  const inviteMutation = trpc.platformAdmin.invitePlatformAdmin.useMutation({
    onSuccess: () => {
      setShowInvite(false);
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      refetch();
    },
    onError: (e) => alert(e.message),
  });

  const updateMutation = trpc.platformAdmin.updatePlatformAdmin.useMutation({
    onSuccess: () => {
      setEditingAdmin(null);
      refetch();
    },
    onError: (e) => alert(e.message),
  });

  const resendMutation = trpc.platformAdmin.resendPlatformAdminInvite.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => alert(e.message),
  });

  const deactivateMutation = trpc.platformAdmin.deactivatePlatformAdmin.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => alert(e.message),
  });

  const suspendMutation = trpc.platformAdmin.suspendPlatformAdmin.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => alert(e.message),
  });

  const reactivateMutation = trpc.platformAdmin.reactivatePlatformAdmin.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => alert(e.message),
  });

  const deleteMutation = trpc.platformAdmin.deletePlatformAdmin.useMutation({
    onSuccess: () => {
      setEditingAdmin(null);
      setAuditUserId(null);
      refetch();
    },
    onError: (e) => alert(e.message),
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({
      email: inviteEmail,
      firstName: inviteFirstName,
      lastName: inviteLastName,
      platform_role_id: invitePlatformRoleId,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    const form = e.target as HTMLFormElement;
    const firstName = (form.elements.namedItem('firstName') as HTMLInputElement)?.value;
    const lastName = (form.elements.namedItem('lastName') as HTMLInputElement)?.value;
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value;
    const platform_role_id = (form.elements.namedItem('platform_role_id') as HTMLSelectElement)?.value;
    updateMutation.mutate({
      userId: editingAdmin.id,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      platform_role_id: platform_role_id || undefined,
    });
  };

  if (!isAuthed) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
            <p className="text-gray-500 mt-1">Manage platform administrators, roles, and audit activity</p>
          </div>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            <UserPlusIcon className="h-5 w-5" />
            Invite Admin
          </button>
        </div>

        {showInvite && (
          <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite new admin</h2>
            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  type="text"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={invitePlatformRoleId}
                  onChange={(e) => setInvitePlatformRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {platformRoles?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName} {r.description ? ` (${r.description})` : ''}
                    </option>
                  ))}
                  {(!platformRoles || platformRoles.length === 0) && (
                    <>
                      <option value="platform_role_support">Platform Support</option>
                      <option value="platform_role_admin">Platform Admin</option>
                    </>
                  )}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
            <p className="text-sm text-gray-500 mt-2">
              An invite email will be sent with a link to set their password. Link expires in 7 days.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">User</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Role</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Invite accepted</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Last login</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Failed logins</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins?.map((admin) => (
                    <tr key={admin.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{admin.name || admin.email}</p>
                          <p className="text-gray-500 text-xs">{admin.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            (admin.platformRoleName ?? admin.role) === 'platform_support' ? 'bg-gray-100 text-gray-700' : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {ROLE_LABELS[admin.platformRoleName ?? admin.role] ?? admin.platformRole ?? admin.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {admin.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            <ClockIcon className="h-3.5 w-3.5" />
                            Pending invite
                          </span>
                        ) : admin.status === 'suspended' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <NoSymbolIcon className="h-3.5 w-3.5" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {admin.inviteAcceptedAt
                          ? new Date(admin.inviteAcceptedAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {admin.lastLoginAt
                          ? new Date(admin.lastLoginAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {admin.failedLoginCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700" title={admin.lastFailedLoginAt ? `Last: ${new Date(admin.lastFailedLoginAt).toLocaleString()}` : ''}>
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            {admin.failedLoginCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button
                            onClick={() => setAuditUserId(auditUserId === admin.id ? null : admin.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="View audit log"
                          >
                            <DocumentTextIcon className="h-4 w-4" />
                            Audit
                          </button>
                          {admin.status === 'pending' && (
                            <button
                              onClick={() => resendMutation.mutate({ userId: admin.id })}
                              disabled={resendMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            >
                              <EnvelopeIcon className="h-4 w-4" />
                              Resend
                            </button>
                          )}
                          {(admin.status === 'active' || admin.status === 'suspended') && admin.id !== currentUserId && (
                            <>
                              <button
                                onClick={() => setEditingAdmin({
                                  id: admin.id,
                                  email: admin.email,
                                  firstName: admin.firstName,
                                  lastName: admin.lastName,
                                  role: admin.role,
                                  platformRole: admin.platformRole,
                                  platform_role_id: admin.platform_role_id,
                                })}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                              >
                                <PencilIcon className="h-4 w-4" />
                                Edit
                              </button>
                              {admin.status === 'active' ? (
                                <button
                                  onClick={() => {
                                    if (confirm(`Suspend ${admin.name || admin.email}? They will not be able to log in until reactivated.`)) {
                                      suspendMutation.mutate({ userId: admin.id });
                                    }
                                  }}
                                  disabled={suspendMutation.isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg"
                                >
                                  <NoSymbolIcon className="h-4 w-4" />
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => reactivateMutation.mutate({ userId: admin.id })}
                                  disabled={reactivateMutation.isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                >
                                  <PlayIcon className="h-4 w-4" />
                                  Reactivate
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm(`Permanently remove ${admin.name || admin.email} from platform admins? This cannot be undone.`)) {
                                    deleteMutation.mutate({ userId: admin.id });
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <TrashIcon className="h-4 w-4" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {admins?.length === 0 && !isLoading && (
            <div className="p-12 text-center text-gray-500">
              <p>No admin users yet. Invite your first admin above.</p>
            </div>
          )}
        </div>

        {/* Audit log drawer */}
        {auditUserId && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={() => setAuditUserId(null)} />
            <div className="relative min-h-screen flex items-center justify-center p-4">
              <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
                  <button
                    onClick={() => setAuditUserId(null)}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {auditLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs?.logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-col gap-1 p-3 rounded-lg bg-gray-50 text-sm"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-gray-900">{log.action.replace(/_/g, ' ')}</span>
                            <span className="text-gray-500 text-xs">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                            </span>
                          </div>
                          <div className="text-gray-600 text-xs">
                            By: {typeof log.actor === 'object' && log.actor?.name ? log.actor.name : 'System'}
                            {log.ipAddress && ` • ${log.ipAddress}`}
                          </div>
                          {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata as object).length > 0 && (
                            <pre className="text-xs text-gray-500 mt-1 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                      {auditLogs?.logs.length === 0 && (
                        <p className="text-gray-500 text-center py-8">No audit entries yet.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editingAdmin && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={() => setEditingAdmin(null)} />
            <div className="relative min-h-screen flex items-center justify-center p-4">
              <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Admin</h2>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                    <input
                      name="firstName"
                      type="text"
                      defaultValue={editingAdmin.firstName ?? ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                    <input
                      name="lastName"
                      type="text"
                      defaultValue={editingAdmin.lastName ?? ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={editingAdmin.email}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      name="platform_role_id"
                      defaultValue={editingAdmin.platform_role_id ?? 'platform_role_admin'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {platformRoles?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.displayName}

                        </option>
                      ))}
                      {(!platformRoles || platformRoles.length === 0) && (
                        <>
                          <option value="platform_role_support">Platform Support</option>
                          <option value="platform_role_admin">Platform Admin</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {updateMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAdmin(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Roles:</strong> Platform Admin has full access. Platform Support has read-only access.
            Platform roles (Super Admin, Support, Billing, Analytics) provide granular permissions.
            All actions are logged. Invite acceptance, login attempts, and audit events are tracked.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
