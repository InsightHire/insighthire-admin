function MicrosoftLogo() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="h-5 w-5" data-testid="microsoft-logo">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/** Abstract brand art: rings, arcs, translucent circles and a rounded-square grid. */
function BrandGeometry() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      data-testid="auth-geometry"
    >
      <defs>
        <pattern id="auth-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <rect x="6" y="6" width="24" height="24" rx="7" fill="none" stroke="#097f3c" strokeOpacity="0.08" />
        </pattern>
        <radialGradient id="auth-orb" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#c9ecd8" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="auth-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#097f3c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#097f3c" stopOpacity="0" />
        </linearGradient>
        <filter id="auth-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>

      <rect width="600" height="800" fill="url(#auth-grid)" />

      <circle cx="120" cy="140" r="130" fill="#ffffff" opacity="0.7" filter="url(#auth-blur)" />
      <circle cx="500" cy="660" r="160" fill="#b6e2ca" opacity="0.7" filter="url(#auth-blur)" />
      <circle cx="520" cy="120" r="110" fill="#097f3c" opacity="0.12" filter="url(#auth-blur)" />

      <g className="auth-float-slow" fill="none" stroke="#097f3c">
        <circle cx="300" cy="400" r="250" strokeOpacity="0.08" />
        <circle cx="300" cy="400" r="200" strokeOpacity="0.1" />
        <circle cx="300" cy="400" r="150" strokeOpacity="0.13" />
        <circle cx="300" cy="400" r="100" strokeOpacity="0.16" />
      </g>

      <g className="auth-float" fill="none" strokeLinecap="round">
        <path d="M 120 400 A 180 180 0 0 1 300 220" stroke="url(#auth-sweep)" strokeWidth="10" />
        <path d="M 480 400 A 180 180 0 0 1 300 580" stroke="#097f3c" strokeOpacity="0.35" strokeWidth="10" />
        <path d="M 225 400 A 75 75 0 0 1 375 400" stroke="#097f3c" strokeOpacity="0.5" strokeWidth="6" />
      </g>

      <g className="auth-float-alt">
        <circle cx="300" cy="400" r="62" fill="url(#auth-orb)" />
        <circle cx="390" cy="300" r="78" fill="#c9ecd8" opacity="0.55" />
        <circle cx="215" cy="485" r="54" fill="#097f3c" opacity="0.14" />
        <circle cx="430" cy="520" r="26" fill="#097f3c" opacity="0.5" />
        <circle cx="170" cy="270" r="14" fill="#097f3c" opacity="0.35" />
        <circle cx="455" cy="205" r="8" fill="#ffffff" />
      </g>

      <g fill="none" stroke="#097f3c" strokeOpacity="0.18" strokeWidth="1.5">
        <rect x="70" y="600" width="64" height="64" rx="16" transform="rotate(12 102 632)" />
        <rect x="470" y="300" width="44" height="44" rx="12" transform="rotate(-18 492 322)" />
        <path d="M 90 70 L 130 70 L 110 104 Z" strokeLinejoin="round" />
      </g>
      <g fill="#ffffff" opacity="0.8">
        <rect x="96" y="626" width="12" height="12" rx="3" />
        <rect x="486" y="316" width="12" height="12" rx="3" />
      </g>
    </svg>
  );
}

/**
 * Staff sign-in screen: logo, heading and Microsoft SSO button on the left,
 * soft green geometric brand panel on the right (hidden below lg).
 */
export function StaffSignIn({ signInHref, errorMessage }: { signInHref: string; errorMessage: string | null }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="auth-rise w-full max-w-sm">
            <img src="/brand/insighthire-logo-light.png" alt="InsightHire" width={163} height={32} className="block h-8 w-auto lg:h-10" />
            <h1 className="mt-8 text-3xl font-semibold tracking-tight text-gray-900">Staff sign in</h1>

            {errorMessage && (
              <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <a
              href={signInHref}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-[#097f3c] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(9,127,60,0.6)] transition-colors hover:bg-[#076a32] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#097f3c] focus-visible:ring-offset-2"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white">
                <MicrosoftLogo />
              </span>
              Sign in with Microsoft
            </a>
          </div>
        </main>
        <p className="text-center text-xs text-gray-400">© {new Date().getFullYear()} InsightHire</p>
      </div>

      <div aria-hidden className="relative hidden p-4 lg:block" data-testid="auth-brand-panel">
        <div
          className="relative h-full min-h-[640px] overflow-hidden rounded-[2rem]"
          style={{
            backgroundColor: '#e7f6ee',
            backgroundImage:
              'radial-gradient(at 15% 10%, #ffffff 0px, transparent 45%), radial-gradient(at 90% 20%, #c9ecd8 0px, transparent 50%), radial-gradient(at 80% 95%, #b6e2ca 0px, transparent 50%), radial-gradient(at 10% 90%, #d8f2e3 0px, transparent 45%)',
          }}
        >
          <BrandGeometry />
        </div>
      </div>

      <style>{`
        @keyframes auth-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes auth-float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -10px); } }
        @keyframes auth-float-alt { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(6px, 8px); } }
        @media (prefers-reduced-motion: no-preference) {
          .auth-rise { animation: auth-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .auth-float { animation: auth-float 14s ease-in-out infinite; }
          .auth-float-alt { animation: auth-float-alt 18s ease-in-out infinite; }
          .auth-float-slow { animation: auth-float 22s ease-in-out infinite; }
        }
      `}</style>
    </div>
  );
}
