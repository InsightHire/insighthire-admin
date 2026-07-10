'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowPathIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline';
import { formatDate, MiniStat } from '../_utils';
import { EmailMessageModal } from '../_message-modal';

type EmailStatus = 'SENT' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'FAILED' | 'ALL';
type ProviderFilter = 'resend' | 'mailgun' | 'ALL';

function ProviderBadge({ provider }: { provider?: string | null }) {
  const p = (provider || '').toLowerCase();
  if (p === 'mailgun') {
    return (
      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-50 text-orange-800 border border-orange-200">
        Mailgun
      </span>
    );
  }
  if (p === 'resend') {
    return (
      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-50 text-violet-800 border border-violet-200">
        Resend
      </span>
    );
  }
  return (
    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-50 text-gray-600 border border-gray-200">
      {provider || '—'}
    </span>
  );
}

function SentEmailsInner() {
  const { isLoading: authLoading } = useAdminAuth();
  const searchParams = useSearchParams();
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('ALL');
  const [emailOrganizationId, setEmailOrganizationId] = useState('');
  const [emailPositionId, setEmailPositionId] = useState('');
  const [provider, setProvider] = useState<ProviderFilter>('ALL');
  const [missingBody, setMissingBody] = useState(false);
  const [emailPage, setEmailPage] = useState(1);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [messageModalId, setMessageModalId] = useState<string | null>(null);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'FAILED' || status === 'BOUNCED' || status === 'OPENED' || status === 'CLICKED' || status === 'SENT' || status === 'ALL') {
      setEmailStatus(status);
    }
    if (searchParams.get('missingBody') === '1') setMissingBody(true);
    const p = searchParams.get('provider');
    if (p === 'resend' || p === 'mailgun' || p === 'ALL') setProvider(p);
  }, [searchParams]);

  const { data: orgsData } = trpc.platformAdmin.listOrganizations.useQuery({ page: 1, limit: 100 }, { enabled: !authLoading, retry: false });
  const { data: positionsData } = trpc.platformAdmin.getOrganizationPositions.useQuery(
    { organizationId: emailOrganizationId, limit: 100 },
    { enabled: !authLoading && !!emailOrganizationId }
  );
  const { data: emailData, isLoading: emailLoading, refetch: refetchEmails } = trpc.platformAdmin.getEmailSends.useQuery(
    {
      status: emailStatus,
      organizationId: emailOrganizationId || undefined,
      positionId: emailPositionId || undefined,
      provider,
      missingBody: missingBody || undefined,
      page: emailPage,
      limit: 25,
    },
    { enabled: !authLoading, retry: false }
  );
  const { data: emailBodyData } = trpc.platformAdmin.getEmailSendBody.useQuery(
    { id: expandedEmail! },
    { enabled: !authLoading && !!expandedEmail }
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
        <strong className="font-semibold">Durable archive:</strong> full subject + HTML/text live in{' '}
        <code className="font-mono text-xs">email_sends</code> past Resend/Mailgun retention.
        Use “Missing body” to find gaps. E2E fixture recipients are hidden from this list.
      </div>
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        <select value={emailOrganizationId} onChange={(e) => { setEmailOrganizationId(e.target.value); setEmailPositionId(''); setEmailPage(1); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white">
          <option value="">All accounts</option>
          {orgsData?.organizations?.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <select value={emailPositionId} onChange={(e) => { setEmailPositionId(e.target.value); setEmailPage(1); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white" disabled={!emailOrganizationId}>
          <option value="">All positions / Indeed addresses</option>
          {positionsData?.positions?.map((p: any) => <option key={p.id} value={p.id}>{p.title}{p.inboundEmailToken ? ` (${p.inboundEmailToken})` : ''}</option>)}
        </select>
        <select value={emailStatus} onChange={(e) => { setEmailStatus(e.target.value as EmailStatus); setEmailPage(1); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white">
          <option value="ALL">All status</option>
          <option value="OPENED">Opened</option>
          <option value="CLICKED">Clicked</option>
          <option value="BOUNCED">Bounced</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={provider} onChange={(e) => { setProvider(e.target.value as ProviderFilter); setEmailPage(1); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white">
          <option value="ALL">All providers</option>
          <option value="resend">Resend</option>
          <option value="mailgun">Mailgun</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={missingBody}
            onChange={(e) => { setMissingBody(e.target.checked); setEmailPage(1); }}
            className="rounded border-gray-300"
          />
          Missing body
        </label>
        <button onClick={() => refetchEmails()} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800">
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      {emailData?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Total Sent" value={emailData.stats.total} color="blue" />
          <MiniStat label="Opened" value={emailData.stats.opened} color="green" suffix={`(${emailData.stats.openRate}%)`} />
          <MiniStat label="Clicked" value={emailData.stats.clicked} color="purple" suffix={`(${emailData.stats.clickRate}%)`} />
          <MiniStat label="Bounced" value={emailData.stats.bounced} color="red" suffix={`(${emailData.stats.bounceRate}%)`} />
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {emailLoading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" /></div>
        ) : emailData?.items.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No emails found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position / Indeed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {emailData?.items.map((item: any) => (
                <>
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setMessageModalId(item.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.recipientName || item.recipientEmail}</div>
                      {item.recipientName && <div className="text-xs text-gray-500">{item.recipientEmail}</div>}
                      <div className="text-xs text-gray-400">{item.organizationName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-[250px] truncate" title={item.subject}>{item.subject}</div>
                      {item.hasBody === false && (
                        <span className="text-[10px] text-amber-700">Missing body</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{item.templateName}</div>
                      {item.templateCategory && <div className="text-xs text-gray-400">{item.templateCategory}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.positionTitle ? (<><div>{item.positionTitle}</div>{item.inboundEmailToken && <div className="text-xs text-gray-500 font-mono">{item.inboundEmailToken}</div>}</>) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(item.sentAt)}
                      <div className="mt-1"><ProviderBadge provider={item.provider} /></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs">
                        {item.openedAt && <span className="flex items-center text-green-600" title={`Opened: ${formatDate(item.openedAt)}`}><EyeIcon className="h-4 w-4 mr-1" />{item.openCount}</span>}
                        {item.clickedAt && <span className="flex items-center text-purple-600" title={`Clicked: ${formatDate(item.clickedAt)}`}><CursorArrowRaysIcon className="h-4 w-4 mr-1" />{item.clickCount}</span>}
                        {!item.openedAt && !item.clickedAt && !item.bouncedAt && <span className="text-gray-400">No engagement yet</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {item.bouncedAt ? <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">Bounced</span> : item.unsubscribedAt ? <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">Unsubscribed</span> : item.clickedAt ? <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">Clicked</span> : item.openedAt ? <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">Opened</span> : item.status === 'FAILED' ? <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">Failed</span> : <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Delivered</span>}
                      <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedEmail(expandedEmail === item.id ? null : item.id); }} className="ml-2 text-gray-400 hover:text-gray-600">
                        {expandedEmail === item.id ? <ChevronUpIcon className="h-4 w-4 inline" /> : <ChevronDownIcon className="h-4 w-4 inline" />}
                      </button>
                    </td>
                  </tr>
                  {expandedEmail === item.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-gray-50">
                        <div className="space-y-4 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="font-medium mb-2 text-gray-900">Tracking Details:</div>
                              <div className="space-y-1 text-gray-600">
                                <div>Provider Message ID: <span className="font-mono text-xs">{item.providerMessageId || '-'}</span></div>
                                <div>Opened: {formatDate(item.openedAt)} ({item.openCount} times)</div>
                                <div>Clicked: {formatDate(item.clickedAt)} ({item.clickCount} times)</div>
                                {item.bouncedAt && <div className="text-red-600">Bounced: {formatDate(item.bouncedAt)}</div>}
                                {item.bounceReason && <div className="text-red-600">Reason: {item.bounceReason}</div>}
                                {item.unsubscribedAt && <div className="text-orange-600">Unsubscribed: {formatDate(item.unsubscribedAt)}</div>}
                                {item.positionTitle && <div className="text-gray-500">Position: {item.positionTitle}{item.inboundEmailToken ? ` (${item.inboundEmailToken})` : ''}</div>}
                              </div>
                            </div>
                            {item.clickedLinks && Array.isArray(item.clickedLinks) && item.clickedLinks.length > 0 && (
                              <div>
                                <div className="font-medium mb-2 text-gray-900">Clicked Links:</div>
                                <ul className="text-xs text-gray-600 space-y-1">
                                  {(item.clickedLinks as string[]).map((link: string, i: number) => <li key={i} className="truncate" title={link}>{link}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium mb-2 text-gray-900">Email body</div>
                            {emailBodyData ? (
                              <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                {emailBodyData.bodyHtml ? (
                                  <iframe title="Email body" srcDoc={emailBodyData.bodyHtml} className="w-full min-h-[320px] max-h-[480px] border-0" sandbox="allow-same-origin" />
                                ) : (
                                  <pre className="p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-auto">{emailBodyData.bodyText || '(no body)'}</pre>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-500">Loading...</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
        {emailData && emailData.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">Page {emailData.page} of {emailData.totalPages} ({emailData.total} total)</div>
            <div className="flex gap-2">
              <button onClick={() => setEmailPage((p) => Math.max(1, p - 1))} disabled={emailPage === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Previous</button>
              <button onClick={() => setEmailPage((p) => Math.min(emailData.totalPages, p + 1))} disabled={emailPage === emailData.totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
      {messageModalId && (
        <EmailMessageModal type="sent" sentEmailId={messageModalId} mailgunStorageKey={null} mailgunMeta={null} onClose={() => setMessageModalId(null)} />
      )}
    </div>
  );
}

export default function SentEmailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <SentEmailsInner />
    </Suspense>
  );
}
