'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { DataTableEl, Th } from '@/components/admin/data-table';
import { EmptyState } from '@/components/admin/empty-state';
import { StatusPill } from '@/components/admin/status-pill';
import { buttonClass, checkboxClass, selectClass } from '@/components/admin/controls';
import { ArrowPathIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, CursorArrowRaysIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
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
    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-admin-bg text-admin-muted border border-admin-border">
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-admin-sm border border-admin-border bg-admin-bg px-4 py-3 text-sm text-admin-secondary">
        <strong className="font-semibold">Durable archive:</strong> full subject + HTML/text live in{' '}
        <code className="font-mono text-xs">email_sends</code> past Resend/Mailgun retention.
        Use “Missing body” to find gaps. E2E fixture recipients are hidden from this list.
      </div>
      <div className="admin-panel p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-admin-muted" />
          <span className="text-sm font-medium text-admin-secondary">Filters:</span>
        </div>
        <select value={emailOrganizationId} onChange={(e) => { setEmailOrganizationId(e.target.value); setEmailPositionId(''); setEmailPage(1); }} className={`${selectClass} py-1.5`}>
          <option value="">All accounts</option>
          {orgsData?.organizations?.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <select value={emailPositionId} onChange={(e) => { setEmailPositionId(e.target.value); setEmailPage(1); }} className={`${selectClass} py-1.5`} disabled={!emailOrganizationId}>
          <option value="">All positions / Indeed addresses</option>
          {positionsData?.positions?.map((p: any) => <option key={p.id} value={p.id}>{p.title}{p.inboundEmailToken ? ` (${p.inboundEmailToken})` : ''}</option>)}
        </select>
        <select value={emailStatus} onChange={(e) => { setEmailStatus(e.target.value as EmailStatus); setEmailPage(1); }} className={`${selectClass} py-1.5`}>
          <option value="ALL">All status</option>
          <option value="OPENED">Opened</option>
          <option value="CLICKED">Clicked</option>
          <option value="BOUNCED">Bounced</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={provider} onChange={(e) => { setProvider(e.target.value as ProviderFilter); setEmailPage(1); }} className={`${selectClass} py-1.5`}>
          <option value="ALL">All providers</option>
          <option value="resend">Resend</option>
          <option value="mailgun">Mailgun</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-admin-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={missingBody}
            onChange={(e) => { setMissingBody(e.target.checked); setEmailPage(1); }}
            className={checkboxClass}
          />
          Missing body
        </label>
        <button onClick={() => refetchEmails()} className={`${buttonClass.secondary} ml-auto`}>
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      {emailData?.stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Total Sent" value={emailData.stats.total} color="blue" />
          <MiniStat label="Opened" value={emailData.stats.opened} color="green" suffix={`(${emailData.stats.openRate}%)`} />
          <MiniStat label="Clicked" value={emailData.stats.clicked} color="purple" suffix={`(${emailData.stats.clickRate}%)`} />
          <MiniStat label="Bounced" value={emailData.stats.bounced} color="red" suffix={`(${emailData.stats.bounceRate}%)`} />
        </div>
      )}
      <div className="admin-panel overflow-hidden">
        {emailLoading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent mx-auto" /></div>
        ) : emailData?.items.length === 0 ? (
          <EmptyState compact className="border-0 shadow-none" icon={<EnvelopeIcon />} title="No emails found" />
        ) : (
          <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Recipient</Th>
                <Th>Subject</Th>
                <Th>Template</Th>
                <Th>Position / Indeed</Th>
                <Th>Sent</Th>
                <Th>Engagement</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {emailData?.items.map((item: any) => (
                <>
                  <tr
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setMessageModalId(item.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-admin-ink">{item.recipientName || item.recipientEmail}</div>
                      {item.recipientName && <div className="text-xs text-admin-muted">{item.recipientEmail}</div>}
                      <div className="text-xs text-admin-muted">{item.organizationName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-admin-ink max-w-[250px] truncate" title={item.subject}>{item.subject}</div>
                      {item.hasBody === false && (
                        <span className="text-[10px] text-amber-700">Missing body</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-admin-secondary">{item.templateName}</div>
                      {item.templateCategory && <div className="text-xs text-admin-muted">{item.templateCategory}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-admin-muted">
                      {item.positionTitle ? (<><div>{item.positionTitle}</div>{item.inboundEmailToken && <div className="text-xs text-admin-muted font-mono">{item.inboundEmailToken}</div>}</>) : <span className="text-admin-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-admin-muted">
                      {formatDate(item.sentAt)}
                      <div className="mt-1"><ProviderBadge provider={item.provider} /></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs">
                        {item.openedAt && <span className="flex items-center text-green-600" title={`Opened: ${formatDate(item.openedAt)}`}><EyeIcon className="h-4 w-4 mr-1" />{item.openCount}</span>}
                        {item.clickedAt && <span className="flex items-center text-purple-600" title={`Clicked: ${formatDate(item.clickedAt)}`}><CursorArrowRaysIcon className="h-4 w-4 mr-1" />{item.clickCount}</span>}
                        {!item.openedAt && !item.clickedAt && !item.bouncedAt && <span className="text-admin-muted">No engagement yet</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {item.bouncedAt ? <StatusPill tone="danger">Bounced</StatusPill> : item.unsubscribedAt ? <StatusPill tone="warn">Unsubscribed</StatusPill> : item.clickedAt ? <StatusPill tone="brand">Clicked</StatusPill> : item.openedAt ? <StatusPill tone="success">Opened</StatusPill> : item.status === 'FAILED' ? <StatusPill tone="danger">Failed</StatusPill> : <StatusPill tone="info">Delivered</StatusPill>}
                      <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedEmail(expandedEmail === item.id ? null : item.id); }} className="ml-2 text-admin-muted hover:text-admin-ink">
                        {expandedEmail === item.id ? <ChevronUpIcon className="h-4 w-4 inline" /> : <ChevronDownIcon className="h-4 w-4 inline" />}
                      </button>
                    </td>
                  </tr>
                  {expandedEmail === item.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-admin-bg">
                        <div className="space-y-4 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="font-medium mb-2 text-admin-ink">Tracking Details:</div>
                              <div className="space-y-1 text-admin-muted">
                                <div>Provider Message ID: <span className="font-mono text-xs">{item.providerMessageId || '-'}</span></div>
                                <div>Opened: {formatDate(item.openedAt)} ({item.openCount} times)</div>
                                <div>Clicked: {formatDate(item.clickedAt)} ({item.clickCount} times)</div>
                                {item.bouncedAt && <div className="text-red-600">Bounced: {formatDate(item.bouncedAt)}</div>}
                                {item.bounceReason && <div className="text-red-600">Reason: {item.bounceReason}</div>}
                                {item.unsubscribedAt && <div className="text-orange-600">Unsubscribed: {formatDate(item.unsubscribedAt)}</div>}
                                {item.positionTitle && <div className="text-admin-muted">Position: {item.positionTitle}{item.inboundEmailToken ? ` (${item.inboundEmailToken})` : ''}</div>}
                              </div>
                            </div>
                            {item.clickedLinks && Array.isArray(item.clickedLinks) && item.clickedLinks.length > 0 && (
                              <div>
                                <div className="font-medium mb-2 text-admin-ink">Clicked Links:</div>
                                <ul className="text-xs text-admin-muted space-y-1">
                                  {(item.clickedLinks as string[]).map((link: string, i: number) => <li key={i} className="truncate" title={link}>{link}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium mb-2 text-admin-ink">Email body</div>
                            {emailBodyData ? (
                              <div className="border border-admin-border rounded-lg bg-white overflow-hidden">
                                {emailBodyData.bodyHtml ? (
                                  <iframe title="Email body" srcDoc={emailBodyData.bodyHtml} className="w-full min-h-[320px] max-h-[480px] border-0" sandbox="allow-same-origin" />
                                ) : (
                                  <pre className="p-3 text-xs text-admin-secondary whitespace-pre-wrap max-h-64 overflow-auto">{emailBodyData.bodyText || '(no body)'}</pre>
                                )}
                              </div>
                            ) : (
                              <div className="text-admin-muted">Loading...</div>
                            )}
                          </div>
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
        {emailData && emailData.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-admin-border flex items-center justify-between">
            <div className="text-sm text-admin-muted">Page {emailData.page} of {emailData.totalPages} ({emailData.total} total)</div>
            <div className="flex gap-2">
              <button onClick={() => setEmailPage((p) => Math.max(1, p - 1))} disabled={emailPage === 1} className={buttonClass.small}>Previous</button>
              <button onClick={() => setEmailPage((p) => Math.min(emailData.totalPages, p + 1))} disabled={emailPage === emailData.totalPages} className={buttonClass.small}>Next</button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent" />
        </div>
      }
    >
      <SentEmailsInner />
    </Suspense>
  );
}
