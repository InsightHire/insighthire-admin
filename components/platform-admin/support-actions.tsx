'use client';

/**
 * Common support fixes without impersonating anyone: resend invite, unlock
 * account, force a password-reset email. Each mutation is auto-audited by
 * the platformAdmin middleware and shows up in the org timeline.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

type Member = {
  id: string;
  email: string;
  firstName?: string | null;
  isActive: boolean;
};

export function SupportActionsSection({ organizationId }: { organizationId: string }) {
  const [feedback, setFeedback] = useState<{ userId: string; kind: 'success' | 'error'; text: string } | null>(null);

  const members = (trpc as any).platformAdmin.getOrganizationUsers.useQuery(
    { organizationId },
    { refetchOnWindowFocus: false },
  );

  const onDone = (userId: string, successText: string) => ({
    onSuccess: () => setFeedback({ userId, kind: 'success' as const, text: successText }),
    onError: (e: { message: string }) => setFeedback({ userId, kind: 'error' as const, text: e.message }),
  });

  const resendInvite = (trpc as any).platformAdmin.resendUserInvite.useMutation();
  const unlockAccount = (trpc as any).platformAdmin.unlockUserAccount.useMutation();
  const sendPasswordReset = (trpc as any).platformAdmin.sendPasswordReset.useMutation();

  const rows: Member[] = members.data?.users ?? [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Support</h2>
      <p className="text-sm text-gray-500 mb-4">
        Common fixes for this org's members — no impersonation needed. Every action is logged.
      </p>

      {members.isLoading ? (
        <p className="text-sm text-gray-400">Loading members…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No members yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((member) => (
            <div key={member.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{member.email}</p>
                {feedback?.userId === member.id && (
                  <p className={`text-xs mt-0.5 ${feedback.kind === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {feedback.text}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (!window.confirm(`Resend invite to ${member.email}?`)) return;
                    resendInvite.mutate({ userId: member.id }, onDone(member.id, 'Invite resent.'));
                  }}
                  disabled={resendInvite.isPending}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Resend invite
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Unlock ${member.email}'s account? Clears failed-login lockout.`)) return;
                    unlockAccount.mutate({ userId: member.id }, onDone(member.id, 'Account unlocked.'));
                  }}
                  disabled={unlockAccount.isPending}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Unlock account
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Email ${member.email} a password-reset link?`)) return;
                    sendPasswordReset.mutate({ userId: member.id }, onDone(member.id, 'Reset email sent.'));
                  }}
                  disabled={sendPasswordReset.isPending}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Send password reset
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
