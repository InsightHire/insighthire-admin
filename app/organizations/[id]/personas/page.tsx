'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, UserCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { DetailList } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass } from '@/components/admin/controls';

export default function OrganizationPersonasPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const { data, isLoading } = trpc.platformAdmin.getOrganizationPersonas.useQuery({
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
      icon={<UserCircle />}
      breadcrumbs={[
        { label: 'Tenants', href: '/organizations' },
        { label: orgData?.organization?.name || 'Organization', href: `/organizations/${orgId}` },
        { label: 'AI interview avatars' },
      ]}
      title="AI Interview Avatars"
      description={orgData?.organization?.name || 'Organization'}
      actions={
        <Link href={`/admin/personas/create?orgId=${orgId}`} className={buttonClass.primary}>
          <Plus className="h-4 w-4" />
          Create Persona
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.personas.map((persona) => (
          <div key={persona.id} className="admin-panel admin-panel-hover p-5">
            <div className="mb-4 flex items-center gap-4">
              {persona.image_url ? (
                <img
                  src={persona.image_url}
                  alt={persona.name}
                  className="h-14 w-14 rounded-full border border-admin-border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-admin-accent-border bg-admin-accent-soft text-admin-accent">
                  <UserCircle className="h-8 w-8" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-admin-ink">{persona.name}</h3>
                {persona.is_default && (
                  <StatusPill tone="brand" dot={false} className="mt-1">
                    Org Default
                  </StatusPill>
                )}
              </div>
            </div>

            {persona.description && (
              <p className="mb-4 text-sm text-admin-secondary">{persona.description}</p>
            )}

            <div className="rounded-admin-sm border border-admin-border bg-admin-bg/50 p-3">
              <DetailList
                cols={2}
                items={[
                  { label: 'Avatar', value: persona.heygen_avatar_name || 'Not set' },
                  { label: 'Voice', value: persona.elevenlabs_voice_name || 'Not set' },
                  {
                    label: 'Status',
                    value: (
                      <StatusPill tone={persona.is_active ? 'success' : 'neutral'}>
                        {persona.is_active ? 'Active' : 'Inactive'}
                      </StatusPill>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        ))}
      </div>

      {data?.personas.length === 0 && (
        <EmptyState
          icon={<UserCircle />}
          title="No AI avatars configured"
          description="This org has no personas. New orgs receive a default persona on creation; older orgs may not. Use Create Persona above."
        />
      )}
    </AdminPageChrome>
  );
}
