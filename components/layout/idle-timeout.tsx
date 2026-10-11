'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SIGN_OUT_PATH } from '@/lib/authio/config';
import { ACTIVITY_PATH, IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from '@/lib/authio/idle';

const PING_EVERY_MS = 60_000;
const STORAGE_KEY = 'ih-admin-last-activity';
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;
const SIGNED_OUT_PATHS = ['/sign-in', '/login', '/login-error', '/accept-invite', '/activation'];

function readShared(): number {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Tells the BFF when someone is really using the admin (any tab), warns two
 * minutes before the 30-minute idle sign-out, then signs out.
 */
export function IdleTimeout() {
  const pathname = usePathname() ?? '';
  const signedOut = SIGNED_OUT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return signedOut ? null : <IdleTracker />;
}

function IdleTracker() {
  const lastActivity = useRef(Date.now());
  const lastPing = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const ping = () => {
      lastPing.current = Date.now();
      void fetch(ACTIVITY_PATH, { method: 'POST', credentials: 'include' }).catch(() => {});
    };
    const onActivity = () => {
      const now = Date.now();
      lastActivity.current = now;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        /* storage unavailable: this tab still tracks itself */
      }
      if (now - lastPing.current > PING_EVERY_MS) ping();
    };
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
    ping();

    const timer = window.setInterval(() => {
      const last = Math.max(lastActivity.current, readShared());
      const left = IDLE_TIMEOUT_MS - (Date.now() - last);
      if (left <= 0) {
        window.location.href = SIGN_OUT_PATH;
        return;
      }
      setSecondsLeft(left <= IDLE_WARNING_MS ? Math.ceil(left / 1000) : null);
    }, 1000);

    return () => {
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
      window.clearInterval(timer);
    };
  }, []);

  if (secondsLeft === null) return null;
  return (
    <div role="alertdialog" aria-labelledby="idle-title" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-300 bg-white p-4 shadow-lg">
      <p id="idle-title" className="text-sm font-semibold text-gray-900">Still there?</p>
      <p className="mt-1 text-sm text-gray-700" aria-live="polite">
        You’ll be signed out in {secondsLeft} seconds because of inactivity.
      </p>
      <button
        type="button"
        autoFocus
        className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        onClick={() => setSecondsLeft(null)}
      >
        Stay signed in
      </button>
    </div>
  );
}
