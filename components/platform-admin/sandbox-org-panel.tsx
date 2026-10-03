'use client';

/**
 * Staff create one linked sandbox org per customer. The sandbox is its own
 * organization (opened with Login as Admin) and is not billed.
 */
import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

export function SandboxBadge() {
  return (
    <span className="rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide bg-amber-600 text-white">
      Sandbox
    </span>
  );
}

export function SandboxOrgPanel({
  organizationId,
  organizationName,
  isSandbox,
  canEdit,
}: {
  organizationId: string;
  organizationName: string;
  isSandbox: boolean;
  canEdit: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const status = (trpc as any).platformAdmin.sandboxStatus.useQuery({ organizationId });
  const create = (trpc as any).platformAdmin.createSandboxOrganization.useMutation({
    onSuccess: () => {
      setConfirming(false);
      setTyped('');
      setError(null);
      void status.refetch();
    },
    onError: (err: { message?: string }) => setError(err.message || 'Could not create the sandbox'),
  });

  const parent = status.data?.parent as { id: string; name: string | null } | null | undefined;
  const sandbox = status.data?.sandbox as { id: string; name: string | null } | null | undefined;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900">Sandbox</h2>
      <p className="mt-1 text-sm text-gray-600">
        A sandbox is a separate organization linked to this customer. It is marked Sandbox,
        not billed, and opened with Login as Admin.
      </p>

      {isSandbox && (
        <p className="mt-3 text-sm text-gray-800">
          This organization is a sandbox
          {parent ? (
            <>
              {' '}of{' '}
              <Link href={`/organizations/${parent.id}`} className="font-medium text-admin-accent underline">
                {parent.name || parent.id}
              </Link>
            </>
          ) : null}
          .
        </p>
      )}

      {!isSandbox && sandbox && (
        <p className="mt-3 text-sm text-gray-800">
          Sandbox:{' '}
          <Link href={`/organizations/${sandbox.id}`} className="font-medium text-admin-accent underline">
            {sandbox.name || sandbox.id}
          </Link>
        </p>
      )}

      {!isSandbox && !sandbox && canEdit && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm font-medium text-admin-ink hover:bg-slate-50"
        >
          Create sandbox
        </button>
      )}

      {confirming && (
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim() !== organizationName.trim()) {
              setError('Type the organization name to confirm.');
              return;
            }
            setError(null);
            create.mutate({ organizationId });
          }}
        >
          <label className="block text-sm text-gray-700">
            Type <span className="font-medium">{organizationName || '(no name)'}</span> to create the sandbox.
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-admin-sm bg-admin-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {create.isPending ? 'Creating…' : 'Create sandbox'}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(null); setTyped(''); }}
              className="rounded-admin-sm px-3 py-2 text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
