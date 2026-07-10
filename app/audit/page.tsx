'use client';

export const dynamic = 'force-dynamic';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import Link from 'next/link';
import { 
  ShieldCheckIcon, 
  UserCircleIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

// Action type badges
const getActionBadge = (action: string) => {
  if (action.includes('create') || action.includes('CREATE')) {
    return { bg: 'bg-green-100', text: 'text-green-700', label: 'Create' };
  }
  if (action.includes('update') || action.includes('UPDATE') || action.includes('edit')) {
    return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Update' };
  }
  if (action.includes('delete') || action.includes('DELETE') || action.includes('remove')) {
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Delete' };
  }
  if (action.includes('login') || action.includes('LOGIN') || action.includes('auth')) {
    return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Auth' };
  }
  if (action.includes('view') || action.includes('VIEW') || action.includes('read')) {
    return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'View' };
  }
  return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Action' };
};

// Default date range for reset: last 30 days
const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

type GlobalView = 'main_app' | 'platform_admin';
type OrgSource = 'all' | 'platform_admin' | 'org_user';

function AuditLogsContent() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get('org') || undefined;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [userId, setUserId] = useState('');
  const [adminRole, setAdminRole] = useState('');
  /** Global /audit default: main customer app only. */
  const [globalView, setGlobalView] = useState<GlobalView>('main_app');
  /** Org-scoped default: org users (main app) only. */
  const [sourceType, setSourceType] = useState<OrgSource>('org_user');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const ATTENTION_TRIAGE_ACTIONS = [
    'dismiss_stuck_candidate',
    'clear_stuck_dismissal',
    'retry_stuck_candidate',
    'bulk_retry_stuck_candidates',
  ] as const;

  const isPlatformAdminView = !orgId && globalView === 'platform_admin';
  const isMainAppView = !orgId && globalView === 'main_app';

  const isAttentionTriage =
    isPlatformAdminView &&
    (actionFilter === 'stuck' ||
      ATTENTION_TRIAGE_ACTIONS.some((a) => actionFilter === a));

  const orgAuditQuery = trpc.platformAdmin.getOrgAuditLogs.useQuery(
    {
      orgId: orgId!,
      page,
      limit,
      sourceType,
      userId: userId || undefined,
      action: actionFilter === 'stuck' ? 'stuck' : actionFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: !!orgId }
  );

  const mainAppAuditQuery = (trpc.platformAdmin as any).getMainAppAuditLogs.useQuery(
    {
      page,
      limit,
      userId: userId || undefined,
      action: actionFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: isMainAppView }
  );

  const platformAuditQuery = trpc.platformAdmin.getAuditLogs.useQuery(
    {
      page,
      limit,
      orgId,
      adminUserId: userId || undefined,
      adminRole: (adminRole as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT') || undefined,
      action: actionFilter === 'stuck' ? 'stuck' : actionFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: isPlatformAdminView }
  );

  const data = orgId
    ? orgAuditQuery.data
    : isMainAppView
      ? mainAppAuditQuery.data
      : platformAuditQuery.data;
  const isLoading = orgId
    ? orgAuditQuery.isLoading
    : isMainAppView
      ? mainAppAuditQuery.isLoading
      : platformAuditQuery.isLoading;
  const error = orgId
    ? orgAuditQuery.error
    : isMainAppView
      ? mainAppAuditQuery.error
      : platformAuditQuery.error;

  const { data: platformAdmins = [] } = trpc.platformAdmin.listPlatformAdmins.useQuery(
    undefined,
    { enabled: isPlatformAdminView }
  );
  const { data: orgUsers = [] } = trpc.platformAdmin.listOrgUsers.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const actionSource: 'main_app' | 'platform_admin' | 'all' = orgId
    ? sourceType === 'org_user'
      ? 'main_app'
      : sourceType === 'platform_admin'
        ? 'platform_admin'
        : 'all'
    : globalView === 'main_app'
      ? 'main_app'
      : 'platform_admin';

  const { data: actionTypes = [] } = trpc.platformAdmin.getAuditActionTypes.useQuery({
    orgId,
    includeOrgActivity: orgId ? sourceType !== 'platform_admin' : globalView === 'main_app',
    ...( { source: actionSource } as any ),
  });

  const userOptions = orgId ? orgUsers : isPlatformAdminView ? platformAdmins : [];
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;
  const hasFilters =
    userId ||
    adminRole ||
    (orgId && sourceType !== 'org_user') ||
    (!orgId && globalView !== 'main_app') ||
    actionFilter ||
    startDate ||
    endDate;

  const subtitle = orgId
    ? sourceType === 'org_user'
      ? 'Customer app activity for this organization'
      : sourceType === 'platform_admin'
        ? 'Platform admin actions targeting this organization'
        : 'Customer app activity + platform admin actions for this organization'
    : globalView === 'main_app'
      ? 'Customer app (insighthire-web) activity across organizations'
      : 'Platform admin console actions (mutations & triage — not navigation)';

  return (
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheckIcon className="h-8 w-8 text-teal-700" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trackability</p>
              <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
          {orgId && (
            <Link
              href="/audit"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              <XMarkIcon className="h-4 w-4" />
              View all logs
            </Link>
          )}
        </div>

        {!orgId && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">View:</span>
            <button
              type="button"
              onClick={() => {
                setGlobalView('main_app');
                setActionFilter('');
                setUserId('');
                setAdminRole('');
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold border ${
                globalView === 'main_app'
                  ? 'border-teal-600 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Main app
            </button>
            <button
              type="button"
              onClick={() => {
                setGlobalView('platform_admin');
                setActionFilter('');
                setUserId('');
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold border ${
                globalView === 'platform_admin'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Platform admin
            </button>
            {isPlatformAdminView && (
              <>
                <span className="text-slate-300 mx-1">|</span>
                <span className="text-xs font-medium text-slate-500">Quick filters:</span>
                <button
                  type="button"
                  onClick={() => {
                    setActionFilter('stuck');
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold border ${
                    isAttentionTriage
                      ? 'border-teal-600 bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Attention triage
                </button>
                <Link
                  href="/attention"
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open Attention →
                </Link>
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-gray-900">{data?.total || 0}</div>
            <div className="text-sm text-gray-500">Total Logs</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-green-600">
              {data?.logs?.filter((l: any) => l.action?.toLowerCase().includes('create')).length || 0}
            </div>
            <div className="text-sm text-gray-500">Creates (this page)</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-blue-600">
              {data?.logs?.filter((l: any) => l.action?.toLowerCase().includes('update')).length || 0}
            </div>
            <div className="text-sm text-gray-500">Updates (this page)</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-red-600">
              {data?.logs?.filter((l: any) => l.action?.toLowerCase().includes('delete')).length || 0}
            </div>
            <div className="text-sm text-gray-500">Deletes (this page)</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-6">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-gray-900">Filters</span>
              {hasFilters && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <span className="text-gray-400 text-sm">{showFilters ? 'Hide' : 'Show'}</span>
          </button>
          {showFilters && (
            <div className="px-4 pb-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 border-t">
              {(orgId || isPlatformAdminView) && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {orgId ? 'User' : 'Admin User'}
                  </label>
                  <select
                    value={userId}
                    onChange={(e) => { setUserId(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All {orgId ? 'users' : 'admins'}</option>
                    {userOptions.map((a: { id: string; email: string; name: string }) => (
                      <option key={a.id} value={a.id}>{a.name || a.email}</option>
                    ))}
                  </select>
                </div>
              )}
              {orgId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
                  <select
                    value={sourceType}
                    onChange={(e) => { setSourceType(e.target.value as OrgSource); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="org_user">Main app (org users)</option>
                    <option value="platform_admin">Platform Admin only</option>
                    <option value="all">All (Admin + Org Users)</option>
                  </select>
                </div>
              )}
              {isPlatformAdminView && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Admin Role</label>
                  <select
                    value={adminRole}
                    onChange={(e) => { setAdminRole(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All roles</option>
                    <option value="PLATFORM_ADMIN">Platform Admin</option>
                    <option value="PLATFORM_SUPPORT">Platform Support</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Action Type</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All actions</option>
                  {isPlatformAdminView && (
                    <option value="stuck">Attention triage (dismiss / retry / undo)</option>
                  )}
                  {actionTypes.map((a: string) => (
                    <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    setUserId('');
                    setAdminRole('');
                    setGlobalView('main_app');
                    setSourceType('org_user');
                    setActionFilter('');
                    const { startDate: s, endDate: e } = getDefaultDates();
                    setStartDate(s);
                    setEndDate(e);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading audit logs...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-600">Error loading logs: {error.message}</p>
            </div>
          ) : data?.logs && data.logs.length > 0 ? (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resource
                    </th>
                    {orgId && sourceType === 'all' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Source
                      </th>
                    )}
                    {!orgId && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Target Org
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.logs.map((log: any) => {
                    const badge = getActionBadge(log.action || '');
                    const metadata = log.metadata || {};
                    
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <UserCircleIcon className="h-8 w-8 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {log.user?.name || log.user?.email || 'System'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {log.user?.email || 'No user'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                          <div className="text-sm text-gray-900 mt-1">
                            {log.action || 'Unknown action'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {log.resource ? (
                            <div>
                              <span className="text-sm text-gray-900 capitalize">{(log.resource || '').replace(/_/g, ' ')}</span>
                              {log.resourceId && (
                                <div className="text-xs text-gray-500 font-mono mt-1">
                                  {String(log.resourceId).slice(0, 12)}…
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        {orgId && sourceType === 'all' && (
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              log.sourceType === 'platform_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {log.sourceType === 'platform_admin' ? 'Platform Admin' : 'Org User'}
                            </span>
                          </td>
                        )}
                        {!orgId && (
                          <td className="px-4 py-4">
                            {log.targetOrgId ? (
                              <Link
                                href={`/audit?org=${log.targetOrgId}`}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-mono"
                              >
                                {log.targetOrgId.slice(0, 12)}…
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            {log.ipAddress && (
                              <div className="flex items-center text-xs text-gray-500">
                                <GlobeAltIcon className="h-3 w-3 mr-1" />
                                {log.ipAddress}
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="flex items-center text-xs text-gray-500">
                                <ComputerDesktopIcon className="h-3 w-3 mr-1" />
                                <span className="truncate max-w-[150px]" title={log.userAgent}>
                                  {log.userAgent.includes('Chrome') ? 'Chrome' :
                                   log.userAgent.includes('Firefox') ? 'Firefox' :
                                   log.userAgent.includes('Safari') ? 'Safari' :
                                   log.userAgent.includes('Edge') ? 'Edge' : 'Browser'}
                                </span>
                              </div>
                            )}
                            {Object.keys(metadata).length > 0 && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800">
                                  View metadata
                                </summary>
                                <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-w-xs">
                                  {JSON.stringify(metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination - always show */}
              <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    Showing {data.total === 0 ? 0 : ((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total} logs
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Per page:</span>
                    <select
                      value={limit}
                      onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                      className="px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    >
                      {[10, 20, 50, 100].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || data.total === 0}
                    className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <span className="px-4 py-2 text-sm">
                    Page {page} of {Math.max(1, totalPages)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || data.total === 0}
                    className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <ShieldCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No audit logs found</p>
              <p className="text-sm text-gray-400 mt-1">
                {hasFilters
                  ? 'Try adjusting your filters or date range'
                  : orgId
                    ? 'No customer-app activity for this org yet'
                    : globalView === 'main_app'
                      ? 'Customer app actions (invites, questions, positions, etc.) will appear here'
                      : 'Platform admin mutations will appear here when admins create orgs, update subscriptions, triage Attention, etc.'}
              </p>
            </div>
          )}
        </div>
      </div>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 text-gray-500">Loading audit logs...</span>
        </div>
      </div>
    }>
      <AuditLogsContent />
    </Suspense>
  );
}
