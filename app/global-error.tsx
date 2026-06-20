'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/components/devops/client-error-reporter';

/**
 * Root error boundary — catches render errors anywhere (including the root
 * layout) that no nested error.tsx handled. Reports to the devops sink so even
 * top-level crashes become tracked incidents without the browser console.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global] client render error:', error);
    reportClientError({
      message: error?.message || 'Unknown global render error',
      stack: error?.stack,
      source: error?.digest ? `digest:${error.digest}` : undefined,
      kind: 'react-global-error',
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1 style={{ color: '#b91c1c', fontSize: 20, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, color: '#4b5563', fontSize: 14 }}>
          This error was reported automatically. You can try again.
        </p>
        <pre
          style={{
            marginTop: 16,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {error?.message || 'Unknown error'}
        </pre>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
