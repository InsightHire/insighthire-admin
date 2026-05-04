'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { CandidateForensicsView } from '@/components/forensics/CandidateForensicsView';

export default function PositionCandidateForensicsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.id as string;
  const positionId = params.positionId as string;
  const candidateId = params.candidateId as string;
  const sessionIdParam = searchParams.get('sessionId') || undefined;

  const { isLoading: authLoading } = useAdminAuth();

  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery(
    { id: orgId },
    { enabled: !authLoading },
  );

  const { data, isLoading, error, refetch } = trpc.platformAdmin.getCandidateForensics.useQuery(
    { organizationId: orgId, candidateId, positionId, sessionId: sessionIdParam },
    { enabled: !authLoading, retry: 1 },
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium">Error loading forensics</p>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
            <Link
              href={`/organizations/${orgId}/positions/${positionId}`}
              className="inline-flex items-center mt-4 text-sm text-blue-700 hover:text-blue-900"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back to position
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const orgName = orgData?.organization?.name || data.organization?.name || 'Organization';
  const positionTitle = data.position?.title || 'Position';
  const candidateName =
    `${data.candidate.firstName || ''} ${data.candidate.lastName || ''}`.trim() ||
    data.candidate.email ||
    'Candidate';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center text-xs text-gray-500 mb-2">
            <Link href="/organizations" className="hover:text-gray-900">Organizations</Link>
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <Link href={`/organizations/${orgId}`} className="hover:text-gray-900">{orgName}</Link>
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <Link href={`/organizations/${orgId}/positions`} className="hover:text-gray-900">Positions</Link>
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <Link
              href={`/organizations/${orgId}/positions/${positionId}`}
              className="hover:text-gray-900"
            >
              {positionTitle}
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900">{candidateName}</span>
          </div>
          <div className="flex items-start space-x-3">
            <Link
              href={`/organizations/${orgId}/positions/${positionId}`}
              className="p-2 hover:bg-gray-100 rounded-lg mt-0.5"
              aria-label="Back to position"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{candidateName}</h1>
              <p className="text-sm text-gray-600">
                {orgName} ·  {positionTitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <CandidateForensicsView
          data={data as any}
          onSessionChange={(sid) => {
            const url = new URL(window.location.href);
            url.searchParams.set('sessionId', sid);
            window.history.replaceState(null, '', url.toString());
            refetch();
          }}
          onRefresh={() => refetch()}
        />
      </div>
    </div>
  );
}
