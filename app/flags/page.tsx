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
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default function FlagsPage() {
  useAdminAuth();
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

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature flags</h1>
          <p className="text-sm text-gray-500">
            Platform-wide kill switches. Changes take effect within ~30 seconds — no deploy.
            A feature gated behind a missing or disabled flag is off. Expand a flag to enable
            it for specific orgs ahead of (or instead of) a global rollout.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">New flag</h2>
          <div className="flex flex-wrap gap-3">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="key (lowercase, e.g. tenant_announcements)"
              className="flex-1 min-w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this flag control?"
              className="flex-[2] min-w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => create.mutate({ key: key.trim(), description: description.trim() || undefined })}
              disabled={create.isPending || !/^[a-z0-9_.-]{2,80}$/.test(key.trim())}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {create.isPending ? 'Creating…' : 'Create (off)'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {list.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No flags yet.</p>
          ) : (
            rows.map((f) => {
              const overrides: Record<string, boolean> = f.orgOverrides ?? {};
              const overrideEntries = Object.entries(overrides);
              const isExpanded = expanded.has(f.id);
              return (
                <div key={f.id}>
                  <div className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => toggleExpanded(f.id)}
                      className="text-gray-400 hover:text-gray-600 shrink-0"
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
                      disabled={update.isPending}
                      role="switch"
                      aria-checked={f.enabled}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                        f.enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
                          f.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-mono font-medium text-gray-900">
                        {f.key}
                        <span className={`ml-2 px-1.5 py-0.5 text-xs rounded font-sans ${
                          f.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {f.enabled ? 'on' : 'off'}
                        </span>
                        {overrideEntries.length > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs rounded font-sans bg-purple-100 text-purple-800">
                            {overrideEntries.length} override{overrideEntries.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </p>
                      {f.description && <p className="text-sm text-gray-600">{f.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Updated {new Date(f.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete flag ${f.key}? Gated features will read it as OFF.`)) {
                          remove.mutate({ id: f.id });
                        }
                      }}
                      disabled={remove.isPending}
                      className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 shrink-0"
                    >
                      Delete
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pl-11 space-y-2 bg-gray-50/60">
                      {overrideEntries.length === 0 ? (
                        <p className="text-xs text-gray-400 pt-2">No per-org overrides.</p>
                      ) : (
                        overrideEntries.map(([orgId, enabled]) => (
                          <div key={orgId} className="flex items-center gap-3 pt-2">
                            <span className="text-sm text-gray-800 min-w-0 flex-1 truncate">
                              {nameById.get(orgId) ?? orgId}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {enabled ? 'on' : 'off'}
                            </span>
                            <button
                              onClick={() => update.mutate({ id: f.id, setOrgOverride: { organizationId: orgId, enabled: !enabled } })}
                              disabled={update.isPending}
                              className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-white"
                            >
                              Flip
                            </button>
                            <button
                              onClick={() => update.mutate({ id: f.id, setOrgOverride: { organizationId: orgId, clear: true } })}
                              disabled={update.isPending}
                              className="px-2 py-0.5 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}

                      {addingOverrideFor === f.id ? (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <select
                            value={pickedOrgId}
                            onChange={(e) => setPickedOrgId(e.target.value)}
                            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm min-w-56"
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
                            className="px-2.5 py-1 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            Add override (on)
                          </button>
                          <button
                            onClick={() => { setAddingOverrideFor(null); setPickedOrgId(''); }}
                            className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingOverrideFor(f.id)}
                          className="text-xs text-purple-700 hover:text-purple-900 pt-2"
                        >
                          + Add org override
                        </button>
                      )}
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
