'use client';
export const dynamic = 'force-dynamic';

/**
 * Suspicious traffic — IPs generating 4xx/5xx responses against the API in
 * the last hour, with a block list. Blocks apply at the API edge within ~30s
 * and fail open if Redis is unavailable.
 */
import { useState } from 'react';
import { CheckCircle2, Network, ShieldAlert } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { cn } from '@/lib/cn';
import { buttonClass } from '@/components/admin/controls';

export default function TrafficPage() {
  useAdminAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const utils = (trpc as any).useUtils();
  const [error, setError] = useState<string | null>(null);

  const traffic = (trpc as any).platformAdmin.getSuspiciousTraffic.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 60_000,
  });
  const invalidate = () => (utils as any).platformAdmin.getSuspiciousTraffic.invalidate();

  const block = (trpc as any).platformAdmin.blockIp.useMutation({
    onSuccess: () => { setError(null); invalidate(); },
    onError: (e: { message: string }) => setError(e.message),
  });
  const unblock = (trpc as any).platformAdmin.unblockIp.useMutation({
    onSuccess: () => { setError(null); invalidate(); },
    onError: (e: { message: string }) => setError(e.message),
  });

  const ips: any[] = traffic.data?.ips ?? [];

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<ShieldAlert />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Traffic' }]}
        title="Traffic"
        description="IPs with failed API requests (4xx/5xx) in the last hour. Blocking an IP returns 429 to all its API requests within ~30 seconds."
      >
        <div className="space-y-4">
          {error && (
            <p className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <SectionCard
            icon={<Network />}
            title="Failing IPs"
            description="Refreshes every minute"
            padded={false}
            footer={
              traffic.data?.checkedAt
                ? `Last checked ${new Date(traffic.data.checkedAt).toLocaleString()} · counters reset hourly`
                : undefined
            }
          >
            {traffic.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : ips.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="No failed requests in the last hour." />
            ) : (
              <div className="overflow-x-auto">
                <DataTableEl>
                  <thead>
                    <tr>
                      <Th>IP</Th>
                      <Th className="text-right">4xx</Th>
                      <Th className="text-right">5xx</Th>
                      <Th className="text-right">Total</Th>
                      <Th className="text-right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.map((row) => (
                      <tr key={row.ip}>
                        <Td className="font-mono text-admin-ink">
                          {row.ip}
                          {row.blocked && (
                            <StatusPill tone="danger" className="ml-2 font-sans">blocked</StatusPill>
                          )}
                        </Td>
                        <Td className="text-right tabular-nums">{row.count4xx}</Td>
                        <Td className="text-right tabular-nums text-admin-danger">{row.count5xx}</Td>
                        <Td className="text-right font-medium tabular-nums text-admin-ink">{row.total}</Td>
                        <Td className="text-right">
                          {!isSuperAdmin ? (
                            <span className="text-xs text-admin-muted">Super admin only</span>
                          ) : row.blocked ? (
                            <button
                              onClick={() => unblock.mutate({ ip: row.ip })}
                              disabled={unblock.isPending}
                              className={buttonClass.small}
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (window.confirm(`Block ${row.ip}? All its API requests get 429.`)) {
                                  block.mutate({ ip: row.ip });
                                }
                              }}
                              disabled={block.isPending}
                              className={cn(buttonClass.small, 'border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50')}
                            >
                              Block
                            </button>
                          )}
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
    </AuthenticatedLayout>
  );
}
