'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-center">
        <span className="text-sm font-medium text-gray-700">Mailgun domain:</span>
        <span className="font-mono text-sm text-gray-900">{mailgunData?.domain ?? '—'}</span>
        <label className="text-sm text-gray-600">Filter by recipient:</label>
        <input
          type="text"
          value={mailgunRecipient}
          onChange={(e) => setMailgunRecipient(e.target.value)}
          placeholder="email@example.com"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 w-56"
        />
        <button onClick={() => refetchMailgun()} className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800">
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {mailgunLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : !mailgunData?.items?.length ? (
          <div className="text-center text-gray-500 py-12">No Mailgun events or Mailgun not configured</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject / Message</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mailgunData.items.map((ev: any) => (
                <tr
                  key={ev.id}
                  className="hover:bg-gray-50 cursor-pointer"
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
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(ev.event) || 'bg-gray-100 text-gray-800'}`}>
                      {ev.event}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{ev.recipient ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate" title={ev.message}>{ev.message ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{ev.timestamp ? formatDate(ev.timestamp) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ev.reason ?? ev.severity ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-blue-600 hover:text-blue-800 font-medium">View details</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {messageModal && (
        <EmailMessageModal
          type="mailgun"
          sentEmailId={null}
          mailgunStorageKey={messageModal.storageKey ?? null}
          mailgunMeta={{ subject: messageModal.subject, from: messageModal.from, to: messageModal.to ?? messageModal.recipient, event: messageModal.event, timestamp: messageModal.timestamp }}
          onClose={() => setMessageModal(null)}
        />
      )}
    </div>
  );
}
