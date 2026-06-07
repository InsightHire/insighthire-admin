import { createAuthioMiddleware } from '@/lib/authio/middleware';

export default createAuthioMiddleware();

// Skip /api/* at the matcher level (BFF handlers — including
// /api/auth/{sign-in,callback,refresh,sign-out} and the tRPC proxy — do their
// own auth, and the middleware's cookie-clone trips proxyClientMaxBodySize on
// large multipart uploads). Per the @authio/nextjs migration guide.
export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
