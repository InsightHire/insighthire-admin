'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeftIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

export default function OrganizationPositionsPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = trpc.platformAdmin.getOrganizationPositions.useQuery({
    organizationId: orgId,
    limit: 100
  }, {
    enabled: !authLoading,
    retry: 1,
    onError: (err) => console.error('Positions query error:', err),

  });


  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

  // Filter positions by status if filter is set
  const filteredPositions = data?.positions?.filter((pos: any) => 
    !statusFilter || pos.status === statusFilter
  ) || [];

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/organizations/${orgId}`} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeftIcon className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Positions</h1>
                <p className="text-gray-600">{orgData?.organization?.name || 'Organization'}</p>
              </div>
            </div>
            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value || undefined)}
              className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CLOSED">Closed</option>
              <option value="FILLED">Filled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">Error loading positions</p>
            <p className="text-red-600 text-sm">{error.message}</p>
          </div>
        )}
        {filteredPositions.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hiring Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applications</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPositions.map((position: any) => (
                  <tr
                    key={position.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      window.location.href = `/organizations/${orgId}/positions/${position.id}`;
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <BriefcaseIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <Link
                            href={`/organizations/${orgId}/positions/${position.id}`}
                            className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {position.title}
                          </Link>
                          <div className="text-xs text-gray-500 font-mono">{position.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {position.department || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {position.location || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(position.status)}`}>
                        {position.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {position.targetHires ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {position.currentHires || 0} / {position.targetHires}
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ 
                                width: `${Math.min(100, ((position.currentHires || 0) / position.targetHires) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{position._count?.applications || 0}</div>
                          <div className="text-xs text-gray-500">Apps</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{position._count?.candidate_profiles || 0}</div>
                          <div className="text-xs text-gray-500">Candidates</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(position.createdAt).toLocaleDateString()}
                      {position.closedAt && (
                        <div className="text-xs text-red-500">
                          Closed: {new Date(position.closedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BriefcaseIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Positions Found</h3>
            <p className="text-gray-500">
              {statusFilter 
                ? `No positions with status "${statusFilter}" found for this organization.`
                : 'This organization has not created any positions yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN': return 'bg-green-100 text-green-800';
    case 'DRAFT': return 'bg-gray-100 text-gray-800';
    case 'ON_HOLD': return 'bg-yellow-100 text-yellow-800';
    case 'CLOSED': return 'bg-red-100 text-red-800';
    case 'FILLED': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
