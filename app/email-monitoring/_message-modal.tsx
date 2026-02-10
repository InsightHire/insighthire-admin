'use client';

import { trpc } from '@/lib/trpc';

type Props = {
  type: 'sent' | 'mailgun';
  sentEmailId: string | null;
  mailgunStorageKey: string | null;
  mailgunMeta: { subject?: string; from?: string; to?: string; event?: string } | null;
  onClose: () => void;
};

export function EmailMessageModal({ type, sentEmailId, mailgunStorageKey, mailgunMeta, onClose }: Props) {
  const { data: sentBody, isLoading: sentLoading } = trpc.platformAdmin.getEmailSendBody.useQuery(
    { id: sentEmailId! },
    { enabled: type === 'sent' && !!sentEmailId }
  );
  const { data: mailgunBody, isLoading: mailgunLoading, error: mailgunError } = trpc.platformAdmin.getMailgunStoredMessage.useQuery(
    { storageKey: mailgunStorageKey! },
    { enabled: type === 'mailgun' && !!mailgunStorageKey }
  );

  const isLoading = type === 'sent' ? sentLoading : mailgunLoading;
  const subject = type === 'sent' ? sentBody?.subject : (mailgunBody?.subject ?? mailgunMeta?.subject);
  const bodyHtml = type === 'sent' ? sentBody?.bodyHtml : mailgunBody?.bodyHtml;
  const bodyPlain = type === 'sent' ? sentBody?.bodyText : mailgunBody?.bodyPlain;

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
            {subject || 'Message'}
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
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-sm text-gray-600 flex flex-wrap gap-4">
            {mailgunMeta.from && <span>From: {mailgunMeta.from}</span>}
            {mailgunMeta.to && <span>To: {mailgunMeta.to}</span>}
          </div>
        )}
        <div className="flex-1 overflow-auto p-4 min-h-[200px]">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}
          {type === 'mailgun' && mailgunStorageKey && !isLoading && mailgunError && (
            <div className="text-sm text-amber-700 bg-amber-50 p-4 rounded-lg">
              {mailgunError.message}
            </div>
          )}
          {!isLoading && !mailgunError && (
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
              ) : (
                <p className="text-gray-500">No message body available.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
