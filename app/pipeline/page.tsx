import { redirect } from 'next/navigation';

/** Consolidated Pipeline entry — default to background jobs. */
export default function PipelinePage() {
  redirect('/background-jobs');
}
