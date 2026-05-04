'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { CandidateForensicsView } from '@/components/forensics/CandidateForensicsView';

/**
 * Legacy standalone candidate page.
 * Now renders the shared forensic view. The org id is discovered automatically
 * from the candidate's profile (candidate_profiles.organizationId) via a thin
 * bootstrapping call so existing deep links keep working.
 */
export default function LegacyCandidatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const candidateId = params.id as string;
  const sessionIdParam = searchParams.get('sessionId') || undefined;

  const { isLoading: authLoading } = useAdminAuth();

  // Bootstrap: figure out which org this candidate belongs to (legacy URL lacks org context).
  const { data: bootstrap, isLoading: bootstrapLoading, error: bootstrapError } =
    trpc.platformAdmin.getCandidateJourneyBreakdown.useQuery(
      { candidateId },
      { enabled: !authLoading, retry: 1 },
    );

  const orgId = bootstrap?.organizationId || null;

  // Actual forensic data (only once we know the org)
  const { data, isLoading: forensicsLoading, error, refetch } =
    trpc.platformAdmin.getCandidateForensics.useQuery(
      {
        organizationId: orgId || '',
        candidateId,
        sessionId: sessionIdParam,
      },
      { enabled: !!orgId && !authLoading, retry: 1 },
    );

  const positionId = data?.selectedSession?.positionId || null;

  return (
    <AuthenticatedLayout>
      <LegacyPageShell
        authLoading={authLoading}
        bootstrapLoading={bootstrapLoading}
        forensicsLoading={forensicsLoading}
        error={(bootstrapError || error) as any}
        data={data}
        orgId={orgId}
        positionId={positionId}
        candidateId={candidateId}
        onRefresh={() => refetch()}
      />
    </AuthenticatedLayout>
  );
}

function LegacyPageShell({
  authLoading,
  bootstrapLoading,
  forensicsLoading,
  error,
  data,
  orgId,
  positionId,
  candidateId,
  onRefresh,
}: {
  authLoading: boolean;
  bootstrapLoading: boolean;
  forensicsLoading: boolean;
  error: { message: string } | null;
  data: any;
  orgId: string | null;
  positionId: string | null;
  candidateId: string;
  onRefresh: () => void;
}) {
  // Auto-redirect to the canonical position-scoped URL if we have both org + position
  // context, so future navigation stays in the position tree.
  useEffect(() => {
    if (!orgId || !positionId || !candidateId) return;
    const current = window.location.pathname;
    const canonical = `/organizations/${orgId}/positions/${positionId}/candidates/${candidateId}`;
    if (current !== canonical) {
      window.history.replaceState(null, '', canonical + window.location.search);
    }
  }, [orgId, positionId, candidateId]);

  if (authLoading || bootstrapLoading || (orgId && forensicsLoading)) {
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
            <p className="text-red-800 font-medium">Error loading candidate</p>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
            <Link href="/organizations" className="inline-flex items-center mt-4 text-sm text-blue-700 hover:text-blue-900">
              <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back to organizations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <p className="text-amber-800 font-medium">Candidate not in an organization</p>
            <p className="text-amber-600 text-sm mt-1">This candidate profile has no organizationId, so forensics cannot be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const candName =
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
            <Link href={`/organizations/${orgId}`} className="hover:text-gray-900">{data.organization?.name || 'Organization'}</Link>
            {positionId && data.position && (
              <>
                <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
                <Link href={`/organizations/${orgId}/positions/${positionId}`} className="hover:text-gray-900">{data.position.title}</Link>
              </>
            )}
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900">{candName}</span>
          </div>
          <div className="flex items-start space-x-3">
            <Link
              href={positionId ? `/organizations/${orgId}/positions/${positionId}` : `/organizations/${orgId}`}
              className="p-2 hover:bg-gray-100 rounded-lg mt-0.5"
              aria-label="Back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{candName}</h1>
              <p className="text-sm text-gray-600">
                {data.organization?.name || 'Organization'}
                {data.position && <> ·  {data.position.title}</>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <SessionSync />
        <CandidateForensicsView
          data={data as any}
          onSessionChange={(sid) => {
            const url = new URL(window.location.href);
            url.searchParams.set('sessionId', sid);
            window.history.replaceState(null, '', url.toString());
            onRefresh();
          }}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}

function SessionSync() {
  // Placeholder: here we could surface additional legacy-only affordances if needed.
  // For now the shared CandidateForensicsView covers everything.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? null : null;
}
