'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { DataTableEl, Th } from '@/components/admin/data-table';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, selectClass } from '@/components/admin/controls';
import { ArrowPathIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon } from '@heroicons/react/24/outline';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="admin-panel p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-admin-muted" />
          <span className="text-sm font-medium text-admin-secondary">Filters:</span>
        </div>
        <select
          value={digestStatus}
          onChange={(e) => { setDigestStatus(e.target.value as DigestStatus); setDigestPage(1); }}
          className={`${selectClass} py-1.5`}
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
          className={`${selectClass} py-1.5`}
        >
          <option value="ALL">All Methods</option>
          <option value="IMMEDIATE">Immediate</option>
          <option value="DAILY_DIGEST">Daily Digest</option>
          <option value="WEEKLY_DIGEST">Weekly Digest</option>
        </select>
        <button onClick={() => refetchDigest()} className={`${buttonClass.secondary} ml-auto`}>
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      {digestData?.stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Pending" value={digestData.stats.byStatus?.PENDING} color="yellow" />
          <MiniStat label="Sent" value={digestData.stats.byStatus?.SENT} color="green" />
          <MiniStat label="Failed" value={digestData.stats.byStatus?.FAILED} color="red" />
          <MiniStat label="Cancelled" value={digestData.stats.byStatus?.CANCELLED} color="gray" />
        </div>
      )}
      <div className="admin-panel overflow-hidden">
        {digestLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent mx-auto" />
          </div>
        ) : digestData?.items.length === 0 ? (
          <EmptyState compact className="border-0 shadow-none" icon={<ClockIcon />} title="No notifications found" />
        ) : (
          <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Recipient</Th>
                <Th>Type</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th>Scheduled</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {digestData?.items.map((item: any) => (
                <>
                  <tr key={item.id} >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-admin-ink">{item.userName}</div>
                      <div className="text-xs text-admin-muted">{item.userEmail}</div>
                      <div className="text-xs text-admin-muted">{item.organizationName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-admin-secondary">{item.notificationType.replace(/_/g, ' ')}</span>
                      {item.candidateName && <div className="text-xs text-admin-muted">Re: {item.candidateName}</div>}
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
                    <td className="px-4 py-3 text-sm text-admin-muted">
                      {formatDate(item.scheduledFor)}
                      {item.sentAt && <div className="text-xs text-green-600">Sent: {formatDate(item.sentAt)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedDigest(expandedDigest === item.id ? null : item.id)} className="text-admin-muted hover:text-admin-ink" title="View details">
                          {expandedDigest === item.id ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                        </button>
                        {item.status === 'FAILED' && (
                          <button onClick={() => retryMutation.mutate({ notificationId: item.id })} disabled={retryMutation.isPending} className="text-admin-accent hover:text-admin-accent-ink text-xs font-medium">Retry</button>
                        )}
                        {item.status === 'PENDING' && (
                          <button onClick={() => cancelMutation.mutate({ notificationId: item.id })} disabled={cancelMutation.isPending} className="text-red-600 hover:text-red-800 text-xs font-medium">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedDigest === item.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-admin-bg">
                        <div className="text-sm">
                          <div className="font-medium mb-2">Event Data:</div>
                          <pre className="rounded-admin-sm border border-admin-border bg-white p-3 text-xs overflow-x-auto">{JSON.stringify(item.eventData, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </DataTableEl>
          </div>
        )}
        {digestData && digestData.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-admin-border flex items-center justify-between">
            <div className="text-sm text-admin-muted">Page {digestData.page} of {digestData.totalPages} ({digestData.total} total)</div>
            <div className="flex gap-2">
              <button onClick={() => setDigestPage((p) => Math.max(1, p - 1))} disabled={digestPage === 1} className={buttonClass.small}>Previous</button>
              <button onClick={() => setDigestPage((p) => Math.min(digestData.totalPages, p + 1))} disabled={digestPage === digestData.totalPages} className={buttonClass.small}>Next</button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent" />
        </div>
      }
    >
      <DigestQueueInner />
    </Suspense>
  );
}
