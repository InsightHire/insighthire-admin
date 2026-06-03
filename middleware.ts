import { createAuthioMiddleware } from '@/lib/authio/middleware';

export default createAuthioMiddleware();

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
