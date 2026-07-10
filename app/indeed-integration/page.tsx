import { redirect } from 'next/navigation';

/** Legacy Indeed login helper — use Integrations catalog instead. */
export default function IndeedIntegrationRedirect() {
  redirect('/integrations');
}
