'use client';

import { useEffect } from 'react';
import { Newspaper } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';

const STUDIO_URL = 'https://crm.insighthire.com/marketing/studio';

export default function EditBlogPostPage() {
  useEffect(() => {
    window.location.replace(STUDIO_URL);
  }, []);
  return (
    <AdminPageChrome
      width="narrow"
      icon={<Newspaper />}
      breadcrumbs={[{ label: 'Content' }, { label: 'Blog', href: '/blog' }, { label: 'Edit post' }]}
      title="Edit post"
    >
      <p className="text-sm text-admin-muted">Blog authoring moved to Content Studio. Redirecting…</p>
    </AdminPageChrome>
  );
}
