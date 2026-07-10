'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowPathIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { formatDate, getStatusBadge, getDeliveryBadge, MiniStat } from '../_utils';

type DigestStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'ALL';
type DeliveryMethod = 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST' | 'ALL';

function DigestQueueInner() {
  const { isLoading: authLoading } = useAdminAuth();
  const searchParams = useSearchParams();
  const [digestStatus, setDigestStatus] = useState<DigestStatus>('ALL');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('ALL');
  const [digestPage, setDigestPage] = useState(1);
  const [expandedDigest, setExpandedDigest] = useState<string | null>(null);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'PENDING' || status === 'SENT' || status === 'FAILED' || status === 'CANCELLED' || status === 'ALL') {
      setDigestStatus(status);
    }
  }, [searchParams]);

  const { data: digestData, isLoading: digestLoading, refetch: refetchDigest } = trpc.platformAdmin.getDigestQueue.useQuery(
    { status: digestStatus, deliveryMethod, page: digestPage, limit: 25 },
    { enabled: !authLoading, retry: false }
  );
  const retryMutation = trpc.platformAdmin.retryDigestNotification.useMutation({ onSuccess: () => refetchDigest() });
  const cancelMutation = trpc.platformAdmin.cancelDigestNotification.useMutation({ onSuccess: () => refetchDigest() });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        <select
          value={digestStatus}
          onChange={(e) => { setDigestStatus(e.target.value as DigestStatus); setDigestPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white"
        >
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={deliveryMethod}
          onChange={(e) => { setDeliveryMethod(e.target.value as DeliveryMethod); setDigestPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white"
        >
          <option value="ALL">All Methods</option>
          <option value="IMMEDIATE">Immediate</option>
          <option value="DAILY_DIGEST">Daily Digest</option>
          <option value="WEEKLY_DIGEST">Weekly Digest</option>
        </select>
        <button onClick={() => refetchDigest()} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800">
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      {digestData?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Pending" value={digestData.stats.byStatus?.PENDING} color="yellow" />
          <MiniStat label="Sent" value={digestData.stats.byStatus?.SENT} color="green" />
          <MiniStat label="Failed" value={digestData.stats.byStatus?.FAILED} color="red" />
          <MiniStat label="Cancelled" value={digestData.stats.byStatus?.CANCELLED} color="gray" />
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {digestLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : digestData?.items.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No notifications found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {digestData?.items.map((item: any) => (
                <>
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.userName}</div>
                      <div className="text-xs text-gray-500">{item.userEmail}</div>
                      <div className="text-xs text-gray-400">{item.organizationName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{item.notificationType.replace(/_/g, ' ')}</span>
                      {item.candidateName && <div className="text-xs text-gray-500">Re: {item.candidateName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getDeliveryBadge(item.deliveryMethod)}`}>
                        {item.deliveryMethod.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(item.status)}`}>{item.status}</span>
                      {item.errorMessage && <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={item.errorMessage}>{item.errorMessage}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(item.scheduledFor)}
                      {item.sentAt && <div className="text-xs text-green-600">Sent: {formatDate(item.sentAt)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedDigest(expandedDigest === item.id ? null : item.id)} className="text-gray-400 hover:text-gray-600" title="View details">
                          {expandedDigest === item.id ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                        </button>
                        {item.status === 'FAILED' && (
                          <button onClick={() => retryMutation.mutate({ notificationId: item.id })} disabled={retryMutation.isPending} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Retry</button>
                        )}
                        {item.status === 'PENDING' && (
                          <button onClick={() => cancelMutation.mutate({ notificationId: item.id })} disabled={cancelMutation.isPending} className="text-red-600 hover:text-red-800 text-xs font-medium">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedDigest === item.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <div className="text-sm">
                          <div className="font-medium mb-2">Event Data:</div>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(item.eventData, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
        {digestData && digestData.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">Page {digestData.page} of {digestData.totalPages} ({digestData.total} total)</div>
            <div className="flex gap-2">
              <button onClick={() => setDigestPage((p) => Math.max(1, p - 1))} disabled={digestPage === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Previous</button>
              <button onClick={() => setDigestPage((p) => Math.min(digestData.totalPages, p + 1))} disabled={digestPage === digestData.totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DigestQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <DigestQueueInner />
    </Suspense>
  );
}
