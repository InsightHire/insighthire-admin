'use client';

import { useEffect } from 'react';
import { Newspaper } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';

const STUDIO_URL = 'https://crm.insighthire.com/marketing/studio/blog/new';

export default function NewBlogPostPage() {
  useEffect(() => {
    window.location.replace(STUDIO_URL);
  }, []);
  return (
    <AdminPageChrome
      width="narrow"
      icon={<Newspaper />}
      breadcrumbs={[{ label: 'Content' }, { label: 'Blog', href: '/blog' }, { label: 'New post' }]}
      title="New post"
    >
      <p className="text-sm text-admin-muted">Blog authoring moved to Content Studio. Redirecting…</p>
    </AdminPageChrome>
  );
}
