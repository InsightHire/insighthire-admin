import { createAuthioSignOutHandler } from '@/lib/authio/handlers';

const handler = createAuthioSignOutHandler();
export const GET = handler.GET;
export const POST = handler.POST;
export const dynamic = 'force-dynamic';
