'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeft, UserSearch } from 'lucide-react';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { buttonClass } from '@/components/admin/controls';
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <AdminPage>
        <div className="rounded-admin border border-admin-danger/30 bg-admin-danger-soft p-6">
          <p className="font-medium text-red-800">Error loading forensics</p>
          <p className="mt-1 text-sm text-admin-danger">{error.message}</p>
          <Link
            href={`/organizations/${orgId}/positions/${positionId}`}
            className={`${buttonClass.secondary} mt-4`}
          >
            <ArrowLeft className="h-4 w-4" /> Back to position
          </Link>
        </div>
      </AdminPage>
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
    <AdminPage className="pb-24">
      <PageHeader
        icon={<UserSearch />}
        breadcrumbs={[
          { label: 'Organizations', href: '/organizations' },
          { label: orgName, href: `/organizations/${orgId}` },
          { label: 'Positions', href: `/organizations/${orgId}/positions` },
          { label: positionTitle, href: `/organizations/${orgId}/positions/${positionId}` },
          { label: candidateName },
        ]}
        title={candidateName}
        description={<>{orgName} ·  {positionTitle}</>}
        actions={
          <Link
            href={`/organizations/${orgId}/positions/${positionId}`}
            className={buttonClass.secondary}
            aria-label="Back to position"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to position
          </Link>
        }
      />

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
    </AdminPage>
  );
}
