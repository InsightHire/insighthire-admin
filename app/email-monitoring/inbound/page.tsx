'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { DataTableEl, Th } from '@/components/admin/data-table';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, selectClass } from '@/components/admin/controls';
import { ArrowPathIcon, FunnelIcon, InboxArrowDownIcon } from '@heroicons/react/24/outline';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-admin-sm border border-admin-border bg-admin-bg px-4 py-3 text-sm text-admin-secondary">
        <strong className="font-semibold">Durable archive:</strong> inbound bodies are kept in{' '}
        <code className="font-mono text-xs">inbound_email_logs</code> past Mailgun retention.
        Only GDPR candidate erasure removes them — there is no TTL purge.
      </div>

      <div className="admin-panel p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-admin-muted" />
          <span className="text-sm font-medium text-admin-secondary">Filters:</span>
        </div>
        <select
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            setPage(1);
          }}
          className={`${selectClass} py-1.5`}
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
          className={`${selectClass} py-1.5`}
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
          className={`${buttonClass.secondary} ml-auto`}
        >
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="admin-panel overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent mx-auto" />
          </div>
        ) : !data?.items?.length ? (
          <EmptyState compact className="border-0 shadow-none" icon={<InboxArrowDownIcon />} title="No inbound emails found" />
        ) : (
          <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Subject</Th>
                <Th>Org</Th>
                <Th>Received</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setMessageModalId(item.id)}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm text-admin-ink truncate max-w-[180px]" title={item.fromEmail}>
                      {item.fromEmail}
                    </div>
                    {item.candidateName && (
                      <div className="text-xs text-admin-muted">{item.candidateName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-muted font-mono text-xs truncate max-w-[160px]" title={item.toEmail}>
                    {item.toEmail}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-admin-ink max-w-[220px] truncate" title={item.subject}>
                      {item.subject || '(no subject)'}
                    </div>
                    {!item.hasBody && (
                      <span className="text-[10px] text-amber-700">Missing body</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-muted">
                    <div>{item.organizationName}</div>
                    {item.positionTitle && (
                      <div className="text-xs text-admin-muted">{item.positionTitle}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-muted">{formatDate(item.receivedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </span>
                    {item.source && item.source !== 'UNKNOWN' && (
                      <div className="text-[10px] text-admin-muted mt-0.5">{item.source}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
          </div>
        )}
        {data && data.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-admin-border flex items-center justify-between">
            <div className="text-sm text-admin-muted">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={buttonClass.small}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className={buttonClass.small}
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
