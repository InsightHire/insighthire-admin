'use client';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PipelineSubnav } from '@/components/admin/pipeline-subnav';

export default function BackgroundJobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <PipelineSubnav />
      </div>
      {children}
    </AuthenticatedLayout>
  );
}
