'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  EnvelopeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  CursorArrowRaysIcon,
} from '@heroicons/react/24/outline';

type DigestStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'ALL';
type DeliveryMethod = 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST' | 'ALL';
type EmailStatus = 'SENT' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'FAILED' | 'ALL';

export default function EmailMonitoringPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'digest' | 'emails' | 'stats'>('stats');
  
  // Digest filters
  const [digestStatus, setDigestStatus] = useState<DigestStatus>('ALL');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('ALL');
  const [digestPage, setDigestPage] = useState(1);
  
  // Email filters
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('ALL');
  const [emailPage, setEmailPage] = useState(1);
  
  // Expanded items
  const [expandedDigest, setExpandedDigest] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  // Organizations for filter
  const { data: orgsData } = trpc.platformAdmin.listOrganizations.useQuery(
    { page: 1 },
    { enabled: !authLoading, retry: false }
  );

  // Stats query
  const { data: statsData, isLoading: statsLoading } = trpc.platformAdmin.getEmailStats.useQuery(
    { days: 7 },
    { enabled: !authLoading && activeTab === 'stats', retry: false, refetchInterval: 30000 }
  );

  // Digest queue query
  const { data: digestData, isLoading: digestLoading, refetch: refetchDigest } = trpc.platformAdmin.getDigestQueue.useQuery(
    { status: digestStatus, deliveryMethod, page: digestPage, limit: 25 },
    { enabled: !authLoading && activeTab === 'digest', retry: false }
  );

  // Email sends query
  const { data: emailData, isLoading: emailLoading, refetch: refetchEmails } = trpc.platformAdmin.getEmailSends.useQuery(
    { status: emailStatus, page: emailPage, limit: 25 },
    { enabled: !authLoading && activeTab === 'emails', retry: false }
  );

  // Mutations
  const retryMutation = trpc.platformAdmin.retryDigestNotification.useMutation({
    onSuccess: () => refetchDigest(),
  });
  const cancelMutation = trpc.platformAdmin.cancelDigestNotification.useMutation({
    onSuccess: () => refetchDigest(),
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      SENT: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
      OPENED: 'bg-blue-100 text-blue-800',
      CLICKED: 'bg-purple-100 text-purple-800',
      BOUNCED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const getDeliveryBadge = (method: string) => {
    const styles: Record<string, string> = {
      IMMEDIATE: 'bg-blue-100 text-blue-800',
      DAILY_DIGEST: 'bg-indigo-100 text-indigo-800',
      WEEKLY_DIGEST: 'bg-purple-100 text-purple-800',
    };
    return styles[method] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Email & Digest Monitoring</h1>
        <p className="text-gray-500 mt-1">Track digest notifications, email delivery, and engagement metrics</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'stats', label: 'Overview', icon: ChartIcon },
            { id: 'digest', label: 'Digest Queue', icon: ClockIcon },
            { id: 'emails', label: 'Sent Emails', icon: EnvelopeIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : statsData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Digest Pending"
                  value={statsData.digest.pending}
                  icon={ClockIcon}
                  color="yellow"
                />
                <StatCard
                  title="Digest Sent"
                  value={statsData.digest.sent}
                  icon={CheckCircleIcon}
                  color="green"
                />
                <StatCard
                  title="Digest Failed"
                  value={statsData.digest.failed}
                  icon={XCircleIcon}
                  color="red"
                />
                <StatCard
                  title="Emails Sent"
                  value={statsData.emails.sent}
                  icon={EnvelopeIcon}
                  color="blue"
                />
              </div>

              {/* Email Metrics */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Email Performance ({statsData.period})</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{statsData.emails.openRate}%</div>
                    <div className="text-sm text-gray-500 mt-1">Open Rate</div>
                    <div className="text-xs text-gray-400">{statsData.emails.opened} opened</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">{statsData.emails.bounceRate}%</div>
                    <div className="text-sm text-gray-500 mt-1">Bounce Rate</div>
                    <div className="text-xs text-gray-400">{statsData.emails.bounced} bounced</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{statsData.emails.sent}</div>
                    <div className="text-sm text-gray-500 mt-1">Total Sent</div>
                    <div className="text-xs text-gray-400">{statsData.period}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">No data available</div>
          )}
        </div>
      )}

      {/* Digest Queue Tab */}
      {activeTab === 'digest' && (
        <div className="space-y-4">
          {/* Filters */}
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
            <button
              onClick={() => refetchDigest()}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Stats Summary */}
          {digestData?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Pending" value={digestData.stats.byStatus.PENDING} color="yellow" />
              <MiniStat label="Sent" value={digestData.stats.byStatus.SENT} color="green" />
              <MiniStat label="Failed" value={digestData.stats.byStatus.FAILED} color="red" />
              <MiniStat label="Cancelled" value={digestData.stats.byStatus.CANCELLED} color="gray" />
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {digestLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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
                  {digestData?.items.map((item) => (
                    <>
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.userName}</div>
                          <div className="text-xs text-gray-500">{item.userEmail}</div>
                          <div className="text-xs text-gray-400">{item.organizationName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{item.notificationType.replace(/_/g, ' ')}</span>
                          {item.candidateName && (
                            <div className="text-xs text-gray-500">Re: {item.candidateName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getDeliveryBadge(item.deliveryMethod)}`}>
                            {item.deliveryMethod.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                          {item.errorMessage && (
                            <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={item.errorMessage}>
                              {item.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(item.scheduledFor)}
                          {item.sentAt && (
                            <div className="text-xs text-green-600">Sent: {formatDate(item.sentAt)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedDigest(expandedDigest === item.id ? null : item.id)}
                              className="text-gray-400 hover:text-gray-600"
                              title="View details"
                            >
                              {expandedDigest === item.id ? (
                                <ChevronUpIcon className="h-5 w-5" />
                              ) : (
                                <ChevronDownIcon className="h-5 w-5" />
                              )}
                            </button>
                            {item.status === 'FAILED' && (
                              <button
                                onClick={() => retryMutation.mutate({ notificationId: item.id })}
                                disabled={retryMutation.isPending}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                Retry
                              </button>
                            )}
                            {item.status === 'PENDING' && (
                              <button
                                onClick={() => cancelMutation.mutate({ notificationId: item.id })}
                                disabled={cancelMutation.isPending}
                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedDigest === item.id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50">
                            <div className="text-sm">
                              <div className="font-medium mb-2">Event Data:</div>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                {JSON.stringify(item.eventData, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {digestData && digestData.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {digestData.page} of {digestData.totalPages} ({digestData.total} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDigestPage(p => Math.max(1, p - 1))}
                    disabled={digestPage === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setDigestPage(p => Math.min(digestData.totalPages, p + 1))}
                    disabled={digestPage === digestData.totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sent Emails Tab */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            </div>
            <select
              value={emailStatus}
              onChange={(e) => { setEmailStatus(e.target.value as EmailStatus); setEmailPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white"
            >
              <option value="ALL">All Emails</option>
              <option value="OPENED">Opened</option>
              <option value="CLICKED">Clicked</option>
              <option value="BOUNCED">Bounced</option>
              <option value="FAILED">Failed</option>
            </select>
            <button
              onClick={() => refetchEmails()}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Stats Summary */}
          {emailData?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Total Sent" value={emailData.stats.total} color="blue" />
              <MiniStat label="Opened" value={emailData.stats.opened} color="green" suffix={`(${emailData.stats.openRate}%)`} />
              <MiniStat label="Clicked" value={emailData.stats.clicked} color="purple" suffix={`(${emailData.stats.clickRate}%)`} />
              <MiniStat label="Bounced" value={emailData.stats.bounced} color="red" suffix={`(${emailData.stats.bounceRate}%)`} />
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {emailLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : emailData?.items.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No emails found</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {emailData?.items.map((item) => (
                    <>
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.recipientName || item.recipientEmail}</div>
                          {item.recipientName && (
                            <div className="text-xs text-gray-500">{item.recipientEmail}</div>
                          )}
                          <div className="text-xs text-gray-400">{item.organizationName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 max-w-[250px] truncate" title={item.subject}>
                            {item.subject}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700">{item.templateName}</div>
                          {item.templateCategory && (
                            <div className="text-xs text-gray-400">{item.templateCategory}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(item.sentAt)}
                          <div className="text-xs text-gray-400">via {item.provider}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 text-xs">
                            {item.openedAt && (
                              <span className="flex items-center text-green-600" title={`Opened: ${formatDate(item.openedAt)}`}>
                                <EyeIcon className="h-4 w-4 mr-1" />
                                {item.openCount}
                              </span>
                            )}
                            {item.clickedAt && (
                              <span className="flex items-center text-purple-600" title={`Clicked: ${formatDate(item.clickedAt)}`}>
                                <CursorArrowRaysIcon className="h-4 w-4 mr-1" />
                                {item.clickCount}
                              </span>
                            )}
                            {!item.openedAt && !item.clickedAt && !item.bouncedAt && (
                              <span className="text-gray-400">No engagement yet</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.bouncedAt ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              Bounced
                            </span>
                          ) : item.unsubscribedAt ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                              Unsubscribed
                            </span>
                          ) : item.clickedAt ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              Clicked
                            </span>
                          ) : item.openedAt ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Opened
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              Delivered
                            </span>
                          )}
                          <button
                            onClick={() => setExpandedEmail(expandedEmail === item.id ? null : item.id)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            {expandedEmail === item.id ? (
                              <ChevronUpIcon className="h-4 w-4 inline" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4 inline" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedEmail === item.id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="font-medium mb-2">Tracking Details:</div>
                                <div className="space-y-1 text-gray-600">
                                  <div>Provider Message ID: <span className="font-mono text-xs">{item.providerMessageId || '-'}</span></div>
                                  <div>Opened: {formatDate(item.openedAt)} ({item.openCount} times)</div>
                                  <div>Clicked: {formatDate(item.clickedAt)} ({item.clickCount} times)</div>
                                  {item.bouncedAt && <div className="text-red-600">Bounced: {formatDate(item.bouncedAt)}</div>}
                                  {item.bounceReason && <div className="text-red-600">Reason: {item.bounceReason}</div>}
                                  {item.unsubscribedAt && <div className="text-orange-600">Unsubscribed: {formatDate(item.unsubscribedAt)}</div>}
                                </div>
                              </div>
                              {item.clickedLinks && Array.isArray(item.clickedLinks) && item.clickedLinks.length > 0 && (
                                <div>
                                  <div className="font-medium mb-2">Clicked Links:</div>
                                  <ul className="text-xs text-gray-600 space-y-1">
                                    {(item.clickedLinks as string[]).map((link, i) => (
                                      <li key={i} className="truncate" title={link}>{link}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {emailData && emailData.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {emailData.page} of {emailData.totalPages} ({emailData.total} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEmailPage(p => Math.max(1, p - 1))}
                    disabled={emailPage === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setEmailPage(p => Math.min(emailData.totalPages, p + 1))}
                    disabled={emailPage === emailData.totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Chart placeholder icon
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

// Stat card component
function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
        </div>
        <div className={`p-3 rounded-full ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

// Mini stat component
function MiniStat({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  const colors: Record<string, string> = {
    yellow: 'border-yellow-300 bg-yellow-50',
    green: 'border-green-300 bg-green-50',
    red: 'border-red-300 bg-red-50',
    blue: 'border-blue-300 bg-blue-50',
    purple: 'border-purple-300 bg-purple-50',
    gray: 'border-gray-300 bg-gray-50',
  };

  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-semibold text-gray-900">
        {value.toLocaleString()}
        {suffix && <span className="text-xs text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
