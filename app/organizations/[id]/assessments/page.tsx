'use client';

import { useParams } from 'next/navigation';
import { ClipboardList, FileText, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass } from '@/components/admin/controls';

export default function OrganizationAssessmentsPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const { data, isLoading } = trpc.platformAdmin.getOrganizationAssessments.useQuery({
    organizationId: orgId,
  }, {
    enabled: !authLoading,
  });

  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent"></div></div>;
  }

  return (
    <AdminPageChrome
      icon={<ClipboardList />}
      breadcrumbs={[
        { label: 'Tenants', href: '/organizations' },
        { label: orgData?.organization?.name || 'Organization', href: `/organizations/${orgId}` },
        { label: 'Assessments' },
      ]}
      title="Assessments"
      description={orgData?.organization?.name || 'Organization'}
      actions={
        <button
          onClick={() => {
            // Impersonate org admin to create assessment
            alert('Impersonate an admin from this org to create assessments');
          }}
          className={buttonClass.primary}
        >
          <Plus className="h-4 w-4" />
          Create Assessment
        </button>
      }
    >
      <SectionCard
        icon={<FileText />}
        title={`All Assessments (${data?.assessments.length || 0})`}
        description="Assessments this organization has built"
        padded={false}
      >
        {data?.assessments.length === 0 ? (
          <EmptyState compact className="border-0 shadow-none" icon={<FileText />} title="No assessments created yet" />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Responses</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data?.assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <Td>
                      <div className="font-medium text-admin-ink">{assessment.title}</div>
                      {assessment.description && (
                        <div className="max-w-xs truncate text-xs text-admin-muted">{assessment.description}</div>
                      )}
                    </Td>
                    <Td>{assessment.type}</Td>
                    <Td>
                      <StatusPill tone={assessment.status === 'PUBLISHED' ? 'success' : 'neutral'}>{assessment.status}</StatusPill>
                    </Td>
                    <Td className="text-right tabular-nums">{assessment._count.assessment_questions}</Td>
                    <Td className="text-right tabular-nums">{assessment._count.assessment_responses}</Td>
                    <Td className="text-admin-muted">{new Date(assessment.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      <button className="font-medium text-admin-accent-ink hover:underline">View</button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTableEl>
          </div>
        )}
      </SectionCard>
    </AdminPageChrome>
  );
}
