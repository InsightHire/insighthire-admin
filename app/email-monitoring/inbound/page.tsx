'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowPathIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { formatDate, getStatusBadge } from '../_utils';
import { EmailMessageModal } from '../_message-modal';

type InboundStatus =
  | 'RECEIVED'
  | 'PARSING'
  | 'PARSED'
  | 'CANDIDATE_CREATED'
  | 'DUPLICATE'
  | 'FAILED'
  | 'IGNORED'
  | 'ALL';

export default function InboundEmailsPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [status, setStatus] = useState<InboundStatus>('ALL');
  const [organizationId, setOrganizationId] = useState('');
  const [page, setPage] = useState(1);
  const [messageModalId, setMessageModalId] = useState<string | null>(null);

  const { data: orgsData } = trpc.platformAdmin.listOrganizations.useQuery(
    { page: 1, limit: 100 },
    { enabled: !authLoading, retry: false }
  );
  const { data, isLoading, refetch } = (trpc.platformAdmin as any).listInboundEmailLogs.useQuery(
    {
      status,
      organizationId: organizationId || undefined,
      page,
      limit: 25,
    },
    { enabled: !authLoading, retry: false, refetchInterval: 30000 }
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800">
        <strong className="font-semibold">Durable archive:</strong> inbound bodies are kept in{' '}
        <code className="font-mono text-xs">inbound_email_logs</code> past Mailgun retention.
        Only GDPR candidate erasure removes them — there is no TTL purge.
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        <select
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white"
        >
          <option value="">All accounts</option>
          {orgsData?.organizations?.map((org: any) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as InboundStatus);
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white"
        >
          <option value="ALL">All status</option>
          <option value="RECEIVED">Received</option>
          <option value="PARSED">Parsed</option>
          <option value="CANDIDATE_CREATED">Candidate created</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="FAILED">Failed</option>
          <option value="IGNORED">Ignored</option>
        </select>
        <button
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : !data?.items?.length ? (
          <div className="text-center text-gray-500 py-12">No inbound emails found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Org</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.items.map((item: any) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setMessageModalId(item.id)}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate max-w-[180px]" title={item.fromEmail}>
                      {item.fromEmail}
                    </div>
                    {item.candidateName && (
                      <div className="text-xs text-gray-500">{item.candidateName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs truncate max-w-[160px]" title={item.toEmail}>
                    {item.toEmail}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 max-w-[220px] truncate" title={item.subject}>
                      {item.subject || '(no subject)'}
                    </div>
                    {!item.hasBody && (
                      <span className="text-[10px] text-amber-700">Missing body</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{item.organizationName}</div>
                    {item.positionTitle && (
                      <div className="text-xs text-gray-400">{item.positionTitle}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.receivedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </span>
                    {item.source && item.source !== 'UNKNOWN' && (
                      <div className="text-[10px] text-gray-400 mt-0.5">{item.source}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {messageModalId && (
        <EmailMessageModal
          type="inbound"
          inboundEmailId={messageModalId}
          sentEmailId={null}
          mailgunStorageKey={null}
          mailgunMeta={null}
          onClose={() => setMessageModalId(null)}
        />
      )}
    </div>
  );
}
