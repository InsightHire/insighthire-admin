'use client';

import { useParams } from 'next/navigation';
import { Video } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';

export default function OrganizationInterviewsPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const { data, isLoading } = trpc.platformAdmin.getOrganizationInterviews.useQuery({
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
      icon={<Video />}
      breadcrumbs={[
        { label: 'Tenants', href: '/organizations' },
        { label: orgData?.organization?.name || 'Organization', href: `/organizations/${orgId}` },
        { label: 'Interview templates' },
      ]}
      title="Interview Templates"
      description={orgData?.organization?.name || 'Organization'}
    >
      <SectionCard
        icon={<Video />}
        title={`Interview Templates (${data?.interviews.length || 0})`}
        description="Reusable interview templates for this organization"
        padded={false}
      >
        {data?.interviews.length === 0 ? (
          <EmptyState compact className="border-0 shadow-none" icon={<Video />} title="No interview templates created yet" />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th>Difficulty</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Times Used</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {data?.interviews.map((interview) => (
                  <tr key={interview.id}>
                    <Td>
                      <div className="font-medium text-admin-ink">{interview.title}</div>
                      {interview.description && (
                        <div className="max-w-xs truncate text-xs text-admin-muted">{interview.description}</div>
                      )}
                    </Td>
                    <Td>{interview.category}</Td>
                    <Td>Level {interview.difficulty}</Td>
                    <Td className="text-right tabular-nums">{interview._count.interview_template_questions}</Td>
                    <Td className="text-right tabular-nums">{interview.usageCount}</Td>
                    <Td>
                      <StatusPill tone={interview.isActive ? 'success' : 'neutral'}>
                        {interview.isActive ? 'Active' : 'Inactive'}
                      </StatusPill>
                    </Td>
                    <Td className="text-admin-muted">{new Date(interview.createdAt).toLocaleDateString()}</Td>
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
