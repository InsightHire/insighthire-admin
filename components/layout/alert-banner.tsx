'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export function AlertBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const { data: healthData } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };

  if (dismissed || alerts.total === 0) {
    return null;
  }

  const hasCritical = alerts.critical > 0;
  const hasWarning = alerts.warning > 0 && !hasCritical;

  return (
    <div
      className={`${
        hasCritical ? 'bg-admin-danger' : hasWarning ? 'bg-admin-warn' : 'bg-admin-info'
      } px-4 py-2 text-white`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/attention')}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium"
        >
          {hasCritical ? <AlertCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span className="truncate">
            {hasCritical && (
              <>
                <strong>{alerts.critical}</strong> session{alerts.critical !== 1 ? 's' : ''} with failed or stuck
                processing
              </>
            )}
            {hasWarning && (
              <>
                <strong>{alerts.warning}</strong> location anomal{alerts.warning !== 1 ? 'ies' : 'y'} (7d)
              </>
            )}
            {!hasCritical && !hasWarning && alerts.info > 0 && (
              <>
                <strong>{alerts.info}</strong> session{alerts.info !== 1 ? 's' : ''} with queue delay &gt;1h
              </>
            )}
            <span className="ml-2 opacity-80">· Open attention</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded p-1 hover:bg-white/20"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
