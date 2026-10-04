'use client';

import { ExternalLink } from 'lucide-react';

const STUDIO_URL = 'https://crm.insighthire.com/marketing/studio';

export default function BlogListPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-admin-ink">Blog</h1>
      <p className="mt-2 text-sm text-admin-secondary">
        Posts now live in InsightCRM Content Studio. Publishing there updates{' '}
        <a href="https://www.insighthire.com/blog" className="font-medium text-admin-accent hover:underline">
          insighthire.com/blog
        </a>
        .
      </p>
      <a
        href={STUDIO_URL}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-admin-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Open Content Studio
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
