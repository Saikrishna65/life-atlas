import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 Proxy: Guards and isolates the native Android app.
 * Ensures the Android app ONLY accesses the Private Atlas (/secret/vault),
 * and never executes queries or loads pages for the public website.
 */
export function proxy(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  // Detect requests coming from the Android native app
  const isNativeApp =
    userAgent.includes('LifeAtlasApp') ||
    request.headers.get('x-capacitor-platform') === 'android';

  if (isNativeApp) {
    // If the Android app attempts to load any public atlas route,
    // immediately redirect to the Private Atlas Vault.
    if (
      !pathname.startsWith('/secret') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/_next')
    ) {
      return NextResponse.redirect(new URL('/secret/vault', request.url), 307);
    }
  }

  return NextResponse.next();
}

// Support both Next.js 16 proxy and legacy middleware export
export const middleware = proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
