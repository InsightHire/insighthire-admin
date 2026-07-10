'use client';

import { trpc } from '@/lib/trpc';

type Props = {
  type: 'sent' | 'mailgun' | 'inbound';
  sentEmailId: string | null;
  inboundEmailId?: string | null;
  mailgunStorageKey: string | null;
  mailgunMeta: { subject?: string; from?: string; to?: string; event?: string; timestamp?: string } | null;
  /** For Mailgun: lookup body from our DB by recipient + subject + time (tried first before Mailgun API) */
  mailgunEventLookup?: { recipient: string; subject: string; timestamp: string } | null;
  onClose: () => void;
};

function formatDate(date: string | Date | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

export function EmailMessageModal({
  type,
  sentEmailId,
  inboundEmailId,
  mailgunStorageKey,
  mailgunMeta,
  mailgunEventLookup,
  onClose,
}: Props) {
  const { data: sentBody, isLoading: sentLoading } = trpc.platformAdmin.getEmailSendBody.useQuery(
    { id: sentEmailId! },
    { enabled: type === 'sent' && !!sentEmailId }
  );
  const { data: inboundBody, isLoading: inboundLoading } = (trpc.platformAdmin as any).getInboundEmailBody.useQuery(
    { id: inboundEmailId! },
    { enabled: type === 'inbound' && !!inboundEmailId }
  );
  const { data: dbEventBody, isLoading: dbEventLoading } = trpc.platformAdmin.getEmailBodyForEvent.useQuery(
    {
      recipient: mailgunEventLookup?.recipient ?? '',
      subject: mailgunEventLookup?.subject ?? '',
      timestamp: mailgunEventLookup?.timestamp ?? '',
    },
    { enabled: type === 'mailgun' && !!mailgunEventLookup?.recipient && !!mailgunEventLookup?.timestamp }
  );
  const { data: mailgunBody, isLoading: mailgunLoading, error: mailgunError } = trpc.platformAdmin.getMailgunStoredMessage.useQuery(
    { storageKey: mailgunStorageKey! },
    { enabled: type === 'mailgun' && !!mailgunStorageKey && !(dbEventBody?.bodyHtml || dbEventBody?.bodyText) }
  );

  const isLoading =
    type === 'sent'
      ? sentLoading
      : type === 'inbound'
        ? inboundLoading
        : dbEventLoading || (mailgunStorageKey && !(dbEventBody?.bodyHtml || dbEventBody?.bodyText) ? mailgunLoading : false);

  const subject =
    type === 'sent'
      ? sentBody?.subject
      : type === 'inbound'
        ? inboundBody?.subject
        : (dbEventBody?.subject ?? mailgunBody?.subject ?? mailgunMeta?.subject);

  const bodyHtml =
    type === 'sent'
      ? sentBody?.bodyHtml
      : type === 'inbound'
        ? inboundBody?.bodyHtml
        : (dbEventBody?.bodyHtml ?? mailgunBody?.bodyHtml);

  const bodyPlain =
    type === 'sent'
      ? sentBody?.bodyText
      : type === 'inbound'
        ? inboundBody?.bodyText
        : (dbEventBody?.bodyText ?? mailgunBody?.bodyPlain);

  const hasMailgunBody = type === 'mailgun' && (bodyHtml || bodyPlain);
  const noMailgunBody = type === 'mailgun' && !(dbEventBody?.bodyHtml || dbEventBody?.bodyText) && !mailgunStorageKey;
  const mailgunBodyFailed =
    type === 'mailgun' &&
    !(dbEventBody?.bodyHtml || dbEventBody?.bodyText) &&
    mailgunStorageKey &&
    !isLoading &&
    (mailgunError || (!mailgunBody?.bodyHtml && !mailgunBody?.bodyPlain));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {type === 'mailgun' && mailgunMeta?.event && (
              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 mr-2">
                {mailgunMeta.event}
              </span>
            )}
            {type === 'inbound' && (
              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 mr-2">
                Inbound
              </span>
            )}
            {subject || 'Event details'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {type === 'mailgun' && mailgunMeta && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-700 space-y-1">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {mailgunMeta.from && <span><strong>From:</strong> {mailgunMeta.from}</span>}
              {mailgunMeta.to && <span><strong>To:</strong> {mailgunMeta.to}</span>}
              {mailgunMeta.timestamp && <span><strong>Time:</strong> {formatDate(mailgunMeta.timestamp)}</span>}
            </div>
            {mailgunMeta.subject && <div><strong>Subject:</strong> {mailgunMeta.subject}</div>}
          </div>
        )}
        {type === 'inbound' && inboundBody && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-700 space-y-1">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>From:</strong> {inboundBody.fromEmail}</span>
              <span><strong>To:</strong> {inboundBody.toEmail}</span>
              <span><strong>Time:</strong> {formatDate(inboundBody.receivedAt)}</span>
              {inboundBody.status && (
                <span><strong>Status:</strong> {inboundBody.status}</span>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto p-4 min-h-[200px]">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}
          {type === 'mailgun' && mailgunStorageKey && !isLoading && mailgunError && (
            <div className="space-y-3">
              <div className="text-sm text-amber-700 bg-amber-50 p-4 rounded-lg">
                {mailgunError.message}
              </div>
              <p className="text-sm text-gray-500">Message body isn’t available for this event.</p>
            </div>
          )}
          {type === 'mailgun' && (noMailgunBody || mailgunBodyFailed) && !isLoading && (
            <p className="text-sm text-gray-500">
              Message body isn’t stored by Mailgun for this event.
            </p>
          )}
          {!isLoading && (type === 'sent' || type === 'inbound' || hasMailgunBody) && (
            <>
              {bodyHtml ? (
                <iframe
                  title="Email body"
                  srcDoc={bodyHtml}
                  className="w-full min-h-[360px] border border-gray-200 rounded-lg"
                  sandbox="allow-same-origin"
                />
              ) : bodyPlain ? (
                <pre className="p-4 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg overflow-auto max-h-[60vh]">
                  {bodyPlain}
                </pre>
              ) : type === 'sent' || type === 'inbound' ? (
                <p className="text-gray-500">No message body available.</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
