'use client';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ExternalLink } from 'lucide-react';

const CRM_URL = 'https://crm.insighthire.com';

// The Salesforce-backed sales pages are retired; every /sales route shows this note instead.
export default function SalesLayout(_props: { children: React.ReactNode }) {
  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Sales moved to the CRM</h2>
          <p className="mt-2 text-gray-700">
            Leads, deals, activities and the daily sales summary now live in InsightCRM. Salesforce is switched off.
          </p>
          <a
            href={CRM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open the CRM
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
