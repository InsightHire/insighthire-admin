import { createAuthioCallbackHandler } from '@/lib/authio/handlers';

export const GET = createAuthioCallbackHandler({ signedInRedirect: '/' });
export const dynamic = 'force-dynamic';
