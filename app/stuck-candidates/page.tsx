import { redirect } from 'next/navigation';

/** Legacy route — attention queue lives at /attention. */
export default function StuckCandidatesRedirect() {
  redirect('/attention');
}
