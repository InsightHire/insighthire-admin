'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import Link from 'next/link';
import { 
  ShieldCheckIcon, 
  MagnifyingGlassIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon
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

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get('org') || undefined;
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const limit = 20;

  const { data, isLoading, error } = trpc.platformAdmin.getAuditLogs.useQuery({
    page,
    limit,
    orgId,
    action: actionFilter || undefined,
  });

  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;

  return (
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheckIcon className="h-8 w-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-sm text-gray-500">
                {orgId ? 'Platform admin actions for this organization' : 'Track all platform admin actions and changes'}
              </p>
            </div>
          </div>
          {orgId && (
            <Link
              href="/audit"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              <XMarkIcon className="h-4 w-4" />
              View all logs
            </Link>
          )}
        </div>

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

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex items-center space-x-4">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by action (e.g., create, update, delete, login)..."
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {actionFilter && (
              <button
                onClick={() => {
                  setActionFilter('');
                  setPage(1);
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>
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
                              <span className="text-sm text-gray-900 capitalize">{log.resource.replace(/_/g, ' ')}</span>
                              {log.resourceId && (
                                <div className="text-xs text-gray-500 font-mono mt-1">
                                  {log.resourceId.slice(0, 12)}...
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
                  <div className="text-sm text-gray-500">
                    Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total} logs
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <span className="px-4 py-2 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <ShieldCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No audit logs found</p>
              <p className="text-sm text-gray-400 mt-1">
                {actionFilter ? 'Try a different filter' : orgId
                  ? 'No platform admin actions on this org yet (e.g. view, update subscription, invite user)'
                  : 'Platform admin actions will appear here when admins create orgs, update subscriptions, invite users, etc.'}
              </p>
            </div>
          )}
        </div>
      </div>
  );
}
