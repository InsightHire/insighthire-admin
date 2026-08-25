import { redirect } from 'next/navigation';

/** Leads moved to Salesforce — this route is retired. */
export default function LeadsRedirectPage() {
  redirect('/');
}
