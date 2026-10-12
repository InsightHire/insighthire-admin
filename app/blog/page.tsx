'use client';

import { ExternalLink, Newspaper } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass } from '@/components/admin/controls';

const STUDIO_URL = 'https://crm.insighthire.com/marketing/studio';

export default function BlogListPage() {
  return (
    <AdminPageChrome
      width="narrow"
      icon={<Newspaper />}
      breadcrumbs={[{ label: 'Content' }, { label: 'Blog' }]}
      title="Blog"
      description={
        <>
          Posts now live in InsightCRM Content Studio. Publishing there updates{' '}
          <a href="https://www.insighthire.com/blog" className="font-medium text-admin-accent hover:underline">
            insighthire.com/blog
          </a>
          .
        </>
      }
    >
      <SectionCard icon={<Newspaper />} title="Posts" description="Write, edit and publish blog posts in Content Studio">
        <EmptyState
          compact
          className="border-dashed shadow-none"
          icon={<ExternalLink />}
          title="Blog authoring moved to Content Studio"
          action={
            <a href={STUDIO_URL} className={buttonClass.primary}>
              Open Content Studio
              <ExternalLink className="h-4 w-4" />
            </a>
          }
        />
      </SectionCard>
    </AdminPageChrome>
  );
}
