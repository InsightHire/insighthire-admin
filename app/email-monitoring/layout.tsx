'use client';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

export default function EmailMonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
