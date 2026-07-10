import { redirect } from 'next/navigation';

/** Legacy jobs UI — use Pipeline → Background jobs. */
export default function JobsRedirect() {
  redirect('/background-jobs');
}
