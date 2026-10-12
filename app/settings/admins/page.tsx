'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { Users } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';
import {
  UserPlusIcon,
  EnvelopeIcon,
  PencilIcon,
  NoSymbolIcon,
  TrashIcon,
  PlayIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
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
  const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const [invitePlatformRoleId, setInvitePlatformRoleId] = useState<string>('platform_role_support');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Current admin's user id — used to highlight "you" in the table and prevent
  // self-modification. Auth gating itself is handled by middleware.ts.
  const { data: me } = trpc.platformAdmin.me.useQuery(undefined, { staleTime: 60_000 });
  useEffect(() => {
    if (me?.id) setCurrentUserId(me.id);
  }, [me]);
  // Role changes are SUPER_ADMIN only; server-side enforcement is the real
  // guard (superAdminProcedure) — this only hides the picker from everyone else.
  const isSuperAdmin =
    (me as any)?.platformRoleName === 'platform_super_admin' || (me as any)?.platformRole === 'SUPER_ADMIN';

  const { data: admins, isLoading, refetch } = trpc.platformAdmin.listPlatformAdmins.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const { data: platformRoles } = trpc.platformAdmin.listPlatformRoles.useQuery(
    undefined,
    { enabled: showInvite || !!editingAdmin }
  );

  const { data: emailHealth } = trpc.platformAdmin.getTransactionalEmailHealth.useQuery(undefined, {
    refetchOnMount: 'always',
  });

  const { data: auditLogs, isLoading: auditLoading } = trpc.platformAdmin.getPlatformAdminAuditLogs.useQuery(
    { userId: auditUserId!, page: 1, limit: 50 },
    { enabled: !!auditUserId }
  );

  const inviteMutation = trpc.platformAdmin.invitePlatformAdmin.useMutation({
    onSuccess: (_data, variables) => {
      setInviteSuccessMessage(
        `${variables.email} is set up in Authio and can sign in at admin.insighthire.com now. An invitation email was sent too; if it doesn't arrive, check spam/junk or click Resend on their row.`
      );
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
    onSuccess: () => {
      setInviteSuccessMessage(
        'Invite email was resent. Ask the recipient to check spam/junk; verify Mailgun domain SPF/DKIM if delivery still fails.'
      );
      refetch();
    },
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
    const emailEl = form.elements.namedItem('email') as HTMLInputElement | null;
    const roleEl = form.elements.namedItem('platform_role_id') as HTMLSelectElement | null;
    const payload: { userId: string; firstName?: string; lastName?: string; email?: string; platform_role_id?: string } = {
      userId: editingAdmin.id,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    };
    if (editingAdmin.id !== currentUserId) {
      // Only send the email when it actually changed — org-linked operators
      // reject any email update, which would block an unrelated role change.
      const nextEmail = emailEl?.value.trim();
      if (nextEmail && nextEmail.toLowerCase() !== editingAdmin.email.toLowerCase()) {
        payload.email = nextEmail;
      }
      if (roleEl) payload.platform_role_id = roleEl.value || undefined;
    }
    updateMutation.mutate(payload);
  };

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="wide"
        icon={<Users />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Admins' }]}
        title="Admin Users"
        description="Manage platform administrators, roles, and audit activity"
        actions={
          <button onClick={() => setShowInvite(!showInvite)} className={buttonClass.primary}>
            <UserPlusIcon className="h-4 w-4" />
            Invite Admin
          </button>
        }
      >
        {inviteSuccessMessage && (
          <div
            className="mb-6 rounded-admin border border-admin-ok/20 bg-admin-ok-soft px-4 py-3 text-sm text-emerald-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            role="status"
          >
            <span>{inviteSuccessMessage}</span>
            <button
              type="button"
              onClick={() => setInviteSuccessMessage(null)}
              className="shrink-0 text-emerald-800 underline font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {emailHealth && !emailHealth.ready && (
          <div
            className="mb-6 rounded-admin border border-admin-warn/25 bg-admin-warn-soft px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            <p className="font-semibold flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
              Platform admin invite email is not configured
            </p>
            <p className="mt-1 text-amber-900">
              Admin invites use <strong>Resend</strong> (account mail), not Mailgun{' '}
              <code className="bg-amber-100/80 px-1 rounded">in.insighthire.com</code> (journey/candidate pipeline). Set{' '}
              <code className="bg-amber-100/80 px-1 rounded">RESEND_API_KEY</code> on the API.
            </p>
            <ul className="mt-2 list-disc list-inside text-amber-900 space-y-0.5">
              {emailHealth.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {showInvite && (
          <SectionCard
            className="mb-6"
            icon={<UserPlusIcon />}
            title="Invite new admin"
            footer={
              <>
                An invite email will be sent with a link to set their password (or confirm access if they already have one).
                Link expires in 7 days. If the email already belongs to a customer-org user, they are granted platform admin on
                that same account — no duplicate login.
              </>
            }
          >
            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-admin-secondary mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className={inputClass}
                  required
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-admin-secondary mb-1">First name</label>
                <input
                  type="text"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-admin-secondary mb-1">Last name</label>
                <input
                  type="text"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-admin-secondary mb-1">Role</label>
                <select
                  value={invitePlatformRoleId}
                  onChange={(e) => setInvitePlatformRoleId(e.target.value)}
                  className={`${selectClass} w-full`}
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
                  className={buttonClass.primary}
                >
                  {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className={buttonClass.secondary}
                >
                  Cancel
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        <SectionCard icon={<Users />} title="Platform admins" description="Refreshes every 30 seconds" padded={false}>
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-admin-accent border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Invite accepted</Th>
                    <Th>Last login</Th>
                    <Th>Failed logins</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {admins?.map((admin) => (
                    <tr key={admin.id}>
                      <Td>
                        <div>
                          <p className="font-medium text-admin-ink">{admin.name || admin.email}</p>
                          <p className="text-admin-muted text-xs">{admin.email}</p>
                        </div>
                      </Td>
                      <Td>
                        <StatusPill
                          dot={false}
                          tone={(admin.platformRoleName ?? admin.role) === 'platform_support' ? 'neutral' : 'brand'}
                        >
                          {ROLE_LABELS[admin.platformRoleName ?? admin.role] ?? admin.platformRole ?? admin.role}
                        </StatusPill>
                      </Td>
                      <Td>
                        {admin.status === 'pending' ? (
                          <StatusPill tone="warn">Pending invite</StatusPill>
                        ) : admin.status === 'suspended' ? (
                          <StatusPill tone="danger">Suspended</StatusPill>
                        ) : (
                          <StatusPill tone="success">Active</StatusPill>
                        )}
                      </Td>
                      <Td className="text-admin-muted text-xs">
                        {admin.inviteAcceptedAt
                          ? new Date(admin.inviteAcceptedAt).toLocaleString()
                          : '—'}
                      </Td>
                      <Td className="text-admin-muted text-xs">
                        {admin.lastLoginAt
                          ? new Date(admin.lastLoginAt).toLocaleString()
                          : '—'}
                      </Td>
                      <Td>
                        {admin.failedLoginCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700" title={admin.lastFailedLoginAt ? `Last: ${new Date(admin.lastFailedLoginAt).toLocaleString()}` : ''}>
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            {admin.failedLoginCount}
                          </span>
                        ) : (
                          <span className="text-admin-muted">0</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setAuditUserId(auditUserId === admin.id ? null : admin.id)}
                            className={buttonClass.small}
                            title="View audit log"
                          >
                            <DocumentTextIcon className="h-4 w-4" />
                            Audit
                          </button>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                if (actionsOpenId === admin.id) {
                                  setActionsOpenId(null);
                                  setDropdownPosition(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                  setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 192 });
                                  setActionsOpenId(admin.id);
                                }
                              }}
                              className="inline-flex items-center justify-center rounded-admin-sm p-1.5 text-admin-muted hover:bg-admin-bg hover:text-admin-ink"
                              title="Actions"
                            >
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>
                            {actionsOpenId === admin.id && dropdownPosition && typeof document !== 'undefined' && createPortal(
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => { setActionsOpenId(null); setDropdownPosition(null); }} />
                                <div
                                  className="fixed z-20 w-48 py-1 bg-white rounded-admin shadow-lg border border-admin-border"
                                  style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                >
                                  {admin.status !== 'suspended' && !admin.lastLoginAt && !admin.inviteAcceptedAt && (
                                    <button
                                      onClick={() => { resendMutation.mutate({ userId: admin.id }); setActionsOpenId(null); }}
                                      disabled={resendMutation.isPending}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-admin-accent-ink hover:bg-admin-accent-soft"
                                    >
                                      <EnvelopeIcon className="h-4 w-4" />
                                      Resend invite
                                    </button>
                                  )}
                                  {/* Edit is available in every state — with SSO, role fixes
                                      must not wait for an invite click. */}
                                  <button
                                    onClick={() => {
                                      setEditingAdmin({
                                        id: admin.id,
                                        email: admin.email,
                                        firstName: admin.firstName,
                                        lastName: admin.lastName,
                                        role: admin.role,
                                        platformRole: admin.platformRole,
                                        platform_role_id: admin.platform_role_id,
                                      });
                                      setActionsOpenId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-admin-ink hover:bg-admin-bg"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                    Edit
                                  </button>
                                  {(admin.status === 'active' || admin.status === 'suspended') && (
                                    <>
                                      {admin.id !== currentUserId && (
                                        <>
                                          {admin.status === 'active' ? (
                                            <button
                                              onClick={() => {
                                                if (confirm(`Suspend ${admin.name || admin.email}? They will not be able to log in until reactivated.`)) {
                                                  suspendMutation.mutate({ userId: admin.id });
                                                  setActionsOpenId(null);
                                                }
                                              }}
                                              disabled={suspendMutation.isPending}
                                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                                            >
                                              <NoSymbolIcon className="h-4 w-4" />
                                              Suspend
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => { reactivateMutation.mutate({ userId: admin.id }); setActionsOpenId(null); }}
                                              disabled={reactivateMutation.isPending}
                                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                                            >
                                              <PlayIcon className="h-4 w-4" />
                                              Reactivate
                                            </button>
                                          )}
                                          <button
                                            onClick={() => {
                                              if (confirm(`Permanently remove ${admin.name || admin.email} from platform admins? This cannot be undone.`)) {
                                                deleteMutation.mutate({ userId: admin.id });
                                                setActionsOpenId(null);
                                              }
                                            }}
                                            disabled={deleteMutation.isPending}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                          >
                                            <TrashIcon className="h-4 w-4" />
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </>,
                              document.body
                            )}
                          </div>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTableEl>
            </div>
          )}
          {admins?.length === 0 && !isLoading && (
            <EmptyState compact className="border-0 shadow-none" icon={<Users />} title="No admin users yet. Invite your first admin above." />
          )}
        </SectionCard>

        {/* Audit log drawer */}
        {auditUserId && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={() => setAuditUserId(null)} />
            <div className="relative min-h-screen flex items-center justify-center p-4">
              <div className="relative bg-white rounded-admin border border-admin-border shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border">
                  <h2 className="text-[15px] font-semibold text-admin-ink">Audit Log</h2>
                  <button
                    onClick={() => setAuditUserId(null)}
                    className={buttonClass.ghost}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {auditLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin h-8 w-8 border-2 border-admin-accent border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs?.logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-col gap-1 p-3 rounded-admin-sm border border-admin-border bg-admin-bg/50 text-sm"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-admin-ink">{log.action.replace(/_/g, ' ')}</span>
                            <span className="text-admin-muted text-xs">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                            </span>
                          </div>
                          <div className="text-admin-secondary text-xs">
                            By: {typeof log.actor === 'object' && log.actor?.name ? log.actor.name : 'System'}
                            {log.ipAddress && ` • ${log.ipAddress}`}
                          </div>
                          {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata as object).length > 0 && (
                            <pre className="admin-mono text-xs text-admin-muted mt-1 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                      {auditLogs?.logs.length === 0 && (
                        <EmptyState compact className="border-0 shadow-none" icon={<DocumentTextIcon />} title="No audit entries yet." />
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
              <div className="relative bg-white text-admin-ink rounded-admin border border-admin-border shadow-xl max-w-md w-full p-6">
                <h2 className="text-[15px] font-semibold text-admin-ink mb-4">
                  {editingAdmin.id === currentUserId ? 'Edit your profile' : 'Edit Admin'}
                </h2>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-admin-secondary mb-1">First name</label>
                    <input
                      name="firstName"
                      type="text"
                      defaultValue={editingAdmin.firstName ?? ''}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-admin-secondary mb-1">Last name</label>
                    <input
                      name="lastName"
                      type="text"
                      defaultValue={editingAdmin.lastName ?? ''}
                      className={inputClass}
                    />
                  </div>
                  {editingAdmin.id !== currentUserId && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-admin-secondary mb-1">Email</label>
                        <input
                          name="email"
                          type="email"
                          defaultValue={editingAdmin.email}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-admin-secondary mb-1">Role</label>
                        {isSuperAdmin ? (
                          <select
                            name="platform_role_id"
                            defaultValue={editingAdmin.platform_role_id ?? 'platform_role_admin'}
                            className={`${selectClass} w-full`}
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
                        ) : (
                          <p className="text-sm text-admin-muted italic">
                            {ROLE_LABELS[editingAdmin.platform_role_id ?? ''] ?? 'Only a Super Admin can change roles.'}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className={buttonClass.primary}
                    >
                      {updateMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAdmin(null)}
                      className={buttonClass.secondary}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-admin-sm border border-admin-border bg-admin-bg/60 p-4">
          <p className="text-sm text-admin-secondary">
            <strong className="text-admin-ink">Roles:</strong> Platform Admin has full access. Platform Support has read-only access.
            Platform roles (Super Admin, Support, Billing, Analytics) provide granular permissions.
            All actions are logged. Invite acceptance, login attempts, and audit events are tracked.
          </p>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}
