import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint for uptime monitors, load balancers, and deployment verification.
 * GET /api/health
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime());

  // Report configuration state without leaking secret keys
  const configStatus = {
    clerk: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    realtimeSocket: Boolean(process.env.NEXT_PUBLIC_SOCKET_URL),
    googleMaps: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    firebase: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  };

  return NextResponse.json(
    {
      status: 'ok',
      service: 'cabgo-web',
      timestamp,
      uptimeSeconds,
      environment: process.env.NODE_ENV || 'production',
      servicesConfigured: configStatus,
    },
    { status: 200 },
  );
}
