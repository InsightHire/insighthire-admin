'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeft, Copy, Send, Ban, CheckCircle2 } from 'lucide-react';
import { STATUS_BADGE, centsToMoney } from '../quote-format';

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TenantQuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = params?.id ?? '';
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const utils = trpc.useUtils();

  const [signerUrl, setSignerUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: quote, isLoading, error } = trpc.platformAdmin.getTenantQuote.useQuery(
    { id: quoteId },
    { enabled: !authLoading && isAuthenticated && Boolean(quoteId), refetchInterval: 30_000 },
  );

  const invalidate = () => utils.platformAdmin.getTenantQuote.invalidate({ id: quoteId });
  const onError = (err: { message: string }) => setActionError(err.message);

  const sendMutation = trpc.platformAdmin.sendTenantQuote.useMutation({
    onSuccess: (res) => {
      setSignerUrl(res.quoteUrl);
      setActionError(null);
      invalidate();
    },
    onError,
  });
  const resendMutation = trpc.platformAdmin.resendTenantQuote.useMutation({
    onSuccess: (res) => {
      setSignerUrl(res.quoteUrl);
      setActionError(null);
      invalidate();
    },
    onError,
  });
  const voidMutation = trpc.platformAdmin.voidTenantQuote.useMutation({
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError,
  });
  const activateMutation = trpc.platformAdmin.activateTenantQuoteComped.useMutation({
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError,
  });

  async function copyUrl() {
    if (!signerUrl) return;
    await navigator.clipboard.writeText(signerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) return null;
  if (error || !quote) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error?.message || 'Quote not found'}
      </div>
    );
  }

  const canSend = ['DRAFT', 'SENT', 'VIEWED'].includes(quote.status);
  const canResend = ['SENT', 'VIEWED'].includes(quote.status);
  const canVoid = quote.status !== 'ACTIVE' && quote.status !== 'VOID';
  const canActivateComped = quote.status === 'SIGNED';
  const signature = (quote.signature ?? null) as null | {
    signerName?: string;
    signerTitle?: string | null;
    typedSignature?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    signedAt?: string;
    contentSha256?: string;
  };

  return (
    <div className="space-y-6">
      <Link href="/sales/quotes" className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{quote.companyName}</h1>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[quote.status] || 'bg-gray-100 text-gray-600'}`}>
                {quote.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {quote.plan} · {centsToMoney(quote.amountCents, quote.currency)}/
              {quote.billingInterval === 'year' ? 'yr' : 'mo'} · Ref {quote.publicId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSend && (
              <button
                onClick={() => sendMutation.mutate({ id: quote.id })}
                disabled={sendMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sendMutation.isPending ? 'Sending…' : quote.status === 'DRAFT' ? 'Send for signature' : 'Send updated version'}
              </button>
            )}
            {canResend && (
              <button
                onClick={() => resendMutation.mutate({ id: quote.id })}
                disabled={resendMutation.isPending}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {resendMutation.isPending ? 'Resending…' : 'Resend (new link)'}
              </button>
            )}
            {canActivateComped && (
              <button
                onClick={() => activateMutation.mutate({ id: quote.id })}
                disabled={activateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {activateMutation.isPending ? 'Activating…' : 'Activate without billing (comped)'}
              </button>
            )}
            {canVoid && (
              <button
                onClick={() => {
                  if (window.confirm('Void this quote? The signer link stops working immediately.')) {
                    voidMutation.mutate({ id: quote.id });
                  }
                }}
                disabled={voidMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" /> Void
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {actionError}
          </div>
        )}

        {signerUrl && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium mb-1">Signer link (also emailed to {quote.recipientEmail}):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs bg-white rounded px-2 py-1 border border-emerald-200">{signerUrl}</code>
              <button onClick={copyUrl} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline shrink-0">
                <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs mt-1 text-emerald-700">Shown once — the link is stored hashed and can't be recovered, only rotated via Resend.</p>
          </div>
        )}

        {quote.organizationId && quote.organization && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            Tenant provisioned:{' '}
            <Link href={`/organizations/${quote.organizationId}`} className="font-medium underline">
              {quote.organization.name || quote.organizationId}
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Terms</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-4"><dt className="text-gray-500">Signer</dt><dd className="text-gray-900 text-right">{quote.recipientName}{quote.recipientTitle ? `, ${quote.recipientTitle}` : ''}<span className="block text-xs text-gray-400">{quote.recipientEmail}</span></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-gray-500">Plan</dt><dd className="text-gray-900">{quote.plan}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-gray-500">Amount</dt><dd className="text-gray-900 tabular-nums">{centsToMoney(quote.amountCents, quote.currency)} / {quote.billingInterval}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-gray-500">Valid until</dt><dd className="text-gray-900">{quote.validUntil ? formatDateTime(quote.validUntil) : 'No expiry'}</dd></div>
            {quote.sfOpportunityId && (
              <div className="flex justify-between gap-4"><dt className="text-gray-500">Salesforce Opp</dt><dd className="text-gray-900 font-mono text-xs">{quote.sfOpportunityId}</dd></div>
            )}
            {quote.termsNotes && (
              <div><dt className="text-gray-500 mb-1">Additional terms</dt><dd className="text-gray-900 whitespace-pre-wrap text-sm bg-gray-50 rounded-lg p-3">{quote.termsNotes}</dd></div>
            )}
          </dl>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Features on activation ({quote.featureSlugs.length})</h3>
            {quote.featureSlugs.length === 0 ? (
              <p className="text-sm text-gray-400">None selected — plan tier defaults only.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {quote.featureSlugs.map((slug) => (
                  <span key={slug} className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{slug}</span>
                ))}
              </div>
            )}
          </div>
          {signature && (
            <div className="border-t border-gray-100 pt-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Signature evidence</h3>
              <dl className="text-xs space-y-1 text-gray-600">
                <div className="flex justify-between gap-4"><dt>Signed by</dt><dd className="text-gray-900">{signature.signerName}{signature.signerTitle ? `, ${signature.signerTitle}` : ''}</dd></div>
                <div className="flex justify-between gap-4"><dt>Mark</dt><dd className="italic text-gray-900">{signature.typedSignature}</dd></div>
                <div className="flex justify-between gap-4"><dt>When</dt><dd>{formatDateTime(signature.signedAt)}</dd></div>
                <div className="flex justify-between gap-4"><dt>IP</dt><dd className="font-mono">{signature.ipAddress || '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt>Document hash</dt><dd className="font-mono truncate max-w-48" title={signature.contentSha256}>{signature.contentSha256?.slice(0, 16)}…</dd></div>
              </dl>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Audit trail</h2>
          {quote.events.length === 0 ? (
            <p className="text-sm text-gray-400">No events yet.</p>
          ) : (
            <ol className="space-y-3">
              {quote.events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-gray-900 font-medium capitalize">{ev.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(ev.createdAt)}
                      {ev.ipAddress ? ` · ${ev.ipAddress}` : ''}
                    </p>
                    {ev.userAgent && <p className="text-xs text-gray-400 truncate" title={ev.userAgent}>{ev.userAgent}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {quote.versions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Versions</h2>
            <p className="text-sm text-gray-500 mt-1">Each send freezes the exact document the signer sees; the signature binds to its hash.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Version</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Frozen</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Document hash</th>
              </tr>
            </thead>
            <tbody>
              {quote.versions.map((v) => (
                <tr key={v.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    v{v.versionInt}
                    {v.versionInt === quote.currentVersionInt && (
                      <span className="ml-2 text-xs text-indigo-600 font-normal">current</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDateTime(v.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-64" title={v.contentSha256}>{v.contentSha256}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
