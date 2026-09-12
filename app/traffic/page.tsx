'use client';
export const dynamic = 'force-dynamic';

/**
 * Suspicious traffic — IPs generating 4xx/5xx responses against the API in
 * the last hour, with a block list. Blocks apply at the API edge within ~30s
 * and fail open if Redis is unavailable.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traffic</h1>
          <p className="text-sm text-gray-500">
            IPs with failed API requests (4xx/5xx) in the last hour. Blocking an IP
            returns 429 to all its API requests within ~30 seconds.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {traffic.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : ips.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">
              No failed requests in the last hour.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium">IP</th>
                  <th className="text-right px-4 py-2 font-medium">4xx</th>
                  <th className="text-right px-4 py-2 font-medium">5xx</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {ips.map((row) => (
                  <tr key={row.ip} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {row.ip}
                      {row.blocked && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-800 font-sans">blocked</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">{row.count4xx}</td>
                    <td className="px-4 py-2 text-right text-red-600">{row.count5xx}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{row.total}</td>
                    <td className="px-4 py-2 text-right">
                      {!isSuperAdmin ? (
                        <span className="text-xs text-gray-400">Super admin only</span>
                      ) : row.blocked ? (
                        <button
                          onClick={() => unblock.mutate({ ip: row.ip })}
                          disabled={unblock.isPending}
                          className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
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
                          className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        >
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {traffic.data?.checkedAt && (
          <p className="text-xs text-gray-400">
            Last checked {new Date(traffic.data.checkedAt).toLocaleString()} · counters reset hourly
          </p>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
