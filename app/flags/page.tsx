'use client';
export const dynamic = 'force-dynamic';

/**
 * Feature flags / kill switches. Toggles apply platform-wide within ~30s
 * (the API caches flag reads briefly) — no deploy needed. Flags can also be
 * overridden per org (e.g. enable for the demo tenant ahead of a global
 * rollout); an override always wins over the global toggle for that org.
 */
import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Flag, Plus, ToggleLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';

export default function FlagsPage() {
  useAdminAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const utils = (trpc as any).useUtils();
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingOverrideFor, setAddingOverrideFor] = useState<string | null>(null);
  const [pickedOrgId, setPickedOrgId] = useState('');

  const list = (trpc as any).platformAdmin.listFlags.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const invalidate = () => (utils as any).platformAdmin.listFlags.invalidate();

  const rows: any[] = list.data ?? [];

  const overrideOrgIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of rows) {
      for (const id of Object.keys((f.orgOverrides as Record<string, boolean>) ?? {})) ids.add(id);
    }
    return [...ids];
  }, [rows]);

  const orgNames = (trpc as any).platformAdmin.getOrganizationNames.useQuery(
    { ids: overrideOrgIds },
    { enabled: overrideOrgIds.length > 0, refetchOnWindowFocus: false },
  );
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of (orgNames.data as any[]) ?? []) m.set(o.id, o.name ?? o.id);
    return m;
  }, [orgNames.data]);

  // Org picker for "add override" — plain org search, same idiom as the
  // background-jobs page's org select.
  const orgSearch = (trpc as any).platformAdmin.listOrganizations.useQuery(
    { page: 1 },
    { enabled: addingOverrideFor !== null, refetchOnWindowFocus: false },
  );
  const orgOptions: any[] = orgSearch.data?.organizations ?? [];

  const create = (trpc as any).platformAdmin.createFlag.useMutation({
    onSuccess: () => { setKey(''); setDescription(''); setError(null); invalidate(); },
    onError: (e: { message: string }) => setError(e.message),
  });
  const update = (trpc as any).platformAdmin.updateFlag.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });
  const remove = (trpc as any).platformAdmin.deleteFlag.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const dangerSmall = cn(buttonClass.small, 'border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50');

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<ToggleLeft />}
        breadcrumbs={[{ label: 'System' }, { label: 'Feature flags' }]}
        title="Feature flags"
        description={
          <>
            Platform-wide kill switches. Changes take effect within ~30 seconds — no deploy.
            A feature gated behind a missing or disabled flag is off. Expand a flag to enable
            it for specific orgs ahead of (or instead of) a global rollout.
          </>
        }
      >
        <div className="space-y-6">
          <SectionCard icon={<Plus />} title="New flag" description="New flags start off">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="key (lowercase, e.g. tenant_announcements)"
                  className={`${inputClass} flex-1 min-w-56 font-mono`}
                />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this flag control?"
                  className={`${inputClass} flex-[2] min-w-64`}
                />
                <button
                  onClick={() => create.mutate({ key: key.trim(), description: description.trim() || undefined })}
                  disabled={create.isPending || !/^[a-z0-9_.-]{2,80}$/.test(key.trim())}
                  className={buttonClass.primary}
                >
                  {create.isPending ? 'Creating…' : 'Create (off)'}
                </button>
              </div>
              {error && (
                <p className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft px-3 py-2 text-sm text-red-700">{error}</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={<Flag />}
            title="Flags"
            description={isSuperAdmin ? 'Toggle to switch a flag on or off everywhere' : 'Only super admins can change flags'}
            padded={false}
          >
            {list.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : rows.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<Flag />} title="No flags yet." />
            ) : (
              <div className="divide-y divide-admin-border">
                {rows.map((f) => {
                  const overrides: Record<string, boolean> = f.orgOverrides ?? {};
                  const overrideEntries = Object.entries(overrides);
                  const isExpanded = expanded.has(f.id);
                  return (
                    <div key={f.id}>
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <button
                          onClick={() => toggleExpanded(f.id)}
                          className="shrink-0 text-admin-muted hover:text-admin-ink"
                          aria-label={isExpanded ? 'Collapse overrides' : 'Expand overrides'}
                        >
                          {isExpanded ? (
                            <ChevronDownIcon className="h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => update.mutate({ id: f.id, enabled: !f.enabled })}
                          disabled={update.isPending || !isSuperAdmin}
                          title={isSuperAdmin ? undefined : 'Super admin only'}
                          role="switch"
                          aria-checked={f.enabled}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 disabled:opacity-50 ${
                            f.enabled ? 'bg-admin-accent' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
                              f.enabled ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-mono text-sm font-medium text-admin-ink">
                            {f.key}
                            <StatusPill tone={f.enabled ? 'success' : 'neutral'} className="font-sans">
                              {f.enabled ? 'on' : 'off'}
                            </StatusPill>
                            {overrideEntries.length > 0 && (
                              <StatusPill tone="brand" dot={false} className="font-sans">
                                {overrideEntries.length} override{overrideEntries.length === 1 ? '' : 's'}
                              </StatusPill>
                            )}
                          </p>
                          {f.description && <p className="mt-0.5 text-sm text-admin-secondary">{f.description}</p>}
                          <p className="mt-0.5 text-xs text-admin-muted">
                            Updated {new Date(f.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        {isSuperAdmin && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete flag ${f.key}? Gated features will read it as OFF.`)) {
                                remove.mutate({ id: f.id });
                              }
                            }}
                            disabled={remove.isPending}
                            className={cn(dangerSmall, 'shrink-0')}
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="space-y-2 border-t border-admin-border bg-admin-bg/60 px-5 pb-4 pl-12">
                          {overrideEntries.length === 0 ? (
                            <p className="pt-3 text-xs text-admin-muted">No per-org overrides.</p>
                          ) : (
                            overrideEntries.map(([orgId, enabled]) => (
                              <div key={orgId} className="flex items-center gap-3 pt-2">
                                <span className="min-w-0 flex-1 truncate text-sm text-admin-ink">
                                  {nameById.get(orgId) ?? orgId}
                                </span>
                                <StatusPill tone={enabled ? 'success' : 'neutral'}>
                                  {enabled ? 'on' : 'off'}
                                </StatusPill>
                                {isSuperAdmin && (
                                  <>
                                    <button
                                      onClick={() => update.mutate({ id: f.id, setOrgOverride: { organizationId: orgId, enabled: !enabled } })}
                                      disabled={update.isPending}
                                      className={buttonClass.small}
                                    >
                                      Flip
                                    </button>
                                    <button
                                      onClick={() => update.mutate({ id: f.id, setOrgOverride: { organizationId: orgId, clear: true } })}
                                      disabled={update.isPending}
                                      className={dangerSmall}
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            ))
                          )}

                          {addingOverrideFor === f.id ? (
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              <select
                                value={pickedOrgId}
                                onChange={(e) => setPickedOrgId(e.target.value)}
                                className={`${selectClass} min-w-56`}
                              >
                                <option value="">Select an org…</option>
                                {orgOptions.map((org: any) => (
                                  <option key={org.id} value={org.id}>{org.name || org.domain || org.id}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  if (!pickedOrgId) return;
                                  update.mutate({ id: f.id, setOrgOverride: { organizationId: pickedOrgId, enabled: true } });
                                  setAddingOverrideFor(null);
                                  setPickedOrgId('');
                                }}
                                disabled={!pickedOrgId || update.isPending}
                                className={buttonClass.primary}
                              >
                                Add override (on)
                              </button>
                              <button
                                onClick={() => { setAddingOverrideFor(null); setPickedOrgId(''); }}
                                className={buttonClass.secondary}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : isSuperAdmin ? (
                            <button
                              onClick={() => setAddingOverrideFor(f.id)}
                              className="pt-2 text-xs font-medium text-admin-accent hover:text-admin-accent-ink"
                            >
                              + Add org override
                            </button>
                          ) : null}
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
