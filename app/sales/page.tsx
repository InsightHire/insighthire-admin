'use client';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ExternalLink, Handshake } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass } from '@/components/admin/controls';

const CRM_URL = 'https://crm.insighthire.com';

export default function SalesPage() {
  return (
    <AuthenticatedLayout>
      <AdminPageChrome width="narrow" icon={<Handshake />} breadcrumbs={[{ label: 'Sales' }]} title="Sales">
        <SectionCard icon={<Handshake />} title="InsightCRM" description="Where sales work happens now">
          <EmptyState
            compact
            className="border-dashed shadow-none"
            icon={<ExternalLink />}
            title="Sales moved to the CRM"
            description="Leads, deals, activities and the daily sales summary live in InsightCRM. Website contact-form leads go there too."
            action={
              <a href={CRM_URL} target="_blank" rel="noopener noreferrer" className={buttonClass.primary}>
                Open the CRM
                <ExternalLink className="h-4 w-4" />
              </a>
            }
          />
        </SectionCard>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}
