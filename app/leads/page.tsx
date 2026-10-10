import { redirect } from 'next/navigation';

/** Leads live in InsightCRM — this route is retired. */
export default function LeadsRedirectPage() {
  redirect('/');
}
