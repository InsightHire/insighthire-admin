'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { CheckCircle2, Image as ImageIcon, RefreshCw, Search, UserSquare2, Users } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Td, Th } from '@/components/admin/data-table';
import { buttonClass, checkboxClass, inputClass } from '@/components/admin/controls';

export default function PlatformAvatarLibraryPage() {
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
        <div className="animate-spin h-12 w-12 border-b-2 border-admin-accent rounded-full" />
      </div>
    );
  }

  const pickerCount = listQuery.data?.rows.filter((r) => r.includeInPersonaPicker).length ?? 0;

  return (
    <AdminPageChrome
      icon={<UserSquare2 />}
      breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Personas' }, { label: 'Avatar library' }]}
      title="Avatar library"
      description={
        <>
          Platform-wide catalog for customer persona pickers. Sync the latest AI avatars, then curate which ones appear.
          New rows default to <span className="font-medium">office-style</span> names in the picker until you
          change checkboxes.
        </>
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => bulkOfficeMutation.mutate()}
            disabled={bulkOfficeMutation.isPending || !listQuery.data?.total}
            className={buttonClass.secondary}
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
            className={`${buttonClass.secondary} border-amber-300 text-amber-900 hover:border-amber-400 hover:bg-amber-50`}
          >
            Clear picker selection
          </button>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className={buttonClass.primary}
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing avatars…' : 'Sync avatars'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <StatGrid cols={2}>
          <StatTile label="In catalog" icon={ImageIcon} tone="brand" loading={listQuery.isLoading} value={listQuery.data?.total ?? '—'} />
          <StatTile label="In picker" icon={Users} tone="ok" loading={listQuery.isLoading} value={pickerCount} hint="Shown in customer persona picker" />
        </StatGrid>

        {syncMutation.isError && (
          <div className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft p-4 text-sm text-red-800">
            {(syncMutation.error as Error)?.message || 'Sync failed'}
          </div>
        )}
        {syncNotice && (
          <div className="flex justify-between gap-4 rounded-admin-sm border border-admin-ok/20 bg-admin-ok-soft p-4 text-sm text-emerald-800">
            <span>{syncNotice}</span>
            <button type="button" className="shrink-0 text-emerald-900 underline" onClick={() => setSyncNotice(null)}>
              Dismiss
            </button>
          </div>
        )}

        <SectionCard
          padded={false}
          icon={<UserSquare2 />}
          title="Avatars"
          description="Check a row to show it in the customer persona picker"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-admin-muted" />
              <input
                type="search"
                placeholder="Filter by name or ID…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={`${inputClass} w-64 max-w-full pl-9`}
              />
            </div>
          }
          footer={
            <>
              Customer app persona create/edit reads this catalog first (checked rows, then office-style, then full catalog);
              if empty, it fetches avatars live.
            </>
          }
        >
          {listQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-10 w-10 border-b-2 border-admin-accent rounded-full" />
            </div>
          ) : !listQuery.data?.total ? (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<UserSquare2 />}
              title="No rows yet"
              description={<>Run <strong>Sync avatars</strong> once (may take up to a minute).</>}
            />
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <DataTableEl>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <Th>Picker</Th>
                    <Th>Preview</Th>
                    <Th>Name</Th>
                    <Th>ID</Th>
                    <Th>Flags</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.avatarId}>
                      <Td className="py-2 align-middle">
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
                          className={checkboxClass}
                        />
                      </Td>
                      <Td className="py-2 align-middle">
                        {row.previewImageUrl ? (
                          <img
                            src={row.previewImageUrl}
                            alt=""
                            className="h-12 w-12 rounded-admin-sm border border-admin-border object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-admin-sm bg-admin-bg" />
                        )}
                      </Td>
                      <Td className="py-2 align-middle font-medium text-admin-ink">{row.avatarName}</Td>
                      <Td mono className="max-w-[200px] truncate py-2 align-middle">
                        {row.avatarId}
                      </Td>
                      <Td className="py-2 align-middle">
                        <div className="flex flex-wrap items-center gap-1">
                          {row.isOfficeStyle && (
                            <StatusPill tone="info" dot={false}>Office-style</StatusPill>
                          )}
                          {row.source === 'talking_photo' && (
                            <StatusPill tone="neutral" dot={false} className="bg-violet-100 text-violet-900 ring-violet-600/15">Photo avatar</StatusPill>
                          )}
                          {row.includeInPersonaPicker && (
                            <span title="Shown in customer persona picker">
                              <CheckCircle2 className="h-5 w-5 text-admin-ok" aria-hidden />
                            </span>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTableEl>
            </div>
          )}
        </SectionCard>
      </div>
    </AdminPageChrome>
  );
}
