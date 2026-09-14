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
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const TIERS = [
  { value: 50, label: 'Read-only', blurb: 'Can view everything, cannot change anything.' },
  { value: 100, label: 'Operator', blurb: 'Day-to-day changes; destructive endpoints blocked.' },
  { value: 110, label: 'Super admin', blurb: 'Everything, including roles, impersonation, IP blocks.' },
] as const;

function tierForLevel(name: string, level: number): { label: string; style: string } {
  if (name === 'platform_publisher') return { label: 'Blog only', style: 'bg-indigo-100 text-indigo-800' };
  if (level >= 110) return { label: 'Super admin', style: 'bg-red-100 text-red-800' };
  if (level > 50) return { label: 'Operator', style: 'bg-green-100 text-green-800' };
  return { label: 'Read-only', style: 'bg-gray-100 text-gray-600' };
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
    <div className="flex flex-col gap-2">
      {TIERS.map((t) => (
        <label key={t.value} className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="radio"
            checked={level === t.value}
            onChange={() => onChange(t.value)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">{t.label}</span>
            <span className="text-gray-500"> — {t.blurb}</span>
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
            <p className="text-sm text-gray-500">
              Define platform admin roles and their access. Assign roles to people on the{' '}
              <a href="/settings/admins" className="text-purple-700 hover:underline">Admins</a> page.
              Changing roles requires super admin.
            </p>
          </div>
          <button
            onClick={() => { setShowCreate((v) => !v); setEditingId(null); setError(null); }}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            {showCreate ? 'Cancel' : 'New role'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {showCreate && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">New role</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Display name (e.g. Billing Ops)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="internal_name (lowercase, underscores)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this role for?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {create.isPending ? 'Creating…' : 'Create role'}
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {list.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : (
            roles.map((r) => {
              const tier = tierForLevel(r.name, r.level);
              const isEditing = editingId === r.id;
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 font-medium ${tier.style}`}>
                      {tier.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {r.displayName}
                        <span className="ml-2 text-xs font-mono text-gray-400">{r.name}</span>
                        <span className="ml-2 text-xs text-gray-400">level {r.level}</span>
                      </p>
                      {r.description && <p className="text-sm text-gray-600">{r.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
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
                        className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
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
                        className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {isEditing && (
                    <div className="mt-3 pl-8 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          value={form.displayName}
                          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Description"
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {update.isPending ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
