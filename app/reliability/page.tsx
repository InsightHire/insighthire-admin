import { redirect } from 'next/navigation';

/** Consolidated Reliability entry — default to E2E results. */
export default function ReliabilityPage() {
  redirect('/e2e-results');
}
