/**
 * Legacy invite link target. Invites are accepted by signing in with Authio as the
 * invited email (the API activates the pending admin row on first sign-in), so old
 * links just go to sign-in.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AcceptInvitePage() {
  redirect('/sign-in');
}
