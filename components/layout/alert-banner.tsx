'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, AlertTriangle, ArrowRight, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';

const DISMISS_KEY = 'ih.admin.alertBanner.dismissed';

/** Home and Attention already lead with this information. */
const HIDDEN_ON = ['/', '/attention', '/alerts', '/stuck-candidates'];

export function AlertBanner() {
  const pathname = usePathname();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const { data: healthData } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    try {
      setDismissedKey(sessionStorage.getItem(DISMISS_KEY));
    } catch {
      /* private mode */
    }
  }, []);

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };
  // Dismissal holds until the counts change, so a new failure still surfaces.
  const countsKey = `${alerts.critical}:${alerts.warning}:${alerts.info}`;

  if (alerts.total === 0 || dismissedKey === countsKey || (pathname && HIDDEN_ON.includes(pathname))) {
    return null;
  }

  const dismiss = () => {
    setDismissedKey(countsKey);
    try {
      sessionStorage.setItem(DISMISS_KEY, countsKey);
    } catch {
      /* private mode */
    }
  };

  const hasCritical = alerts.critical > 0;
  const hasWarning = alerts.warning > 0 && !hasCritical;
  const Icon = hasCritical ? AlertCircle : hasWarning ? AlertTriangle : Info;

  return (
    <div className="px-4 pt-4 sm:px-6 lg:px-8">
      <div
        role="status"
        className={cn(
          'mx-auto flex max-w-7xl items-center gap-3 rounded-admin border px-3.5 py-2.5 text-sm shadow-panel',
          hasCritical
            ? 'border-admin-danger/20 bg-admin-danger-soft'
            : hasWarning
              ? 'border-admin-warn/25 bg-admin-warn-soft'
              : 'border-admin-info/20 bg-admin-info-soft',
        )}
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white',
            hasCritical ? 'text-admin-danger' : hasWarning ? 'text-admin-warn' : 'text-admin-info',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 truncate text-admin-ink">
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
        </p>
        <Link
          href="/attention"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-admin-ink shadow-sm ring-1 ring-admin-border hover:ring-admin-border-strong"
        >
          Open attention <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-admin-muted hover:bg-white hover:text-admin-ink"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
