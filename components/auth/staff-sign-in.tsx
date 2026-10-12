import type { ReactNode } from 'react';
import { CheckCircleIcon, PuzzlePieceIcon, RocketLaunchIcon, ScaleIcon } from '@heroicons/react/24/solid';

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

function Card({ className = '', delay, children }: { className?: string; delay: number; children: ReactNode }) {
  return (
    <div
      className={`auth-card rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_20px_50px_-20px_rgba(6,97,46,0.35)] backdrop-blur ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#097f3c] text-white">{children}</span>;
}

/** Sample admin moments drawn like the app's own cards. Illustrative data only. */
function AdminCards() {
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-md">
      <Card className="absolute left-0 top-6 w-[78%]" delay={250}>
        <div className="flex items-center gap-2">
          <IconTile>
            <PuzzlePieceIcon aria-hidden className="h-4 w-4" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">Lakeshore Health</p>
            <p className="truncate text-xs text-gray-500">Org add-ons</p>
          </div>
        </div>
        {[
          ['Offers', true],
          ['Onboarding', true],
          ['Referrals', false],
        ].map(([label, on]) => (
          <div key={label as string} className="mt-3 flex items-center justify-between text-xs text-gray-600">
            {label}
            <span className={`flex h-4 w-7 items-center rounded-full px-0.5 ${on ? 'justify-end bg-[#097f3c]' : 'bg-gray-200'}`}>
              <span className="h-3 w-3 rounded-full bg-white" />
            </span>
          </div>
        ))}
      </Card>

      <Card className="absolute right-0 top-0 w-[52%]" delay={400}>
        <div className="flex items-center gap-2">
          <IconTile>
            <RocketLaunchIcon aria-hidden className="h-4 w-4" />
          </IconTile>
          <p className="text-sm font-semibold text-gray-900">Deploy healthy</p>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-[#097f3c]" /> api · web · admin
        </p>
      </Card>

      <Card className="absolute bottom-4 right-2 w-[62%]" delay={550}>
        <div className="flex items-start gap-3">
          <IconTile>
            <ScaleIcon aria-hidden className="h-4 w-4" />
          </IconTile>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-semibold text-gray-900">
              Legal review approved <CheckCircleIcon aria-hidden className="h-4 w-4 text-[#097f3c]" />
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Early pay · enabled for 2 orgs</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Staff sign-in screen: Microsoft SSO button on the left, soft green brand
 * panel with sample admin cards on the right (hidden below lg).
 */
export function StaffSignIn({ signInHref, errorMessage }: { signInHref: string; errorMessage: string | null }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
        <div>
          <img src="/brand/insighthire-logo-light.png" alt="InsightHire" width={163} height={32} className="h-8 w-auto" />
        </div>
        <main className="flex flex-1 items-center py-10">
          <div className="auth-rise w-full max-w-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#097f3c]">InsightHire Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Staff sign in</h1>
            <p className="mt-2 text-sm text-gray-500">Use your InsightHire Microsoft account.</p>

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

            <p className="mt-6 text-xs leading-relaxed text-gray-500">
              Restricted to authorized InsightHire staff. Access and actions are logged.
            </p>
          </div>
        </main>
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} InsightHire · Staff only</p>
      </div>

      <div aria-hidden className="relative hidden p-4 lg:block" data-testid="auth-brand-panel">
        <div
          className="relative flex h-full min-h-[640px] flex-col justify-between overflow-hidden rounded-[2rem] p-10 xl:p-12"
          style={{
            backgroundColor: '#e7f6ee',
            backgroundImage:
              'radial-gradient(at 15% 10%, #ffffff 0px, transparent 45%), radial-gradient(at 90% 20%, #c9ecd8 0px, transparent 50%), radial-gradient(at 80% 95%, #b6e2ca 0px, transparent 50%), radial-gradient(at 10% 90%, #d8f2e3 0px, transparent 45%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ backgroundImage: 'radial-gradient(#097f3c22 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#097f3c]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/60 blur-3xl" />

          <div className="relative">
            <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-[#063d1f] xl:text-4xl">Run InsightHire.</p>
            <p className="mt-3 max-w-md text-base text-[#2f5d43]">Orgs, add-ons, deploys and reviews, all from one console.</p>
          </div>

          <div className="relative">
            <AdminCards />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes auth-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: no-preference) {
          .auth-rise { animation: auth-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .auth-card { animation: auth-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        }
      `}</style>
    </div>
  );
}
