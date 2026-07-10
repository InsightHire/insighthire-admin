'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeftIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function PlatformHeygenAvatarCatalogPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [filter, setFilter] = useState('');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const listQuery = trpc.platformAdmin.listHeygenAvatarCatalog.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
  });

  const syncMutation = trpc.platformAdmin.syncHeygenAvatarCatalog.useMutation({
    onMutate: () => setSyncNotice(null),
    onSuccess: (data) => {
      setSyncNotice(`Saved ${data.upserted} avatars (${data.totalReturned} synced).`);
      listQuery.refetch();
    },
  });

  const setIncludeMutation = trpc.platformAdmin.setHeygenAvatarCatalogInclude.useMutation({
    onSuccess: () => {
      listQuery.refetch();
    },
  });

  const bulkOfficeMutation = trpc.platformAdmin.bulkHeygenAvatarCatalogOfficeInclude.useMutation({
    onSuccess: () => {
      listQuery.refetch();
    },
  });

  const bulkClearMutation = trpc.platformAdmin.bulkHeygenAvatarCatalogClearPicker.useMutation({
    onSuccess: () => {
      listQuery.refetch();
    },
  });

  const filteredRows = useMemo(() => {
    const rows = listQuery.data?.rows || [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.avatarName.toLowerCase().includes(q) ||
        r.avatarId.toLowerCase().includes(q)
    );
  }, [listQuery.data?.rows, filter]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full" />
      </div>
    );
  }

  const pickerCount = listQuery.data?.rows.filter((r) => r.includeInPersonaPicker).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/organizations" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Avatars</h1>
              <p className="text-gray-600">
                Platform-wide catalog for customer persona pickers. Sync the latest AI avatars, then curate which ones appear.
                New rows default to <span className="font-medium">office-style</span> names in the picker until you
                change checkboxes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing avatars…' : 'Sync avatars'}
          </button>
          <button
            type="button"
            onClick={() => bulkOfficeMutation.mutate()}
            disabled={bulkOfficeMutation.isPending || !listQuery.data?.total}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-gray-800"
          >
            Enable all office-style
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Remove every avatar from the persona picker? (You can re-enable individually.)')) {
                bulkClearMutation.mutate();
              }
            }}
            disabled={bulkClearMutation.isPending || !listQuery.data?.total}
            className="px-4 py-2 border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-50 disabled:opacity-50"
          >
            Clear picker selection
          </button>
          <span className="text-sm text-gray-600 ml-auto">
            {listQuery.data?.total ?? '—'} in catalog · {pickerCount} in picker
          </span>
        </div>

        {syncMutation.isError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {(syncMutation.error as Error)?.message || 'Sync failed'}
          </div>
        )}
        {syncNotice && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex justify-between gap-4">
            <span>{syncNotice}</span>
            <button type="button" className="text-green-900 underline shrink-0" onClick={() => setSyncNotice(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <input
            type="search"
            placeholder="Filter by name or ID…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg mb-4"
          />

          {listQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full" />
            </div>
          ) : !listQuery.data?.total ? (
            <p className="text-gray-600">
              No rows yet. Run <strong>Sync avatars</strong> once (may take up to a minute).
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-700">Picker</th>
                    <th className="text-left p-2 font-medium text-gray-700">Preview</th>
                    <th className="text-left p-2 font-medium text-gray-700">Name</th>
                    <th className="text-left p-2 font-medium text-gray-700">ID</th>
                    <th className="text-left p-2 font-medium text-gray-700">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.avatarId} className="border-t border-gray-100 hover:bg-gray-50/80">
                      <td className="p-2 align-middle">
                        <input
                          type="checkbox"
                          checked={row.includeInPersonaPicker}
                          disabled={setIncludeMutation.isPending}
                          onChange={(e) =>
                            setIncludeMutation.mutate({
                              avatarId: row.avatarId,
                              include: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="p-2 align-middle">
                        {row.previewImageUrl ? (
                          <img
                            src={row.previewImageUrl}
                            alt=""
                            className="h-12 w-12 object-cover rounded-md border border-gray-200"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-100 rounded-md" />
                        )}
                      </td>
                      <td className="p-2 align-middle font-medium text-gray-900">{row.avatarName}</td>
                      <td className="p-2 align-middle font-mono text-xs text-gray-600 max-w-[200px] truncate">
                        {row.avatarId}
                      </td>
                      <td className="p-2 align-middle">
                        <div className="flex flex-wrap gap-1">
                          {row.isOfficeStyle && (
                            <span className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-900">Office-style</span>
                          )}
                          {row.source === 'talking_photo' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-900">Photo avatar</span>
                          )}
                          {row.includeInPersonaPicker && (
                            <span title="Shown in customer persona picker">
                              <CheckCircleIcon className="h-5 w-5 text-green-600" aria-hidden />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500">
          Customer app persona create/edit reads this catalog first (checked rows, then office-style, then full catalog);
          if empty, it fetches avatars live.
        </p>
      </div>
    </div>
  );
}
