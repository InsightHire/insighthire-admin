'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function OrganizationJourneysPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;
  const [statusFilter, setStatusFilter] = useState<'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | undefined>(undefined);

  const { data, isLoading } = trpc.platformAdmin.getOrganizationJourneySessions.useQuery({
    organizationId: orgId,
    limit: 50,
    status: statusFilter
  }, {
    enabled: !authLoading,
    retry: false
  });

  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

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
                <h1 className="text-2xl font-bold">Journey Sessions</h1>
                <p className="text-gray-600">{orgData?.organization?.name || 'Organization'}</p>
              </div>
            </div>
            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value as any || undefined)}
              className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="ABANDONED">Abandoned</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {data?.sessions && data.sessions.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Journey / Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.sessions.map((session: any) => (
                  <tr 
                    key={session.id} 
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/candidate/${session.candidateId}`}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-blue-600 hover:text-blue-800">{session.candidateName}</div>
                      <div className="text-xs text-gray-500">{session.candidateEmail || session.candidateId?.slice(0, 8) + '...'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{session.journeyName || 'N/A'}</div>
                      {session.positionTitle && (
                        <div className="text-xs text-gray-500">{session.positionTitle}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                          <div
                            className={`h-2 rounded-full ${
                              session.status === 'COMPLETED' ? 'bg-green-600' :
                              session.status === 'ABANDONED' ? 'bg-red-600' :
                              'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, parseFloat(session.completionPercentage || '0'))}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 min-w-[3rem] text-right">
                          {Math.round(parseFloat(session.completionPercentage || '0'))}%
                        </span>
                      </div>
                      {session.completedSteps !== undefined && session.totalSteps !== undefined && (
                        <div className="text-xs text-gray-500 mt-1">
                          {session.completedSteps} / {session.totalSteps} steps
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        session.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        session.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(session.startedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {session.overallScore ? `${Math.round(parseFloat(session.overallScore))}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No journey sessions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
