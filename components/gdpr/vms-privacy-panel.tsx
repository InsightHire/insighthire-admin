'use client';

import { useState } from 'react';
import { Download, Search, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { confirmEmailMatches } from '@/lib/gdpr/confirm-email';

type PartnerUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  memberships: Array<{ partnerOrgId: string; role: string; isActive: boolean }>;
};

type EraseResult = { requestId: string; vmsAssignments: number; filesDeleted: number; fileFailures: string[] };

function downloadBase64(file: { filename: string; contentType: string; base64: string }) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export or erase an agency user or contract worker (partner_users). */
export function VmsPrivacyPanel() {
  const [email, setEmail] = useState('');
  const [searched, setSearched] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [eraseResult, setEraseResult] = useState<EraseResult | null>(null);

  const find = trpc.platformAdmin.vmsPrivacyFindPartnerUser.useQuery(
    { email: searched },
    { enabled: !!searched, retry: false },
  );
  const user: PartnerUser | null = find.data?.user ?? null;

  const exportMutation = trpc.platformAdmin.vmsPrivacyExport.useMutation({
    onSuccess: (file: { filename: string; contentType: string; base64: string }) => downloadBase64(file),
  });
  const eraseMutation = trpc.platformAdmin.vmsPrivacyErase.useMutation({
    onSuccess: (res: EraseResult) => {
      setEraseResult(res);
      setConfirmEmail('');
      find.refetch();
    },
  });

  const confirmMatches = !!user && confirmEmailMatches(confirmEmail, user.email);

  return (
    <div className="space-y-6">
      <div className="admin-panel p-6">
        <h2 className="text-base font-semibold text-admin-ink">Agency users and contract workers</h2>
        <p className="text-sm text-admin-muted mt-1">
          Run these only after the controller (the agency or the client) confirms the request. Export and erase are recorded in
          the platform audit log. Erase keeps hours, invoices, rates and tax records, which the law requires us to retain.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setEraseResult(null);
            setConfirmEmail('');
            setSearched(email.trim());
          }}
        >
          <label htmlFor="vms-privacy-email" className="sr-only">Email address</label>
          <input
            id="vms-privacy-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@agency.com"
            className="flex-1 px-3 py-2 border border-gray-400 rounded-lg text-sm"
          />
          <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-admin-accent text-white text-sm font-medium rounded-admin-sm hover:bg-admin-accent-ink">
            <Search className="h-4 w-4" aria-hidden /> Find
          </button>
        </form>
        {find.isError && <p role="alert" className="mt-3 text-sm text-red-700">{find.error.message}</p>}
        {searched && find.isSuccess && !user && (
          <p className="mt-3 text-sm text-admin-muted">No agency user or worker with that email.</p>
        )}
      </div>

      {user && (
        <div className="admin-panel p-6 space-y-6">
          <div>
            <p className="text-base font-semibold text-admin-ink">
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || '(no name)'}
            </p>
            <p className="text-sm text-admin-muted">{user.email}</p>
            <p className="text-xs text-admin-muted mt-1">
              {user.isActive ? 'Active' : 'Inactive'} · {user.memberships.length} agency membership
              {user.memberships.length === 1 ? '' : 's'} · last sign-in{' '}
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'never'}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => exportMutation.mutate({ partnerUserId: user.id })}
              disabled={exportMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-400 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {exportMutation.isPending ? 'Preparing export…' : 'Download export (JSON)'}
            </button>
            {exportMutation.isError && <p role="alert" className="mt-2 text-sm text-red-700">{exportMutation.error.message}</p>}
          </div>

          <div className="border-t border-admin-border pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-800">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Erase this person
            </h3>
            <p className="text-sm text-admin-muted mt-1">
              Removes their name, email, notes, punch locations, photos and documents, and closes their sign-in. This cannot be
              undone. Refused while they still have an open assignment. Super admins only.
            </p>
            <label htmlFor="vms-privacy-confirm" className="block text-sm font-medium text-gray-800 mt-4">
              Type <span className="font-mono">{user.email}</span> to confirm
            </label>
            <input
              id="vms-privacy-confirm"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="mt-1 w-full max-w-md px-3 py-2 border border-gray-400 rounded-lg text-sm"
            />
            <label htmlFor="vms-privacy-notes" className="block text-sm font-medium text-gray-800 mt-3">
              Request reference or notes (optional)
            </label>
            <textarea
              id="vms-privacy-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full max-w-md px-3 py-2 border border-gray-400 rounded-lg text-sm"
            />
            <div className="mt-3">
              <button
                type="button"
                disabled={!confirmMatches || eraseMutation.isPending}
                onClick={() =>
                  eraseMutation.mutate({ partnerUserId: user.id, confirmEmail: confirmEmail.trim(), notes: notes.trim() || undefined })
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {eraseMutation.isPending ? 'Erasing…' : 'Erase permanently'}
              </button>
            </div>
            {eraseMutation.isError && <p role="alert" className="mt-2 text-sm text-red-700">{eraseMutation.error.message}</p>}
          </div>
        </div>
      )}

      {eraseResult && (
        <div role="status" className="bg-admin-ok-soft border border-green-200 rounded-admin p-4 text-sm text-green-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4" aria-hidden /> Erased. Request {eraseResult.requestId}
          </p>
          <p className="mt-1">
            {eraseResult.vmsAssignments} assignment(s) anonymized, {eraseResult.filesDeleted} file(s) deleted.
            {eraseResult.fileFailures.length > 0 &&
              ` ${eraseResult.fileFailures.length} file(s) could not be deleted; the request stays open until they are.`}
          </p>
        </div>
      )}
    </div>
  );
}
