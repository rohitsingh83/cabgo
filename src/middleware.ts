import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

import { canAccessSection, dashboardPathForRole, isUserRole, sectionForPath } from '@/lib/roles';

/**
 * Edge middleware — first line of defence.
 *
 * In demo mode (or with unconfigured local keys), all requests bypass Clerk's
 * dev-browser handshake so the app runs completely offline with zero external network dependencies.
 *
 * In production with real Clerk credentials:
 *  1. Public routes (landing, auth pages, webhooks) are open.
 *  2. Everything else needs a Clerk session (pages → redirect to /sign-in, APIs → 401 JSON).
 *  3. When the session token carries `metadata` we also enforce:
 *       - onboarding must be finished before touching the app
 *       - /rider, /driver and /admin are limited to the matching role
 */

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/suspended',
  '/api/health',
  '/api/webhooks(.*)', // verified by signature (Clerk/Stripe), not by session
  '/sitemap.xml',
  '/robots.txt',
]);

const isAuthPage = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)']);
const isApiRoute = createRouteMatcher(['/api(.*)']);

const isDemoMode =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
  !process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET_KEY === 'sk_test_REPLACE_ME' ||
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('example.clerk.accounts.dev');

function demoMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const roleCookie = request.cookies.get('cabgo_demo_role')?.value;
  const userCookie = request.cookies.get('cabgo_user_data')?.value;
  const sessionCookie = request.cookies.get('cabgo_session')?.value;
  const isAuthenticated = Boolean(roleCookie || userCookie || sessionCookie);

  const isProtected =
    pathname.startsWith('/rider') ||
    pathname.startsWith('/driver') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/onboarding');

  // Mandatory sign-in: unauthenticated users cannot access dashboard or onboarding
  if (isProtected && !isAuthenticated) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Already signed in: redirect away from sign-in / sign-up to their dashboard
  if (isAuthenticated && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
    const role = roleCookie && isUserRole(roleCookie) ? roleCookie : 'rider';
    return NextResponse.redirect(new URL(dashboardPathForRole(role), request.url));
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

const clerkHandler = clerkMiddleware((auth, request) => {
  const { userId, sessionClaims } = auth();
  const { pathname } = request.nextUrl;

  // ---- Public ---------------------------------------------------------
  if (isPublicRoute(request)) {
    // Signed-in users have no business on the sign-in / sign-up screens.
    if (userId && isAuthPage(request)) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    return NextResponse.next();
  }

  // ---- Must be signed in ---------------------------------------------
  if (!userId) {
    if (isApiRoute(request)) {
      return NextResponse.json({ success: false, error: 'You must be signed in' }, { status: 401 });
    }
    return auth().redirectToSignIn({ returnBackUrl: request.url });
  }

  // APIs authorise themselves (requireApiUser) — the onboarding API must work pre-onboarding.
  if (isApiRoute(request)) return NextResponse.next();

  // ---- Role / onboarding gating (needs customised session token) ------
  const metadata = sessionClaims?.metadata;
  if (!metadata) return NextResponse.next();

  const onboarded = metadata.onboardingComplete === true;
  const role = isUserRole(metadata.role) ? metadata.role : undefined;

  if (!onboarded || !role) {
    return isOnboardingRoute(request)
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Already onboarded → skip the role picker.
  if (isOnboardingRoute(request)) {
    return NextResponse.redirect(new URL(dashboardPathForRole(role), request.url));
  }

  const section = sectionForPath(pathname);
  if (section && !canAccessSection(role, section)) {
    return NextResponse.redirect(new URL(dashboardPathForRole(role), request.url));
  }

  return NextResponse.next();
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isDemoMode) {
    return demoMiddleware(request);
  }
  return clerkHandler(request, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
