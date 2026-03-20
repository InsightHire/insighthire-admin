'use client';

import Image from 'next/image';

/** White InsightHire wordmark on dark backgrounds (login, accept-invite, etc.) */
export function InsighthireAuthLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center mb-6 ${className}`}>
      <Image
        src="/logo-insighthire-white.png"
        alt="InsightHire"
        width={320}
        height={88}
        className="h-11 sm:h-12 md:h-14 w-auto max-w-[min(100%,280px)] object-contain object-center"
        priority
      />
    </div>
  );
}

export function AuthPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}

export function AuthPageSuspenseFallback() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-6">
      <Image
        src="/logo-insighthire-white.png"
        alt="InsightHire"
        width={240}
        height={66}
        className="h-10 w-auto object-contain opacity-90"
        priority
      />
      <div className="animate-spin h-10 w-10 border-2 border-zinc-600 border-t-indigo-500 rounded-full" />
    </div>
  );
}
