'use client';
export const dynamic = 'force-dynamic';

/**
 * Platform role definitions. A role's access is its level, enforced by the
 * API's platform-admin middleware:
 *   level <= 50   read-only  — every mutation is rejected
 *   51 – 109      operator   — day-to-day mutations
 *   level >= 110  super admin — destructive endpoints + role management
 * The platform_publisher role is special-cased to blog management only.
 * Role management itself requires super admin.
 */
import { useState } from 'react';
import { KeyRound, Plus, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, inputClass } from '@/components/admin/controls';

const TIERS = [
  { value: 50, label: 'Read-only', blurb: 'Can view everything, cannot change anything.' },
  { value: 100, label: 'Operator', blurb: 'Day-to-day changes; destructive endpoints blocked.' },
  { value: 110, label: 'Super admin', blurb: 'Everything, including roles, impersonation, IP blocks.' },
] as const;

function tierForLevel(name: string, level: number): { label: string; tone: StatusTone } {
  if (name === 'platform_publisher') return { label: 'Blog only', tone: 'info' };
  if (level >= 110) return { label: 'Super admin', tone: 'danger' };
  if (level > 50) return { label: 'Operator', tone: 'success' };
  return { label: 'Read-only', tone: 'neutral' };
}

export default function RolesPage() {
  useAdminAuth();
  const utils = (trpc as any).useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', level: 100 });
  const [error, setError] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listPlatformRoles.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const invalidate = () => (utils as any).platformAdmin.listPlatformRoles.invalidate();
  const onError = (e: { message: string }) => setError(e.message);

  const create = (trpc as any).platformAdmin.createPlatformRole.useMutation({
    onSuccess: () => {
      setShowCreate(false);
      setForm({ name: '', displayName: '', description: '', level: 100 });
      setError(null);
      invalidate();
    },
    onError,
  });
  const update = (trpc as any).platformAdmin.updatePlatformRole.useMutation({
    onSuccess: () => { setEditingId(null); setError(null); invalidate(); },
    onError,
  });
  const remove = (trpc as any).platformAdmin.deletePlatformRole.useMutation({
    onSuccess: () => { setError(null); invalidate(); },
    onError,
  });

  const roles: any[] = list.data ?? [];

  const tierPicker = (level: number, onChange: (level: number) => void) => (
    <div className="grid gap-2 sm:grid-cols-3">
      {TIERS.map((t) => (
        <label
          key={t.value}
          className={`flex cursor-pointer items-start gap-2 rounded-admin-sm border p-3 text-sm transition-colors ${
            level === t.value ? 'border-admin-accent-border bg-admin-accent-soft' : 'border-admin-border bg-white hover:border-admin-border-strong'
          }`}
        >
          <input
            type="radio"
            checked={level === t.value}
            onChange={() => onChange(t.value)}
            className="mt-0.5 h-4 w-4 border-admin-border-strong text-admin-accent focus:ring-admin-accent/30"
          />
          <span>
            <span className="block font-medium text-admin-ink">{t.label}</span>
            <span className="text-xs text-admin-muted">{t.blurb}</span>
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<KeyRound />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Roles' }]}
        title="Roles"
        description={
          <>
            Define platform admin roles and their access. Assign roles to people on the{' '}
            <a href="/settings/admins" className="font-medium text-admin-accent-ink hover:underline">Admins</a> page.
            Changing roles requires super admin.
          </>
        }
        actions={
          <button
            onClick={() => { setShowCreate((v) => !v); setEditingId(null); setError(null); }}
            className={showCreate ? buttonClass.secondary : buttonClass.primary}
          >
            {showCreate ? null : <Plus className="h-4 w-4" />}
            {showCreate ? 'Cancel' : 'New role'}
          </button>
        }
      >
        <div className="space-y-6">
          {error && (
            <p role="alert" className="rounded-admin-sm border border-admin-danger/30 bg-admin-danger-soft px-3 py-2 text-sm text-admin-danger">{error}</p>
          )}

          {showCreate && (
            <SectionCard icon={<Plus />} title="New role" description="Lowercase internal name with underscores; access comes from the level">
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Display name (e.g. Billing Ops)"
                    className={inputClass}
                  />
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="internal_name (lowercase, underscores)"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What is this role for?"
                  className={inputClass}
                />
                {tierPicker(form.level, (level) => setForm({ ...form, level }))}
                <button
                  onClick={() => create.mutate({
                    name: form.name.trim(),
                    displayName: form.displayName.trim(),
                    description: form.description.trim() || undefined,
                    level: form.level,
                  })}
                  disabled={create.isPending || !/^[a-z0-9_]{2,60}$/.test(form.name.trim()) || form.displayName.trim().length < 2}
                  className={buttonClass.primary}
                >
                  {create.isPending ? 'Creating…' : 'Create role'}
                </button>
              </div>
            </SectionCard>
          )}

          <SectionCard icon={<ShieldCheck />} title="Platform roles" description="Read-only, operator or super admin, by level" padded={false}>
            {list.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : roles.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<KeyRound />} title="No roles yet." />
            ) : (
              <div className="divide-y divide-admin-border">
                {roles.map((r) => {
                  const tier = tierForLevel(r.name, r.level);
                  const isEditing = editingId === r.id;
                  return (
                    <div key={r.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <StatusPill tone={tier.tone} className="shrink-0">
                          {tier.label}
                        </StatusPill>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-admin-ink">
                            {r.displayName}
                            <span className="ml-2 font-mono text-xs text-admin-muted">{r.name}</span>
                            <span className="ml-2 text-xs text-admin-muted">level {r.level}</span>
                          </p>
                          {r.description && <p className="text-sm text-admin-secondary">{r.description}</p>}
                          <p className="mt-0.5 text-xs text-admin-muted">
                            {r.memberCount} member{r.memberCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setError(null);
                              setEditingId(isEditing ? null : r.id);
                              setForm({
                                name: r.name,
                                displayName: r.displayName,
                                description: r.description ?? '',
                                level: r.level,
                              });
                            }}
                            className={buttonClass.small}
                          >
                            {isEditing ? 'Cancel' : 'Edit'}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete role ${r.displayName}?`)) {
                                remove.mutate({ id: r.id });
                              }
                            }}
                            disabled={remove.isPending || r.memberCount > 0}
                            title={r.memberCount > 0 ? 'Reassign its members first' : undefined}
                            className={`${buttonClass.small} border-red-200 text-red-700 hover:border-red-300 hover:bg-admin-danger-soft disabled:opacity-40`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="mt-3 space-y-3 rounded-admin-sm border border-admin-border bg-admin-bg/50 p-4">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <input
                              value={form.displayName}
                              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                              className={inputClass}
                            />
                            <input
                              value={form.description}
                              onChange={(e) => setForm({ ...form, description: e.target.value })}
                              placeholder="Description"
                              className={inputClass}
                            />
                          </div>
                          {r.name !== 'platform_publisher' && tierPicker(form.level, (level) => setForm({ ...form, level }))}
                          <button
                            onClick={() => update.mutate({
                              id: r.id,
                              displayName: form.displayName.trim(),
                              description: form.description.trim() || null,
                              ...(r.name !== 'platform_publisher' && form.level !== r.level ? { level: form.level } : {}),
                            })}
                            disabled={update.isPending || form.displayName.trim().length < 2}
                            className={buttonClass.primary}
                          >
                            {update.isPending ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}
