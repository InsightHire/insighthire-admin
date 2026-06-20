'use client';

import { useEffect } from 'react';

/**
 * Captures uncaught browser errors + unhandled promise rejections and reports
 * them to the same-origin `/api/client-error` sink, which forwards to the devops
 * worker. This is how client-side exceptions become tracked incidents without
 * anyone reading the browser console.
 *
 * Mounted once in the root Providers. Dedupes per-session and rate-limits so a
 * render loop can't spam the worker.
 */

const SENT = new Set<string>();
let sentCount = 0;
const MAX_PER_SESSION = 20;

export function reportClientError(input: {
  message: string;
  stack?: string;
  source?: string;
  kind?: string;
}): void {
  if (typeof window === 'undefined') return;
  const message = (input.message || '').trim();
  if (!message) return;

  // Ignore noise from browser extensions / third-party scripts.
  if (/contentscript\.js|extension:\/\/|ResizeObserver loop/i.test(message + (input.source ?? ''))) {
    return;
  }

  const key = `${input.kind ?? 'error'}|${message}|${input.source ?? ''}`.slice(0, 300);
  if (SENT.has(key)) return;
  if (sentCount >= MAX_PER_SESSION) return;
  SENT.add(key);
  sentCount += 1;

  try {
    const blob = JSON.stringify({
      app: 'insighthire-admin',
      message,
      stack: input.stack,
      source: input.source,
      kind: input.kind ?? 'window.onerror',
      url: window.location.href,
    });
    // keepalive so the report survives a navigation / reload after the crash.
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: blob,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let reporting throw */
  }
}

export function ClientErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError({
        message: event.message || String(event.error?.message ?? 'Unknown error'),
        stack: event.error?.stack,
        source: event.filename
          ? `${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}`
          : undefined,
        kind: 'window.onerror',
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportClientError({
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : 'Unhandled promise rejection',
        stack: reason instanceof Error ? reason.stack : undefined,
        kind: 'unhandledrejection',
      });
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
