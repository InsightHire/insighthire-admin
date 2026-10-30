'use client';
export const dynamic = 'force-dynamic';

/**
 * Indeed pull failures on tenant jobs, and the tools to fix them: the hosted
 * browser (solve captchas, finish sign-in), the job mailbox's live
 * authenticator code, codes Indeed emailed, and a retry. Failures also show
 * in the alert inbox and post to Slack.
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, CheckCircle2, ClipboardCopy, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass } from '@/components/admin/controls';

const STAGE_LABELS: Record<string, string> = {
  sign_in: 'Sign-in failed',
  needs_person: 'Needs a person',
  pull: 'Pull failed',
  resume: 'Resume download failed',
  email: 'Email lookup failed',
};

const PULL_RUNNING = ['logging_in', 'scraping', 'importing'];

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}

/** Authenticator code for the job mailbox, refetched the moment it rolls over. */
function LiveCode({ positionId }: { positionId: string }) {
  const q = (trpc as any).platformAdmin.indeedGetCode.useQuery(
    { positionId },
    {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: (d: any) => (d ? d.secondsLeft * 1000 + 250 : 30_000),
    },
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const data = q.data as { code: string; secondsLeft: number } | null | undefined;
  if (!data) return <span className="text-xs text-admin-muted">No authenticator key saved</span>;
  const left = Math.max(0, data.secondsLeft - Math.floor((now - q.dataUpdatedAt) / 1000));
  return (
    <button type="button" onClick={() => copy(data.code)} className={buttonClass.small} title="Copy">
      <span className="font-mono text-sm">{left > 0 ? data.code : '······'}</span>
      <span className="tabular-nums text-admin-muted">{left}s</span>
      <ClipboardCopy className="h-3 w-3" />
    </button>
  );
}

function FixPanel({ positionId }: { positionId: string }) {
  const utils = (trpc as any).useUtils();
  const [pullSessionId, setPullSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pos = (trpc as any).platformAdmin.indeedGetPosition.useQuery(
    { positionId },
    { refetchInterval: (d: any) => (d?.active ? 4000 : false) },
  );
  const p = pos.data as any;
  const active = p?.active ?? null;
  const [importOpenedAt, setImportOpenedAt] = useState<number | null>(null);
  const [cookieText, setCookieText] = useState('');

  const codes = (trpc as any).platformAdmin.indeedGetEmailCodes.useQuery(
    { positionId, sinceMs: Math.max(1, (active?.startedAt ?? importOpenedAt ?? 0) - 60_000) },
    { enabled: !!active || importOpenedAt !== null, refetchInterval: 4000 },
  );
  const pull = (trpc as any).platformAdmin.indeedPullStatus.useQuery(
    { sessionId: pullSessionId ?? '' },
    {
      enabled: !!pullSessionId,
      refetchInterval: (d: any) => (PULL_RUNNING.includes(String(d?.status ?? 'logging_in')) ? 3000 : false),
    },
  );

  const refresh = () => {
    utils.platformAdmin.indeedGetPosition.invalidate({ positionId });
    utils.platformAdmin.indeedListFailures.invalidate();
  };
  const onError = (err: any) => setNotice(err?.message || 'Something went wrong');

  const start = (trpc as any).platformAdmin.indeedStartConnect.useMutation({ onSuccess: refresh, onError });
  const save = (trpc as any).platformAdmin.indeedSaveConnect.useMutation({
    onSuccess: (res: any) => {
      setNotice(res.message);
      refresh();
    },
    onError,
  });
  const cancel = (trpc as any).platformAdmin.indeedCancelConnect.useMutation({ onSettled: refresh });
  const retry = (trpc as any).platformAdmin.indeedRetryPull.useMutation({
    onSuccess: (res: any) => {
      setPullSessionId(res.sessionId);
      setNotice(res.message);
      refresh();
    },
    onError,
  });
  const importCookies = (trpc as any).platformAdmin.indeedImportCookies.useMutation({
    onSuccess: (res: any) => {
      setNotice(res.message);
      if (res.saved) {
        setCookieText('');
        setImportOpenedAt(null);
      }
      refresh();
    },
    onError,
  });
  const dismiss = (trpc as any).platformAdmin.indeedDismissFailure.useMutation({ onSuccess: refresh });
  const refetchEmails = (trpc as any).platformAdmin.indeedRefetchEmails.useMutation({
    onSuccess: () => setNotice('Looking up missing candidate emails on Indeed. This takes a few minutes; nothing is sent.'),
    onError,
  });

  if (pos.isLoading) return <p className="text-sm text-admin-muted">Loading job…</p>;
  if (pos.error) return <p className="text-sm text-red-700">{pos.error.message}</p>;
  if (!p) return null;

  const pullRunning = retry.isPending || PULL_RUNNING.includes(String((pull.data as any)?.status ?? ''));

  return (
    <SectionCard
      icon={<Briefcase />}
      title={`${p.organizationName}: ${p.title}`}
      description={
        <>
          Mailbox <span className="font-mono">{p.email}</span> ·{' '}
          {p.connected ? `session saved ${p.savedAt ? new Date(p.savedAt).toLocaleString() : ''}` : 'no saved session'}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-admin-secondary">Authenticator:</span>
          <LiveCode positionId={positionId} />
        </div>

        {active ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <StatusPill tone={active.status === 'needs_you' ? 'warn' : 'info'}>{active.status}</StatusPill>
              <span className="text-admin-secondary">{active.message}</span>
            </div>
            <iframe
              src={active.liveViewUrl}
              title="Indeed browser"
              sandbox="allow-same-origin allow-scripts"
              allow="clipboard-read; clipboard-write"
              className="h-[620px] w-full rounded-md border border-admin-border bg-white"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-admin-secondary">Codes Indeed emailed:</span>
              {((codes.data as any[]) ?? []).slice(0, 3).map((c) => (
                <button key={`${c.code}-${c.at}`} type="button" onClick={() => copy(c.code)} className={buttonClass.small} title={c.subject}>
                  <span className="font-mono">{c.code}</span>
                  <ClipboardCopy className="h-3 w-3" />
                </button>
              ))}
              {!((codes.data as any[]) ?? []).length && <span className="text-admin-muted">waiting…</span>}
            </div>
            <div className="flex gap-2">
              <button
                className={buttonClass.primary}
                disabled={save.isPending}
                onClick={() => save.mutate({ positionId, connectId: active.connectId })}
              >
                {save.isPending ? 'Saving…' : "Signed in, save session"}
              </button>
              <button
                className={buttonClass.secondary}
                disabled={cancel.isPending}
                onClick={() => cancel.mutate({ positionId, connectId: active.connectId })}
              >
                Close browser
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass.primary} disabled={start.isPending} onClick={() => start.mutate({ positionId })}>
              {start.isPending ? 'Opening browser…' : 'Open Indeed browser'}
            </button>
            <button
              className={buttonClass.secondary}
              disabled={!p.indeedUrl || pullRunning}
              title={p.indeedUrl ? undefined : 'No Indeed candidates link saved on this job'}
              onClick={() => retry.mutate({ positionId })}
            >
              <RefreshCw className={`h-4 w-4 ${pullRunning ? 'animate-spin' : ''}`} />
              {pullRunning ? 'Pulling…' : 'Retry pull'}
            </button>
            <button
              className={buttonClass.secondary}
              disabled={refetchEmails.isPending || pullRunning}
              onClick={() => refetchEmails.mutate({ positionId })}
            >
              Re-fetch missing emails
            </button>
            <button className={buttonClass.ghost} disabled={dismiss.isPending} onClick={() => dismiss.mutate({ positionId })}>
              Dismiss alert
            </button>
          </div>
        )}

        {!active &&
          (importOpenedAt === null ? (
            <button type="button" className={buttonClass.ghost} onClick={() => setImportOpenedAt(Date.now())}>
              Import session from your browser
            </button>
          ) : (
            <div className="space-y-3 rounded-md border border-admin-border p-4">
              <p className="text-sm font-medium text-admin-ink">Import session from your browser</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-admin-secondary">
                <li>
                  In a Chrome incognito window, open employers.indeed.com and sign in as{' '}
                  <span className="font-mono">{p.email}</span>. The code Indeed emails shows up below.
                </li>
                <li>
                  Once you see the dashboard, open DevTools → Network, reload, click the first request, and copy the
                  value of the <span className="font-mono">cookie</span> request header. A JSON export from a cookie
                  extension also works.
                </li>
                <li>Paste it here and import. Then close the incognito window without signing out.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-admin-secondary">Codes Indeed emailed:</span>
                {((codes.data as any[]) ?? []).slice(0, 3).map((c) => (
                  <button key={`${c.code}-${c.at}`} type="button" onClick={() => copy(c.code)} className={buttonClass.small} title={c.subject}>
                    <span className="font-mono">{c.code}</span>
                    <ClipboardCopy className="h-3 w-3" />
                  </button>
                ))}
                {!((codes.data as any[]) ?? []).length && <span className="text-admin-muted">waiting…</span>}
              </div>
              <textarea
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
                rows={5}
                spellCheck={false}
                autoComplete="off"
                placeholder="Paste the cookie header or JSON export"
                className="w-full rounded-md border border-admin-border p-2 font-mono text-xs"
              />
              <div className="flex gap-2">
                <button
                  className={buttonClass.primary}
                  disabled={importCookies.isPending || cookieText.trim().length < 10}
                  onClick={() => importCookies.mutate({ positionId, cookies: cookieText })}
                >
                  {importCookies.isPending ? 'Checking with Indeed…' : 'Import and verify'}
                </button>
                <button
                  className={buttonClass.secondary}
                  onClick={() => {
                    setImportOpenedAt(null);
                    setCookieText('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}

        {(pull.data as any)?.message && <p className="text-sm text-admin-secondary">{(pull.data as any).message}</p>}
        {notice && <p className="text-sm text-admin-secondary">{notice}</p>}
      </div>
    </SectionCard>
  );
}

export default function IndeedPage() {
  return (
    <Suspense fallback={null}>
      <IndeedPageInner />
    </Suspense>
  );
}

function IndeedPageInner() {
  useAdminAuth();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get('positionId');

  const failures = (trpc as any).platformAdmin.indeedListFailures.useQuery(undefined, { refetchInterval: 30_000 });
  const rows = (failures.data as any[]) ?? [];

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Briefcase />}
        breadcrumbs={[{ label: 'Attention', href: '/attention' }, { label: 'Indeed' }]}
        title="Indeed pulls"
        description="Tenant jobs whose Indeed sign-in or candidate pull failed. Open the browser to solve a captcha, then retry the pull."
        meta={!failures.isLoading ? <StatusPill tone={rows.length ? 'danger' : 'success'}>{rows.length} failing</StatusPill> : null}
      >
        <div className="space-y-6">
          <SectionCard title="Failing jobs" padded={false}>
            {failures.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : rows.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="All Indeed pulls healthy" />
            ) : (
              <ul className="divide-y divide-admin-border">
                {rows.map((r) => (
                  <li
                    key={r.positionId}
                    className={`flex flex-wrap items-start gap-3 px-5 py-3.5 ${selected === r.positionId ? 'bg-admin-accent-soft' : ''}`}
                  >
                    <StatusPill tone={r.stage === 'needs_person' ? 'warn' : 'danger'}>{STAGE_LABELS[r.stage] ?? r.stage}</StatusPill>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-admin-ink">
                        {r.organizationName}: {r.positionTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-admin-muted">
                        {r.reason} · {new Date(r.at).toLocaleString()}
                        {r.connectStatus ? ` · browser ${r.connectStatus}` : ''}
                      </p>
                    </div>
                    <button className={buttonClass.small} onClick={() => router.push(`/indeed?positionId=${r.positionId}`)}>
                      Fix
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {selected && <FixPanel key={selected} positionId={selected} />}
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}
