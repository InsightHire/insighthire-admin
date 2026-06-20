'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

/** Legacy /devops/:id URLs — hard redirect to query-param form (avoids broken client nav). */
export default function DevopsIncidentLegacyRedirect() {
  const params = useParams<{ id: string | string[] }>();
  const raw = params?.id;
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';

  useEffect(() => {
    if (!id) return;
    window.location.replace(`/devops?incident=${encodeURIComponent(id)}`);
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-500">Opening incident…</p>
    </div>
  );
}
