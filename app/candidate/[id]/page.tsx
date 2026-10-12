'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, UserSearch } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { CandidateForensicsView } from '@/components/forensics/CandidateForensicsView';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { buttonClass } from '@/components/admin/controls';

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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <AdminPage>
        <div className="rounded-admin border border-admin-danger/30 bg-admin-danger-soft p-6">
          <p className="font-medium text-red-800">Error loading candidate</p>
          <p className="mt-1 text-sm text-admin-danger">{error.message}</p>
          <Link href="/organizations" className={`${buttonClass.secondary} mt-4`}>
            <ArrowLeft className="h-4 w-4" /> Back to organizations
          </Link>
        </div>
      </AdminPage>
    );
  }

  if (!orgId) {
    return (
      <AdminPage>
        <div className="flex gap-3 rounded-admin border border-admin-warn/25 bg-admin-warn-soft p-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-admin-warn" />
          <div>
            <p className="font-medium text-amber-900">Candidate not in an organization</p>
            <p className="mt-1 text-sm text-amber-800">This candidate profile has no organizationId, so forensics cannot be loaded.</p>
          </div>
        </div>
      </AdminPage>
    );
  }

  if (!data) return null;

  const candName =
    `${data.candidate.firstName || ''} ${data.candidate.lastName || ''}`.trim() ||
    data.candidate.email ||
    'Candidate';

  return (
    <AdminPage className="pb-24">
      <PageHeader
        icon={<UserSearch />}
        breadcrumbs={[
          { label: 'Organizations', href: '/organizations' },
          { label: data.organization?.name || 'Organization', href: `/organizations/${orgId}` },
          ...(positionId && data.position
            ? [{ label: data.position.title as string, href: `/organizations/${orgId}/positions/${positionId}` }]
            : []),
          { label: candName },
        ]}
        title={candName}
        description={
          <>
            {data.organization?.name || 'Organization'}
            {data.position && <> ·  {data.position.title}</>}
          </>
        }
        actions={
          <Link
            href={positionId ? `/organizations/${orgId}/positions/${positionId}` : `/organizations/${orgId}`}
            className={buttonClass.secondary}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

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
    </AdminPage>
  );
}

function SessionSync() {
  // Placeholder: here we could surface additional legacy-only affordances if needed.
  // For now the shared CandidateForensicsView covers everything.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? null : null;
}
