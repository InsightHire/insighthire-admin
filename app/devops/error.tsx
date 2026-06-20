'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/components/devops/client-error-reporter';

/**
 * Route-level error boundary for /devops. Without this, any client-side throw in
 * the incident detail panel renders Next's generic "Application error" white
 * screen with no detail. Here we surface the real message/stack so it's
 * diagnosable in the browser (and we log it to the console explicitly).
 */
export default function DevopsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[devops] client render error:', error);
    reportClientError({
      message: error?.message || 'Unknown devops render error',
      stack: error?.stack,
      source: error?.digest ? `digest:${error.digest}` : undefined,
      kind: 'react-error-boundary',
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-xl font-bold text-red-700">DevOps page error</h1>
        <p className="mt-2 text-sm text-gray-600">
          Something threw while rendering this page. Details below (also in the browser console).
        </p>

        <div className="mt-6 rounded-lg border border-red-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Message</p>
          <pre className="mt-1 whitespace-pre-wrap break-words text-sm text-red-700">
            {error?.message || 'Unknown error'}
          </pre>

          {error?.digest && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase text-gray-500">Digest</p>
              <pre className="mt-1 text-sm text-gray-700">{error.digest}</pre>
            </>
          )}

          {error?.stack && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase text-gray-500">Stack</p>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-600">
                {error.stack}
              </pre>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
          <a
            href="/devops"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to DevOps
          </a>
        </div>
      </div>
    </div>
  );
}
