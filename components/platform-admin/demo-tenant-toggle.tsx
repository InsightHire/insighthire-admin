'use client';

/**
 * Audited on/off switch for settings.demoTenant. Turning it on opts the org
 * into the nightly wipe-and-restore, so the change requires typing the org
 * name. Super admins only; others see the current state.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export function DemoTenantBadge() {
  return (
    <span className="rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide bg-purple-600 text-white">
      Demo tenant
    </span>
  );
}

export function DemoTenantToggle({
  organizationId,
  organizationName,
  demoTenant,
  canEdit,
  onSaved,
}: {
  organizationId: string;
  organizationName: string;
  demoTenant: boolean;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = (trpc as any).platformAdmin.setDemoTenant.useMutation({
    onSuccess: () => {
      setConfirming(false);
      setTyped('');
      setError(null);
      onSaved();
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const next = !demoTenant;
  const nameMatches = typed.trim() === organizationName.trim() && organizationName.trim().length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Demo tenant flag</h2>
          <p className="text-sm text-gray-500 mt-1">
            {demoTenant
              ? 'This organization is wiped and restored from its latest snapshot every night at 08:00 UTC.'
              : 'Not a demo tenant. Flagging it opts the organization into the nightly wipe-and-restore.'}
          </p>
        </div>
        {canEdit && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={
              next
                ? 'px-3 py-1.5 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700'
                : 'px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50'
            }
          >
            {next ? 'Mark as demo tenant' : 'Remove demo flag'}
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            {next
              ? `Every night, all candidate and pipeline data in "${organizationName}" will be deleted and replaced from a snapshot. Type the organization name to confirm.`
              : `"${organizationName}" will stop being reset nightly. Type the organization name to confirm.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={organizationName}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="button"
              disabled={!nameMatches || mutation.isPending}
              onClick={() => mutation.mutate({ organizationId, demoTenant: next })}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : next ? 'Yes, mark as demo tenant' : 'Yes, remove flag'}
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                setConfirming(false);
                setTyped('');
                setError(null);
              }}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
