'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { DataTableEl, Th } from '@/components/admin/data-table';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, inputClass } from '@/components/admin/controls';
import { ArrowPathIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { formatDate, getStatusBadge } from '../_utils';
import { EmailMessageModal } from '../_message-modal';

export default function MailgunEventsPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [mailgunRecipient, setMailgunRecipient] = useState('');
  const [messageModal, setMessageModal] = useState<{ storageKey: string | null; subject?: string; from?: string; to?: string; recipient?: string; event?: string; timestamp?: string } | null>(null);

  const { data: mailgunData, isLoading: mailgunLoading, refetch: refetchMailgun } = trpc.platformAdmin.getMailgunEvents.useQuery(
    { recipient: mailgunRecipient || undefined, limit: 50 },
    { enabled: !authLoading, retry: false }
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
      <div className="rounded-admin-sm border border-admin-warn/25 bg-admin-warn-soft px-4 py-3 text-sm text-amber-900">
        <strong className="font-semibold">Ephemeral provider debug:</strong> Mailgun events and stored
        messages expire (~3 days). For durable bodies use{' '}
        <a href="/email-monitoring/sent-emails" className="underline font-medium">Sent Emails</a>
        {' '}or{' '}
        <a href="/email-monitoring/inbound" className="underline font-medium">Inbound</a>.
      </div>
      <div className="admin-panel p-4 flex flex-wrap gap-4 items-center">
        <span className="text-sm font-medium text-admin-secondary">Mailgun domain:</span>
        <span className="font-mono text-sm text-admin-ink">{mailgunData?.domain ?? '—'}</span>
        <label className="text-sm text-admin-muted">Filter by recipient:</label>
        <input
          type="text"
          value={mailgunRecipient}
          onChange={(e) => setMailgunRecipient(e.target.value)}
          placeholder="email@example.com"
          className={`${inputClass} w-56 py-1.5`}
        />
        <button onClick={() => refetchMailgun()} className={`${buttonClass.secondary}`}>
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      <div className="admin-panel overflow-hidden">
        {mailgunLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent mx-auto" />
          </div>
        ) : !mailgunData?.items?.length ? (
          <EmptyState compact className="border-0 shadow-none" icon={<EnvelopeIcon />} title="No Mailgun events or Mailgun not configured" />
        ) : (
          <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Recipient</Th>
                <Th>Subject / Message</Th>
                <Th>Time</Th>
                <Th>Reason</Th>
                <Th>View</Th>
              </tr>
            </thead>
            <tbody>
              {mailgunData.items.map((ev: any) => (
                <tr
                  key={ev.id}
                  className="cursor-pointer"
                  onClick={() => setMessageModal({
                    storageKey: ev.storageKey ?? null,
                    subject: ev.message,
                    from: ev.from,
                    to: ev.recipient,
                    recipient: ev.recipient,
                    event: ev.event,
                    timestamp: ev.timestamp,
                  })}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(ev.event) || 'bg-slate-100 text-admin-secondary'}`}>
                      {ev.event}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-ink">{ev.recipient ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-admin-secondary max-w-[200px] truncate" title={ev.message}>{ev.message ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-admin-muted">{ev.timestamp ? formatDate(ev.timestamp) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-admin-muted">{ev.reason ?? ev.severity ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-admin-accent hover:text-admin-accent-ink font-medium">View details</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
          </div>
        )}
      </div>
      {messageModal && (
        <EmailMessageModal
          type="mailgun"
          sentEmailId={null}
          mailgunStorageKey={messageModal.storageKey ?? null}
          mailgunMeta={{ subject: messageModal.subject, from: messageModal.from, to: messageModal.to ?? messageModal.recipient, event: messageModal.event, timestamp: messageModal.timestamp }}
          mailgunEventLookup={
            messageModal.recipient && messageModal.timestamp
              ? { recipient: messageModal.recipient, subject: messageModal.subject ?? '', timestamp: messageModal.timestamp }
              : null
          }
          onClose={() => setMessageModal(null)}
        />
      )}
    </div>
  );
}
