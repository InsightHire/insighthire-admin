'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

export function AlertBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  // Fetch journey health summary for alert counts
  const { data: healthData } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(
    undefined,
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      retry: false,
    }
  );

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };

  // Don't show if no issues or dismissed
  if (dismissed || alerts.total === 0) {
    return null;
  }

  const hasCritical = alerts.critical > 0;
  const hasWarning = alerts.warning > 0 && !hasCritical;

  return (
    <div
      className={`${
        hasCritical
          ? 'bg-red-600'
          : hasWarning
          ? 'bg-yellow-500'
          : 'bg-blue-600'
      } text-white px-4 py-2`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {hasCritical ? (
            <ExclamationCircleIcon className="h-5 w-5" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">
            {hasCritical && (
              <>
                <strong>{alerts.critical}</strong> candidate{alerts.critical !== 1 ? 's' : ''} with critical issues (failed AI processing)
              </>
            )}
            {hasWarning && (
              <>
                <strong>{alerts.warning}</strong> journey location anomal{alerts.warning !== 1 ? 'ies' : 'y'} (7d)—review for fraud / VPN patterns
              </>
            )}
            {!hasCritical && !hasWarning && alerts.info > 0 && (
              <>
                <strong>{alerts.info}</strong> session{alerts.info !== 1 ? 's' : ''} with video in the processing queue &gt;1h—check workers / scoring
              </>
            )}
          </span>
          <button
            onClick={() => router.push('/stuck-candidates')}
            className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
          >
            View Details
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          title="Dismiss for now"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
