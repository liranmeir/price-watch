import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, expectedAuthToken } from '@/lib/site-auth';

export async function middleware(request: NextRequest) {
  const expected = await expectedAuthToken();
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Fail closed: if SITE_PASSWORD isn't configured, nobody gets in rather
  // than silently leaving the dashboard (or the OAuth consent screen) open
  // to everyone.
  if (!expected || cookie !== expected) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // /oauth/authorize (the remote MCP consent screen) is gated the same way
  // as the dashboard - see lib/oauth.ts and app/oauth/authorize/.
  matcher: ['/dashboard/:path*', '/oauth/authorize'],
};
