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
import { cn } from '@/lib/cn';
import { AdminPage, AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';

// Action type badges
const getActionBadge = (action: string): { tone: StatusTone; label: string } => {
  if (action.includes('create') || action.includes('CREATE')) {
    return { tone: 'success', label: 'Create' };
  }
  if (action.includes('update') || action.includes('UPDATE') || action.includes('edit')) {
    return { tone: 'info', label: 'Update' };
  }
  if (action.includes('delete') || action.includes('DELETE') || action.includes('remove')) {
    return { tone: 'danger', label: 'Delete' };
  }
  if (action.includes('login') || action.includes('LOGIN') || action.includes('auth')) {
    return { tone: 'brand', label: 'Auth' };
  }
  if (action.includes('view') || action.includes('VIEW') || action.includes('read')) {
    return { tone: 'neutral', label: 'View' };
  }
  return { tone: 'warn', label: 'Action' };
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
  const auditOrganizationName = orgId ? orgAuditQuery.data?.organization?.name : null;
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

  const labelClass = 'mb-1 block text-xs font-medium text-admin-muted';

  return (
      <AdminPageChrome
        icon={<ShieldCheckIcon />}
        eyebrow="Trackability"
        breadcrumbs={[
          { label: 'System' },
          { label: 'Audit', href: orgId ? '/audit' : undefined },
          ...(auditOrganizationName ? [{ label: auditOrganizationName }] : []),
        ]}
        title="Audit Logs"
        meta={auditOrganizationName ? <StatusPill tone="brand">Tenant: {auditOrganizationName}</StatusPill> : null}
        description={subtitle}
        actions={
          orgId ? (
            <Link href="/audit" className={buttonClass.secondary}>
              <XMarkIcon className="h-4 w-4" />
              View all logs
            </Link>
          ) : undefined
        }
      >
        {!orgId && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-admin-muted">View:</span>
            <Segmented<GlobalView>
              size="sm"
              ariaLabel="Audit source"
              options={[
                { value: 'main_app', label: 'Main app' },
                { value: 'platform_admin', label: 'Platform admin' },
              ]}
              value={globalView}
              onChange={(v) => {
                if (v === 'main_app') {
                  setGlobalView('main_app');
                  setActionFilter('');
                  setUserId('');
                  setAdminRole('');
                  setPage(1);
                } else {
                  setGlobalView('platform_admin');
                  setActionFilter('');
                  setUserId('');
                  setPage(1);
                }
              }}
            />
            {isPlatformAdminView && (
              <>
                <span className="mx-1 text-admin-border-strong">|</span>
                <span className="text-xs font-medium text-admin-muted">Quick filters:</span>
                <button
                  type="button"
                  onClick={() => {
                    setActionFilter('stuck');
                    setPage(1);
                  }}
                  className={cn(
                    buttonClass.small,
                    isAttentionTriage && 'border-admin-accent-border bg-admin-accent-soft text-admin-accent-ink hover:bg-admin-accent-soft',
                  )}
                >
                  Attention triage
                </button>
                <Link href="/attention" className={buttonClass.small}>
                  Open Attention →
                </Link>
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <StatGrid cols={4} className="mb-6">
          <StatTile label="Total Logs" icon={ShieldCheckIcon} tone="brand" value={data?.total || 0} />
          <StatTile
            label="Creates (this page)"
            tone="ok"
            value={data?.logs?.filter((l: any) => l.action?.toLowerCase().includes('create')).length || 0}
          />
          <StatTile
            label="Updates (this page)"
            tone="info"
            value={data?.logs?.filter((l: any) => l.action?.toLowerCase().includes('update')).length || 0}
          />
          <StatTile
            label="Deletes (this page)"
            tone="critical"
            value={data?.logs?.filter((l: any) => l.action?.toLowerCase().includes('delete')).length || 0}
          />
        </StatGrid>

        {/* Filters */}
        <SectionCard
          className={cn('mb-6', !showFilters && '[&>header]:border-b-0')}
          icon={<FunnelIcon />}
          title={
            <span className="flex items-center gap-2">
              Filters
              {hasFilters && <StatusPill tone="brand" dot={false}>Active</StatusPill>}
            </span>
          }
          actions={
            <button type="button" onClick={() => setShowFilters(f => !f)} className={buttonClass.small}>
              {showFilters ? 'Hide' : 'Show'}
            </button>
          }
          bodyClassName={showFilters ? undefined : 'hidden'}
        >
          {showFilters && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
              {(orgId || isPlatformAdminView) && (
                <div>
                  <label className={labelClass}>
                    {orgId ? 'User' : 'Admin User'}
                  </label>
                  <select
                    value={userId}
                    onChange={(e) => { setUserId(e.target.value); setPage(1); }}
                    className={`${selectClass} w-full`}
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
                  <label className={labelClass}>Source</label>
                  <select
                    value={sourceType}
                    onChange={(e) => { setSourceType(e.target.value as OrgSource); setPage(1); }}
                    className={`${selectClass} w-full`}
                  >
                    <option value="org_user">Main app (org users)</option>
                    <option value="platform_admin">Platform Admin only</option>
                    <option value="all">All (Admin + Org Users)</option>
                  </select>
                </div>
              )}
              {isPlatformAdminView && (
                <div>
                  <label className={labelClass}>Admin Role</label>
                  <select
                    value={adminRole}
                    onChange={(e) => { setAdminRole(e.target.value); setPage(1); }}
                    className={`${selectClass} w-full`}
                  >
                    <option value="">All roles</option>
                    <option value="PLATFORM_ADMIN">Platform Admin</option>
                    <option value="PLATFORM_SUPPORT">Platform Support</option>
                  </select>
                </div>
              )}
              <div>
                <label className={labelClass}>Action Type</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className={`${selectClass} w-full`}
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
                <label className={labelClass}>From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className={inputClass}
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
                  className={buttonClass.secondary}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Logs Table */}
        <SectionCard padded={false}>
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-admin-accent border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-admin-muted">Loading audit logs...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-admin-danger">Error loading logs: {error.message}</p>
            </div>
          ) : data?.logs && data.logs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th>Timestamp</Th>
                    <Th>User</Th>
                    <Th>Action</Th>
                    <Th>Resource</Th>
                    {orgId && sourceType === 'all' && <Th>Source</Th>}
                    {!orgId && <Th>Target Org</Th>}
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log: any) => {
                    const badge = getActionBadge(log.action || '');
                    const metadata = log.metadata || {};
                    
                    return (
                      <tr key={log.id}>
                        <Td className="whitespace-nowrap">
                          <div className="text-sm text-admin-ink">
                            {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-xs text-admin-muted">
                            {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center">
                            <UserCircleIcon className="h-8 w-8 text-admin-border-strong mr-3" />
                            <div>
                              <div className="text-sm font-medium text-admin-ink">
                                {log.user?.name || log.user?.email || 'System'}
                              </div>
                              <div className="text-xs text-admin-muted">
                                {log.user?.email || 'No user'}
                              </div>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <StatusPill tone={badge.tone}>
                            {badge.label}
                          </StatusPill>
                          <div className="text-sm text-admin-ink mt-1">
                            {log.action || 'Unknown action'}
                          </div>
                        </Td>
                        <Td>
                          {log.resource ? (
                            <div>
                              {log.resourceName && (
                                <div className="text-sm font-medium text-admin-ink">
                                  {log.resourceName}
                                </div>
                              )}
                              <span className="text-xs text-admin-secondary capitalize">{(log.resource || '').replace(/_/g, ' ')}</span>
                              {log.resourceId && (
                                <div className="text-xs text-admin-muted font-mono mt-1">
                                  {String(log.resourceId).slice(0, 12)}…
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-admin-muted">—</span>
                          )}
                        </Td>
                        {orgId && sourceType === 'all' && (
                          <Td>
                            <StatusPill tone={log.sourceType === 'platform_admin' ? 'info' : 'brand'} dot={false}>
                              {log.sourceType === 'platform_admin' ? 'Platform Admin' : 'Org User'}
                            </StatusPill>
                          </Td>
                        )}
                        {!orgId && (
                          <Td>
                            {log.targetOrgId ? (
                              <Link
                                href={`/audit?org=${log.targetOrgId}`}
                                className="text-sm text-admin-accent hover:text-admin-accent-ink font-mono"
                              >
                                {log.targetOrgName || log.targetOrgId.slice(0, 12)}
                              </Link>
                            ) : (
                              <span className="text-xs text-admin-muted">—</span>
                            )}
                          </Td>
                        )}
                        <Td>
                          <div className="space-y-1">
                            {log.ipAddress && (
                              <div className="flex items-center text-xs text-admin-muted">
                                <GlobeAltIcon className="h-3 w-3 mr-1" />
                                {log.ipAddress}
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="flex items-center text-xs text-admin-muted">
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
                                <summary className="cursor-pointer font-medium text-admin-accent hover:text-admin-accent-ink">
                                  View metadata
                                </summary>
                                <pre className="mt-1 p-2 rounded-admin-sm border border-admin-border bg-admin-bg text-xs overflow-auto max-w-xs">
                                  {JSON.stringify(metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTableEl>
              </div>

              {/* Pagination - always show */}
              <div className="bg-admin-bg/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-admin-border">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-admin-muted">
                    Showing {data.total === 0 ? 0 : ((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total} logs
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-admin-muted">Per page:</span>
                    <select
                      value={limit}
                      onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                      className={`${selectClass} py-1`}
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
                    className={cn(buttonClass.secondary, 'px-2')}
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <span className="px-4 py-2 text-sm text-admin-secondary">
                    Page {page} of {Math.max(1, totalPages)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || data.total === 0}
                    className={cn(buttonClass.secondary, 'px-2')}
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              className="border-0 shadow-none"
              icon={<ShieldCheckIcon />}
              title="No audit logs found"
              description={
                hasFilters
                  ? 'Try adjusting your filters or date range'
                  : orgId
                    ? 'No customer-app activity for this org yet'
                    : globalView === 'main_app'
                      ? 'Customer app actions (invites, questions, positions, etc.) will appear here'
                      : 'Platform admin mutations will appear here when admins create orgs, update subscriptions, triage Attention, etc.'
              }
            />
          )}
        </SectionCard>
      </AdminPageChrome>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={
      <AdminPage>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent" />
          <span className="ml-3 text-admin-muted">Loading audit logs...</span>
        </div>
      </AdminPage>
    }>
      <AuditLogsContent />
    </Suspense>
  );
}
