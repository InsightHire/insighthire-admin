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
} from '@heroicons/react/24/outline';

export default function AdminUsersPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState<'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT'>('PLATFORM_SUPPORT');
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
      setEditingId(null);
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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({
      email: inviteEmail,
      firstName: inviteFirstName,
      lastName: inviteLastName,
      role: inviteRole,
    });
  };

  if (!isAuthed) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
            <p className="text-gray-500 mt-1">Manage platform administrators and invite new admins</p>
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
          <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
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
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="PLATFORM_SUPPORT">Platform Support</option>
                  <option value="PLATFORM_ADMIN">Platform Admin</option>
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
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Last login</th>
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
                        {editingId === admin.id ? (
                          <select
                            defaultValue={admin.role}
                            className="px-2 py-1 border rounded text-sm"
                            onChange={(e) => {
                              const newRole = e.target.value as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT';
                              updateMutation.mutate({ userId: admin.id, role: newRole });
                            }}
                            autoFocus
                          >
                            <option value="PLATFORM_SUPPORT">Platform Support</option>
                            <option value="PLATFORM_ADMIN">Platform Admin</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              admin.role === 'PLATFORM_ADMIN' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {admin.role === 'PLATFORM_ADMIN' ? 'Admin' : 'Support'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {admin.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            <ClockIcon className="h-3.5 w-3.5" />
                            Pending invite
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {admin.lastLoginAt
                          ? new Date(admin.lastLoginAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {admin.status === 'pending' && (
                            <button
                              onClick={() => resendMutation.mutate({ userId: admin.id })}
                              disabled={resendMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            >
                              <EnvelopeIcon className="h-4 w-4" />
                              Resend invite
                            </button>
                          )}
                          {admin.status === 'active' && admin.id !== currentUserId && (
                            <button
                              onClick={() => setEditingId(admin.id)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              <PencilIcon className="h-4 w-4" />
                              Edit role
                            </button>
                          )}
                          {admin.status === 'active' && admin.id !== currentUserId && (
                            <button
                              onClick={() => {
                                if (confirm(`Deactivate ${admin.name || admin.email}? They will no longer be able to log in.`)) {
                                  deactivateMutation.mutate({ userId: admin.id });
                                }
                              }}
                              disabled={deactivateMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <NoSymbolIcon className="h-4 w-4" />
                              Deactivate
                            </button>
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

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Roles:</strong> Platform Admin has full access. Platform Support has read-only access to most features.
            All actions are logged in the Audit section.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
