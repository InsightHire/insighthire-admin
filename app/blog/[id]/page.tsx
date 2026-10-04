'use client';

import { useEffect } from 'react';

const STUDIO_URL = 'https://crm.insighthire.com/marketing/studio';

export default function EditBlogPostPage() {
  useEffect(() => {
    window.location.replace(STUDIO_URL);
  }, []);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-admin-secondary">
      Blog authoring moved to Content Studio. Redirecting…
    </div>
  );
}
